# Copyright (c) 2024 Alibaba Inc (authors: Xiang Lyu)
#               2025 Alibaba Inc (authors: Xiang Lyu, Bofan Zhou)
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
import os
from typing import Generator
import torch
import numpy as np
import threading
import time
from torch.nn import functional as F
from contextlib import nullcontext
import uuid


def _safe_autocast(enabled=False):
    """Compatibility wrapper for autocast that works on MPS/CPU/CUDA."""
    if enabled and torch.cuda.is_available():
        return torch.amp.autocast('cuda')
    # On MPS or CPU, skip autocast to avoid dtype mismatch
    return nullcontext()


def _detect_repetition_pattern(tokens):
    """v1.0.62: 检测 speech_token 序列中是否存在复读循环（模糊匹配版）。

    v1.0.61 的缺陷（v1.0.62 修正）：
      - pattern_len 从 2 开始检测。正常语音中单个 token 短促重复（持续元音、
        停顿、呼吸音）会被误判为"复读"，导致正常音频被过早截断成 0.x 秒。
        （实测：正常开头 7 个相同 token 被 pattern_len=2 误判，音频只剩 0.26s）
      - 注释声称"pattern_len 从 8 开始"，但代码实际从 2 开始 —— 严重不一致。

    v1.0.62 修复：
      - pattern_len 从 8 开始（≈0.32s，词/短语级），避免短 token 串误判。
      - 单 token 退化（同一 token 连续 >= 40 次 ≈ 1.6s）单独检测，
        既拦截真正的单 token 死循环，又不误伤正常短促重复。
      - 仍只检测尾部连续循环，rounds >= 3 才触发。

    检测方式 — 尾部连续循环（模糊）：
      [A, B, A', B', A'', B'']   → 每轮匹配率>=0.8, rounds=3 → 触发
      正常语音的音素自然重复 → 相邻段匹配率低或轮数<3 → 不触发
    """
    n = len(tokens)
    if n < 12:
        return None

    # ── 单 token 退化检测（同一 token 连续 >= 40 次 ≈ 1.6s，正常语音绝不会出现）──
    if n >= 40:
        tail_single = tokens[-40:]
        if len(set(tail_single)) == 1:
            logging.warning(
                'llm_job v1.0.62: single-token degeneration detected (token=%d x40), forcing stop',
                tail_single[0])
            return (1, 40)

    def _match_ratio(seg, pattern):
        eq = 0
        for a, b in zip(seg, pattern):
            if a == b:
                eq += 1
        return eq / len(pattern)

    # ── 尾部连续循环检测（模糊匹配，pattern_len >= 8，词/短语级）──
    tail = tokens[-150:] if n > 150 else tokens[:]
    tail_len = len(tail)
    # v1.0.70: 阈值收紧 0.8→0.9, 轮数 3→4
    # v1.0.62 的 0.8/3 仍会误伤正常语音：
    #   - 拖长音（"好——"等持续元音产生高度相似 token 串，3 轮 fuzzy 0.8 即命中）
    #   - 中文自然叠词/排比（"慢慢地""一天一天"）
    #   误报后果：生成中途强停 + 回滚 → 音频截断 → 上层反复重试浪费时间，
    #   甚至整块降级到 Edge TTS（音色突变）。
    #   真正的复读死循环会持续 4+ 轮且 token 几乎完全一致（0.9 匹配率），
    #   收紧后仍能可靠拦截；漏网的复读由 Whisper 闭环校验兜底（重试链）。
    FUZZY_THRESHOLD = 0.9
    MIN_ROUNDS = 4
    for pattern_len in range(8, 17):
        if tail_len < pattern_len * MIN_ROUNDS:  # 至少 4 轮才算复读
            continue
        pattern = tail[-pattern_len:]
        rounds = 0
        pos = tail_len
        while pos >= pattern_len:
            segment = tail[pos - pattern_len:pos]
            if _match_ratio(segment, pattern) >= FUZZY_THRESHOLD:
                rounds += 1
                pos -= pattern_len
            else:
                break
        if rounds >= MIN_ROUNDS:
            logging.warning(
                'llm_job v1.0.70: fuzzy tail repetition loop detected (pattern_len=%d, rounds=%d)',
                pattern_len, rounds)
            return (pattern_len, rounds)

    return None


from cosyvoice.utils.common import fade_in_out
from cosyvoice.utils.file_utils import convert_onnx_to_trt, export_cosyvoice2_vllm, logging
from cosyvoice.utils.common import TrtContextWrapper


