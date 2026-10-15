"""vm 归一化比对测试 — 验证 expected(TN后) 与 transcript(Whisper) 数字形态等价"""
import re
import sys

_num_pat = re.compile(
    r'百分之(?:[零一二三四五六七八九十百千万亿点两]+|[0-9]+(?:\.[0-9]+)?)+%?'
    r'|[0-9]+(?:\.[0-9]+)?%?[零一二三四五六七八九十百千万亿点两]{0,2}'
    r'|[零一二三四五六七八九十百千万亿点两]+'
    r'|(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|'
    r'thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|'
    r'thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|million|'
    r'billion|percent|point|half|quarter)+'
)

def vm(s):
    return _num_pat.sub('#', s)

# (expected TN文本, whisper转写, 是否应等价)
cases = [
    # 百分比：TN中文 vs Whisper阿拉伯 —— 修复的核心场景
    ("增长率达到了百分之十", "增长率达到了10%", True),
    ("毛利率百分之三点五", "毛利率3.5%", True),
    ("增长了百分之十", "增长了百分之10", True),      # Whisper 混合形态
    ("增长了百分之十", "增长了百分之十", True),        # 双方都是中文
    ("增长百分之十二点五", "增长12.5%", True),
    # 年份
    ("二零二五年人工智能迎来了爆发", "2025年人工智能迎来了爆发", True),
    ("二零二五年八月十九日发布", "2025年8月19日发布", True),
    # 数值+单位
    ("净利润二点五万", "净利润2.5万", True),
    ("全球用户十二点五亿", "全球用户12.5亿", True),
    ("共有一万二千三百四十五个案例", "共有12345个案例", True),
    # 单字数字词不受影响（"一个"不应被归一化）
    ("这是一个产品", "这是一个产品", True),
    # 英文
    ("revenuegrewbyfifteenpercent", "revenuegrewby15%", True),
    ("itsworthtwentythousanddollars", "itsworth20000dollars", True),
    # 真漏读：数字整段缺失 → 必须不等价（拦截）
    ("增长率达到了百分之十", "增长率达到了", False),
    ("二零二五年爆发", "年爆发", False),
    # 真漏读：非数字短语缺失 → 不等价
    ("人工智能在二零二五年爆发", "人工智能在年爆发", False),
]

fails = 0
for exp, tr, should_eq in cases:
    evm, tvm = vm(exp), vm(tr)
    eq = evm == tvm
    ok = eq == should_eq
    if not ok:
        fails += 1
    mark = '✅' if ok else '❌'
    print(f"{mark} exp='{exp}' → '{evm}' | tr='{tr}' → '{tvm}' | 等价={eq}(期望{should_eq})")

print(f"\n{'全部通过' if fails == 0 else f'{fails} 个失败'}")
sys.exit(1 if fails else 0)