class CosyVoiceModel:

    def __init__(self,
                 llm: torch.nn.Module,
                 flow: torch.nn.Module,
                 hift: torch.nn.Module,
                 fp16: bool = False):
        if torch.cuda.is_available():
            self.device = torch.device('cuda')
        elif hasattr(torch.backends, 'mps') and torch.backends.mps.is_available():
            self.device = torch.device('mps')
        else:
            self.device = torch.device('cpu')
        self.llm = llm
        self.flow = flow
        self.hift = hift
        self.fp16 = fp16
        self.token_min_hop_len = 2 * self.flow.input_frame_rate
        self.token_max_hop_len = 4 * self.flow.input_frame_rate
        self.token_overlap_len = 20
        # mel fade in out
        self.mel_overlap_len = int(self.token_overlap_len / self.flow.input_frame_rate * 22050 / 256)
        self.mel_window = np.hamming(2 * self.mel_overlap_len)
        # hift cache
        self.mel_cache_len = 20
        self.source_cache_len = int(self.mel_cache_len * 256)
        # speech fade in out
        self.speech_window = np.hamming(2 * self.source_cache_len)
        # rtf and decoding related
        self.stream_scale_factor = 1
        assert self.stream_scale_factor >= 1, 'stream_scale_factor should be greater than 1, change it according to your actual rtf'
        self.llm_context = torch.cuda.stream(torch.cuda.Stream(self.device)) if torch.cuda.is_available() else nullcontext()
        self.lock = threading.Lock()
        # dict used to store session related variable
        self.tts_speech_token_dict = {}
        self.llm_end_dict = {}
        self.mel_overlap_dict = {}
        self.flow_cache_dict = {}
        self.hift_cache_dict = {}
        self.silent_tokens = []

    def load(self, llm_model, flow_model, hift_model):
        self.llm.load_state_dict(torch.load(llm_model, map_location=self.device, weights_only=True), strict=True)
        self.llm.to(self.device).eval()
        self.flow.load_state_dict(torch.load(flow_model, map_location=self.device, weights_only=True), strict=True)
        self.flow.to(self.device).eval()
        # in case hift_model is a hifigan model
        hift_state_dict = {k.replace('generator.', ''): v for k, v in torch.load(hift_model, map_location=self.device, weights_only=True).items()}
        self.hift.load_state_dict(hift_state_dict, strict=True)
        self.hift.to(self.device).eval()

    def load_jit(self, llm_text_encoder_model, llm_llm_model, flow_encoder_model):
        llm_text_encoder = torch.jit.load(llm_text_encoder_model, map_location=self.device)
        self.llm.text_encoder = llm_text_encoder
        llm_llm = torch.jit.load(llm_llm_model, map_location=self.device)
        self.llm.llm = llm_llm
        flow_encoder = torch.jit.load(flow_encoder_model, map_location=self.device)
        self.flow.encoder = flow_encoder

    def load_trt(self, flow_decoder_estimator_model, flow_decoder_onnx_model, trt_concurrent, fp16):
        assert torch.cuda.is_available(), 'tensorrt only supports gpu!'
        if not os.path.exists(flow_decoder_estimator_model) or os.path.getsize(flow_decoder_estimator_model) == 0:
            convert_onnx_to_trt(flow_decoder_estimator_model, self.get_trt_kwargs(), flow_decoder_onnx_model, fp16)
        del self.flow.decoder.estimator
        import tensorrt as trt
        with open(flow_decoder_estimator_model, 'rb') as f:
            estimator_engine = trt.Runtime(trt.Logger(trt.Logger.INFO)).deserialize_cuda_engine(f.read())
        assert estimator_engine is not None, 'failed to load trt {}'.format(flow_decoder_estimator_model)
        self.flow.decoder.estimator = TrtContextWrapper(estimator_engine, trt_concurrent=trt_concurrent, device=self.device)

    def get_trt_kwargs(self):
        min_shape = [(2, 80, 4), (2, 1, 4), (2, 80, 4), (2, 80, 4)]
        opt_shape = [(2, 80, 500), (2, 1, 500), (2, 80, 500), (2, 80, 500)]
        max_shape = [(2, 80, 3000), (2, 1, 3000), (2, 80, 3000), (2, 80, 3000)]
        input_names = ["x", "mask", "mu", "cond"]
        return {'min_shape': min_shape, 'opt_shape': opt_shape, 'max_shape': max_shape, 'input_names': input_names}

    def llm_job(self, text, prompt_text, llm_prompt_speech_token, llm_embedding, uuid):
        cur_silent_token_num, max_silent_token_num = 0, 5
        # v1.0.45: 滑动窗口 pattern 重复检测 — 彻底防止 LLM 复读循环
        # 修复 v1.0.44 的两个致命 bug:
        #   1. logging 未导入导致 NameError，break 永远不执行
        #   2. 检测在 append 之后，重复 token 已被加入音频数据
        # v1.0.45 改进:
        #   1. 正确导入 logging
        #   2. 先检测再 append，检测到重复后回滚已加入的重复 token
        #   3. 降低阈值从 3 轮到 2 轮，更激进地拦截复读
        recent_tokens = []  # 最近的非静音 token 历史
        max_history = 80    # 保留最近 80 个 token 用于 pattern 检测
        total_tokens = 0
        # v1.0.59: 彻底修复音频截断问题
        # 根因：v1.0.53-v1.0.58 将 max_token_text_ratio 压到 4-6，远低于 CosyVoice2 原始默认值 20
        #   50字文本 × 6 = 300 token = 12秒，而正常朗读需 15-20 秒 → 音频被截断
        # v1.0.59: 恢复到原始默认值 20，移除外部硬上限（让 LLM 内部 max_len 自行控制）
        # speech_token rate = 25 token/秒，50字中文 ≈ 40 text_token
        #   max_len = 40 × 20 = 800 token = 32秒（足够完整朗读）
        text_token_count = text.shape[1] if hasattr(text, 'shape') and len(text.shape) > 1 else 0
        if isinstance(text, Generator):
            text_token_count = 100  # 流式输入使用保守估计
        # v1.0.71: 倍率从 20 收紧到 12 — 防止正文读完后的"停不下来"复读
        #   实测正常朗读 speech/text token 比 ≈ 7.5~9.4；20 倍上限给复读留了
        #   一倍以上空间（本例尾部复读 14.7s ≈ 正文 1/3 时长未被拦截）。
        #   12 倍 = 正常朗读上限的 ~1.3~1.6 倍，慢速朗读安全，复读超限即硬停。
        max_total_tokens = min(max(text_token_count * 12, 60), 2000) if text_token_count > 0 else 300
        logging.info(f'llm_job v1.0.59: text_tokens={text_token_count}, max_total_tokens={max_total_tokens}')
        with self.llm_context, _safe_autocast(self.fp16 is True and hasattr(self.llm, 'vllm') is False):
            if isinstance(text, Generator):
                assert (self.__class__.__name__ != 'CosyVoiceModel') and not hasattr(self.llm, 'vllm'), 'streaming input text is only implemented for CosyVoice2/3 and do not support vllm!'
                token_generator = self.llm.inference_bistream(text=text,
                                                              prompt_text=prompt_text.to(self.device),
                                                              prompt_text_len=torch.tensor([prompt_text.shape[1]], dtype=torch.int32).to(self.device),
                                                              prompt_speech_token=llm_prompt_speech_token.to(self.device),
                                                              prompt_speech_token_len=torch.tensor([llm_prompt_speech_token.shape[1]], dtype=torch.int32).to(self.device),
                                                              embedding=llm_embedding.to(self.device))
            else:
                # v1.0.71: 漏读 + 死板朗读的 LLM 层根治
                #
                # 漏读根因：min_token_text_ratio=2 允许 LLM 仅生成 (text_len-prompt_len)*2 个
                #   token 就输出 EOS（提前结束）→ 50 字文本最短 80 token=3.2s 即可停 → 整句漏读。
                #   实测中文朗读 speech/text token 比约 7.5~9.4（50字≈40text_token≈12-15s=300-375 token），
                #   min=5 强制至少生成 5 倍 token（50字→200token=8s）才允许 EOS，
                #   拦截绝大部分提前 EOS；短句（如"好的"）min_len 很小，不影响正常收尾。
                #
                # 死板根因：sampling=1（greedy 贪心解码）每句选择概率最高的唯一路径，
                #   韵律（语调起伏/停顿位置/重音）几乎每句相同 → "像念稿子"。
                #   sampling=8（top-8 采样）让每句在高质量候选中随机选择，
                #   韵律自然多样；复读风险由 token 级 pattern 检测（v1.0.45）+
                #   Whisper 闭环校验（v1.0.61+）双重兜底。
                token_generator = self.llm.inference(text=text.to(self.device),
                                                     text_len=torch.tensor([text.shape[1]], dtype=torch.int32).to(self.device),
                                                     prompt_text=prompt_text.to(self.device),
                                                     prompt_text_len=torch.tensor([prompt_text.shape[1]], dtype=torch.int32).to(self.device),
                                                     prompt_speech_token=llm_prompt_speech_token.to(self.device),
                                                     prompt_speech_token_len=torch.tensor([llm_prompt_speech_token.shape[1]], dtype=torch.int32).to(self.device),
                                                     embedding=llm_embedding.to(self.device),
                                                     sampling=8,
                                                     max_token_text_ratio=20,
                                                     min_token_text_ratio=5,
                                                     uuid=uuid)
            for i in token_generator:
                total_tokens += 1
                # v1.0.45: 安全上限
                if total_tokens > max_total_tokens:
                    logging.warning('llm_job: reached max_total_tokens (%d), forcing stop', max_total_tokens)
                    break
                if i in self.silent_tokens:
                    cur_silent_token_num += 1
                    if cur_silent_token_num > max_silent_token_num:
                        continue
                    self.tts_speech_token_dict[uuid].append(i)
                else:
                    cur_silent_token_num = 0
                    recent_tokens.append(i)
                    if len(recent_tokens) > max_history:
                        recent_tokens.pop(0)
                    # v1.0.45: 先检测再 append
                    # 如果检测到重复 pattern，回滚已加入的重复 token 并停止生成
                    if len(recent_tokens) >= 6:
                        detected = _detect_repetition_pattern(recent_tokens)
                        if detected:
                            pattern_len, repeat_rounds = detected
                            # 回滚：保留第一轮（正常的首次出现），移除后续重复轮
                            # 由于 silent_tokens 通常为空，tts_speech_token_dict 中的 token
                            # 与 recent_tokens 一一对应，可以直接按数量回滚
                            tokens_to_rollback = pattern_len * (repeat_rounds - 1)
                            for _ in range(tokens_to_rollback):
                                if self.tts_speech_token_dict[uuid]:
                                    self.tts_speech_token_dict[uuid].pop()
                            logging.warning('llm_job: detected repetition loop (pattern_len=%d, rounds=%d), rolled back %d tokens, forcing stop. Recent tokens: %s',
                                           pattern_len, repeat_rounds, tokens_to_rollback, recent_tokens[-20:])
                            break
                    self.tts_speech_token_dict[uuid].append(i)
        self.llm_end_dict[uuid] = True

    def vc_job(self, source_speech_token, uuid):
        self.tts_speech_token_dict[uuid] = source_speech_token.flatten().tolist()
        self.llm_end_dict[uuid] = True

    def token2wav(self, token, prompt_token, prompt_feat, embedding, uuid, finalize=False, speed=1.0):
        with _safe_autocast(self.fp16):
            tts_mel, self.flow_cache_dict[uuid] = self.flow.inference(token=token.to(self.device, dtype=torch.int32),
                                                                      token_len=torch.tensor([token.shape[1]], dtype=torch.int32).to(self.device),
                                                                      prompt_token=prompt_token.to(self.device),
                                                                      prompt_token_len=torch.tensor([prompt_token.shape[1]], dtype=torch.int32).to(self.device),
                                                                      prompt_feat=prompt_feat.to(self.device),
                                                                      prompt_feat_len=torch.tensor([prompt_feat.shape[1]], dtype=torch.int32).to(self.device),
                                                                      embedding=embedding.to(self.device),
                                                                      flow_cache=self.flow_cache_dict[uuid])

        # mel overlap fade in out
        if self.mel_overlap_dict[uuid].shape[2] != 0:
            tts_mel = fade_in_out(tts_mel, self.mel_overlap_dict[uuid], self.mel_window)
        # append hift cache
        if self.hift_cache_dict[uuid] is not None:
            hift_cache_mel, hift_cache_source = self.hift_cache_dict[uuid]['mel'], self.hift_cache_dict[uuid]['source']
            tts_mel = torch.concat([hift_cache_mel, tts_mel], dim=2)
        else:
            hift_cache_source = torch.zeros(1, 1, 0)
        # keep overlap mel and hift cache
        if finalize is False:
            self.mel_overlap_dict[uuid] = tts_mel[:, :, -self.mel_overlap_len:]
            tts_mel = tts_mel[:, :, :-self.mel_overlap_len]
            tts_speech, tts_source = self.hift.inference(speech_feat=tts_mel, cache_source=hift_cache_source)
            if self.hift_cache_dict[uuid] is not None:
                tts_speech = fade_in_out(tts_speech, self.hift_cache_dict[uuid]['speech'], self.speech_window)
            self.hift_cache_dict[uuid] = {'mel': tts_mel[:, :, -self.mel_cache_len:],
                                          'source': tts_source[:, :, -self.source_cache_len:],
                                          'speech': tts_speech[:, -self.source_cache_len:]}
            tts_speech = tts_speech[:, :-self.source_cache_len]
        else:
            if speed != 1.0:
                assert self.hift_cache_dict[uuid] is None, 'speed change only support non-stream inference mode'
                tts_mel = F.interpolate(tts_mel, size=int(tts_mel.shape[2] / speed), mode='linear')
            tts_speech, tts_source = self.hift.inference(speech_feat=tts_mel, cache_source=hift_cache_source)
            if self.hift_cache_dict[uuid] is not None:
                tts_speech = fade_in_out(tts_speech, self.hift_cache_dict[uuid]['speech'], self.speech_window)
        return tts_speech

    def tts(self, text=torch.zeros(1, 0, dtype=torch.int32), flow_embedding=torch.zeros(0, 192), llm_embedding=torch.zeros(0, 192),
            prompt_text=torch.zeros(1, 0, dtype=torch.int32),
            llm_prompt_speech_token=torch.zeros(1, 0, dtype=torch.int32),
            flow_prompt_speech_token=torch.zeros(1, 0, dtype=torch.int32),
            prompt_speech_feat=torch.zeros(1, 0, 80), source_speech_token=torch.zeros(1, 0, dtype=torch.int32), stream=False, speed=1.0, **kwargs):
        # this_uuid is used to track variables related to this inference thread
        this_uuid = str(uuid.uuid1())
        with self.lock:
            self.tts_speech_token_dict[this_uuid], self.llm_end_dict[this_uuid] = [], False
            self.hift_cache_dict[this_uuid] = None
            self.mel_overlap_dict[this_uuid] = torch.zeros(1, 80, 0)
            self.flow_cache_dict[this_uuid] = torch.zeros(1, 80, 0, 2)
        if source_speech_token.shape[1] == 0:
            p = threading.Thread(target=self.llm_job, args=(text, prompt_text, llm_prompt_speech_token, llm_embedding, this_uuid))
        else:
            p = threading.Thread(target=self.vc_job, args=(source_speech_token, this_uuid))
        p.start()
        if stream is True:
            token_hop_len = self.token_min_hop_len
            while True:
                time.sleep(0.1)
                if len(self.tts_speech_token_dict[this_uuid]) >= token_hop_len + self.token_overlap_len:
                    this_tts_speech_token = torch.tensor(self.tts_speech_token_dict[this_uuid][:token_hop_len + self.token_overlap_len]) \
                        .unsqueeze(dim=0)
                    this_tts_speech = self.token2wav(token=this_tts_speech_token,
                                                     prompt_token=flow_prompt_speech_token,
                                                     prompt_feat=prompt_speech_feat,
                                                     embedding=flow_embedding,
                                                     uuid=this_uuid,
                                                     finalize=False)
                    yield {'tts_speech': this_tts_speech.cpu()}
                    with self.lock:
                        self.tts_speech_token_dict[this_uuid] = self.tts_speech_token_dict[this_uuid][token_hop_len:]
                    # increase token_hop_len for better speech quality
                    token_hop_len = min(self.token_max_hop_len, int(token_hop_len * self.stream_scale_factor))
                if self.llm_end_dict[this_uuid] is True and len(self.tts_speech_token_dict[this_uuid]) < token_hop_len + self.token_overlap_len:
                    break
            p.join()
            # deal with remain tokens, make sure inference remain token len equals token_hop_len when cache_speech is not None
            this_tts_speech_token = torch.tensor(self.tts_speech_token_dict[this_uuid]).unsqueeze(dim=0)
            this_tts_speech = self.token2wav(token=this_tts_speech_token,
                                             prompt_token=flow_prompt_speech_token,
                                             prompt_feat=prompt_speech_feat,
                                             embedding=flow_embedding,
                                             uuid=this_uuid,
                                             finalize=True)
            yield {'tts_speech': this_tts_speech.cpu()}
        else:
            # deal with all tokens
            p.join()
            this_tts_speech_token = torch.tensor(self.tts_speech_token_dict[this_uuid]).unsqueeze(dim=0)
            this_tts_speech = self.token2wav(token=this_tts_speech_token,
                                             prompt_token=flow_prompt_speech_token,
                                             prompt_feat=prompt_speech_feat,
                                             embedding=flow_embedding,
                                             uuid=this_uuid,
                                             finalize=True,
                                             speed=speed)
            yield {'tts_speech': this_tts_speech.cpu()}
        with self.lock:
            self.tts_speech_token_dict.pop(this_uuid)
            self.llm_end_dict.pop(this_uuid)
            self.mel_overlap_dict.pop(this_uuid)
            self.hift_cache_dict.pop(this_uuid)
            self.flow_cache_dict.pop(this_uuid)
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
            torch.cuda.current_stream().synchronize()


class CosyVoice2Model(CosyVoiceModel):

    def __init__(self,
                 llm: torch.nn.Module,
                 flow: torch.nn.Module,
                 hift: torch.nn.Module,
                 fp16: bool = False):
        if torch.cuda.is_available():
            self.device = torch.device('cuda')
        elif hasattr(torch.backends, 'mps') and torch.backends.mps.is_available():
            self.device = torch.device('mps')
        else:
            self.device = torch.device('cpu')
        self.llm = llm
        self.flow = flow
        self.hift = hift
        self.fp16 = fp16
        # NOTE must matching training static_chunk_size
        self.token_hop_len = 25
        # NOTE increase token_hop_len incrementally to avoid duplicate inference
        self.token_max_hop_len = 4 * self.token_hop_len
        self.stream_scale_factor = 2
        assert self.stream_scale_factor >= 1, 'stream_scale_factor should be greater than 1, change it according to your actual rtf'
        # hift cache
        self.mel_cache_len = 8
        self.source_cache_len = int(self.mel_cache_len * 480)
        # speech fade in out
        self.speech_window = np.hamming(2 * self.source_cache_len)
        # rtf and decoding related
        self.llm_context = torch.cuda.stream(torch.cuda.Stream(self.device)) if torch.cuda.is_available() else nullcontext()
        self.lock = threading.Lock()
        # dict used to store session related variable
        self.tts_speech_token_dict = {}
        self.llm_end_dict = {}
        self.hift_cache_dict = {}
        self.silent_tokens = []

    def load_jit(self, flow_encoder_model):
        flow_encoder = torch.jit.load(flow_encoder_model, map_location=self.device)
        self.flow.encoder = flow_encoder

    def load_vllm(self, model_dir):
        export_cosyvoice2_vllm(self.llm, model_dir, self.device)
        from vllm import EngineArgs, LLMEngine
        engine_args = EngineArgs(model=model_dir,
                                 skip_tokenizer_init=True,
                                 enable_prompt_embeds=True,
                                 gpu_memory_utilization=0.2)
        self.llm.vllm = LLMEngine.from_engine_args(engine_args)
        self.llm.lock = threading.Lock()
        del self.llm.llm.model.model.layers

    def token2wav(self, token, prompt_token, prompt_feat, embedding, token_offset, uuid, stream=False, finalize=False, speed=1.0):
        with _safe_autocast(self.fp16):
            tts_mel, _ = self.flow.inference(token=token.to(self.device, dtype=torch.int32),
                                             token_len=torch.tensor([token.shape[1]], dtype=torch.int32).to(self.device),
                                             prompt_token=prompt_token.to(self.device),
                                             prompt_token_len=torch.tensor([prompt_token.shape[1]], dtype=torch.int32).to(self.device),
                                             prompt_feat=prompt_feat.to(self.device),
                                             prompt_feat_len=torch.tensor([prompt_feat.shape[1]], dtype=torch.int32).to(self.device),
                                             embedding=embedding.to(self.device),
                                             streaming=stream,
                                             finalize=finalize)
        tts_mel = tts_mel[:, :, token_offset * self.flow.token_mel_ratio:]
        # append hift cache
        if self.hift_cache_dict[uuid] is not None:
            hift_cache_mel, hift_cache_source = self.hift_cache_dict[uuid]['mel'], self.hift_cache_dict[uuid]['source']
            tts_mel = torch.concat([hift_cache_mel, tts_mel], dim=2)
        else:
            hift_cache_source = torch.zeros(1, 1, 0)
        # keep overlap mel and hift cache
        if finalize is False:
            tts_speech, tts_source = self.hift.inference(speech_feat=tts_mel, cache_source=hift_cache_source)
            if self.hift_cache_dict[uuid] is not None:
                tts_speech = fade_in_out(tts_speech, self.hift_cache_dict[uuid]['speech'], self.speech_window)
            self.hift_cache_dict[uuid] = {'mel': tts_mel[:, :, -self.mel_cache_len:],
                                          'source': tts_source[:, :, -self.source_cache_len:],
                                          'speech': tts_speech[:, -self.source_cache_len:]}
            tts_speech = tts_speech[:, :-self.source_cache_len]
        else:
            if speed != 1.0:
                assert self.hift_cache_dict[uuid] is None, 'speed change only support non-stream inference mode'
                tts_mel = F.interpolate(tts_mel, size=int(tts_mel.shape[2] / speed), mode='linear')
            tts_speech, tts_source = self.hift.inference(speech_feat=tts_mel, cache_source=hift_cache_source)
            if self.hift_cache_dict[uuid] is not None:
                tts_speech = fade_in_out(tts_speech, self.hift_cache_dict[uuid]['speech'], self.speech_window)
        return tts_speech

    def tts(self, text=torch.zeros(1, 0, dtype=torch.int32), flow_embedding=torch.zeros(0, 192), llm_embedding=torch.zeros(0, 192),
            prompt_text=torch.zeros(1, 0, dtype=torch.int32),
            llm_prompt_speech_token=torch.zeros(1, 0, dtype=torch.int32),
            flow_prompt_speech_token=torch.zeros(1, 0, dtype=torch.int32),
            prompt_speech_feat=torch.zeros(1, 0, 80), source_speech_token=torch.zeros(1, 0, dtype=torch.int32), stream=False, speed=1.0, **kwargs):
        # this_uuid is used to track variables related to this inference thread
        this_uuid = str(uuid.uuid1())
        with self.lock:
            self.tts_speech_token_dict[this_uuid], self.llm_end_dict[this_uuid] = [], False
            self.hift_cache_dict[this_uuid] = None
        if source_speech_token.shape[1] == 0:
            p = threading.Thread(target=self.llm_job, args=(text, prompt_text, llm_prompt_speech_token, llm_embedding, this_uuid))
        else:
            p = threading.Thread(target=self.vc_job, args=(source_speech_token, this_uuid))
        p.start()
        if stream is True:
            token_offset = 0
            prompt_token_pad = int(np.ceil(flow_prompt_speech_token.shape[1] / self.token_hop_len) * self.token_hop_len - flow_prompt_speech_token.shape[1])
            while True:
                time.sleep(0.1)
                this_token_hop_len = self.token_hop_len + prompt_token_pad if token_offset == 0 else self.token_hop_len
                if len(self.tts_speech_token_dict[this_uuid]) - token_offset >= this_token_hop_len + self.flow.pre_lookahead_len:
                    this_tts_speech_token = torch.tensor(self.tts_speech_token_dict[this_uuid][:token_offset + this_token_hop_len + self.flow.pre_lookahead_len]).unsqueeze(dim=0)
                    this_tts_speech = self.token2wav(token=this_tts_speech_token,
                                                     prompt_token=flow_prompt_speech_token,
                                                     prompt_feat=prompt_speech_feat,
                                                     embedding=flow_embedding,
                                                     token_offset=token_offset,
                                                     uuid=this_uuid,
                                                     stream=stream,
                                                     finalize=False)
                    token_offset += this_token_hop_len
                    self.token_hop_len = min(self.token_max_hop_len, self.token_hop_len * self.stream_scale_factor)
                    yield {'tts_speech': this_tts_speech.cpu()}
                if self.llm_end_dict[this_uuid] is True and len(self.tts_speech_token_dict[this_uuid]) - token_offset < this_token_hop_len + self.flow.pre_lookahead_len:
                    break
            p.join()
            # deal with remain tokens, make sure inference remain token len equals token_hop_len when cache_speech is not None
            this_tts_speech_token = torch.tensor(self.tts_speech_token_dict[this_uuid]).unsqueeze(dim=0)
            this_tts_speech = self.token2wav(token=this_tts_speech_token,
                                             prompt_token=flow_prompt_speech_token,
                                             prompt_feat=prompt_speech_feat,
                                             embedding=flow_embedding,
                                             token_offset=token_offset,
                                             uuid=this_uuid,
                                             finalize=True)
            yield {'tts_speech': this_tts_speech.cpu()}
        else:
            # deal with all tokens
            p.join()
            this_tts_speech_token = torch.tensor(self.tts_speech_token_dict[this_uuid]).unsqueeze(dim=0)
            this_tts_speech = self.token2wav(token=this_tts_speech_token,
                                             prompt_token=flow_prompt_speech_token,
                                             prompt_feat=prompt_speech_feat,
                                             embedding=flow_embedding,
                                             token_offset=0,
                                             uuid=this_uuid,
                                             finalize=True,
                                             speed=speed)
            yield {'tts_speech': this_tts_speech.cpu()}
        with self.lock:
            self.tts_speech_token_dict.pop(this_uuid)
            self.llm_end_dict.pop(this_uuid)
            self.hift_cache_dict.pop(this_uuid)
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
            torch.cuda.current_stream().synchronize()


class CosyVoice3Model(CosyVoice2Model):

    def __init__(self,
                 llm: torch.nn.Module,
                 flow: torch.nn.Module,
                 hift: torch.nn.Module,
                 fp16: bool = False):
        if torch.cuda.is_available():
            self.device = torch.device('cuda')
        elif hasattr(torch.backends, 'mps') and torch.backends.mps.is_available():
            self.device = torch.device('mps')
        else:
            self.device = torch.device('cpu')
        self.llm = llm
        self.flow = flow
        self.hift = hift
        self.fp16 = fp16
        # NOTE must matching training static_chunk_size
        self.token_hop_len = 25
        # NOTE increase token_hop_len incrementally to avoid duplicate inference
        self.token_max_hop_len = 4 * self.token_hop_len
        self.stream_scale_factor = 2
        assert self.stream_scale_factor >= 1, 'stream_scale_factor should be greater than 1, change it according to your actual rtf'
        # rtf and decoding related
        self.llm_context = torch.cuda.stream(torch.cuda.Stream(self.device)) if torch.cuda.is_available() else nullcontext()
        self.lock = threading.Lock()
        # dict used to store session related variable
        self.tts_speech_token_dict = {}
        self.llm_end_dict = {}
        self.hift_cache_dict = {}
        # FSQ silent and breath token
        self.silent_tokens = [1, 2, 28, 29, 55, 248, 494, 2241, 2242, 2322, 2323]

    def token2wav(self, token, prompt_token, prompt_feat, embedding, token_offset, uuid, stream=False, finalize=False, speed=1.0):
        with _safe_autocast(self.fp16):
            tts_mel, _ = self.flow.inference(token=token.to(self.device, dtype=torch.int32),
                                             token_len=torch.tensor([token.shape[1]], dtype=torch.int32).to(self.device),
                                             prompt_token=prompt_token.to(self.device),
                                             prompt_token_len=torch.tensor([prompt_token.shape[1]], dtype=torch.int32).to(self.device),
                                             prompt_feat=prompt_feat.to(self.device),
                                             prompt_feat_len=torch.tensor([prompt_feat.shape[1]], dtype=torch.int32).to(self.device),
                                             embedding=embedding.to(self.device),
                                             streaming=stream,
                                             finalize=finalize)
            tts_mel = tts_mel[:, :, token_offset * self.flow.token_mel_ratio:]
            # append mel cache
            if self.hift_cache_dict[uuid] is not None:
                hift_cache_mel = self.hift_cache_dict[uuid]['mel']
                tts_mel = torch.concat([hift_cache_mel, tts_mel], dim=2)
                self.hift_cache_dict[uuid]['mel'] = tts_mel
            else:
                self.hift_cache_dict[uuid] = {'mel': tts_mel, 'speech_offset': 0}
            if speed != 1.0:
                assert token_offset == 0 and finalize is True, 'speed change only support non-stream inference mode'
                tts_mel = F.interpolate(tts_mel, size=int(tts_mel.shape[2] / speed), mode='linear')
            tts_speech, _ = self.hift.inference(speech_feat=tts_mel, finalize=finalize)
            tts_speech = tts_speech[:, self.hift_cache_dict[uuid]['speech_offset']:]
            self.hift_cache_dict[uuid]['speech_offset'] += tts_speech.shape[1]
        return tts_speech
