import re

# 读取原始文件
with open('/Users/aiven/Desktop/AI/tare-solo/PodcastAI/src/app/page.tsx', 'r') as f:
    content = f.read()

# 1. 找到 return 语句开始的位置
return_start = content.find('  return (')
section_start = content.find('      {/* Hero + Generator 第一屏 */}', return_start)
section_end = content.find('      {/* Features */}', return_start)

if section_start == -1 or section_end == -1:
    print("Error: Could not find section markers")
    exit(1)

old_section = content[section_start:section_end]

# 新的上下结构布局
new_section = '''      {/* Hero + Generator 第一屏 - 上下结构 */}
      <section className="relative overflow-hidden bg-gradient-to-b from-primary/5 via-background to-background min-h-screen">
        {/* 装饰背景 */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/10 rounded-full blur-3xl" />
          <div className="absolute top-20 -left-40 w-80 h-80 bg-primary/5 rounded-full blur-3xl" />
        </div>

        <div className="container relative px-4 md:px-6 py-6 md:py-8 lg:py-10">
          {/* Hero 区域 - 顶部居中 */}
          <div className="text-center mb-6 md:mb-8 lg:mb-10">
            <Badge variant="outline" className="px-4 py-1 text-xs md:text-sm w-fit mx-auto mb-3 md:mb-4">
              <Sparkles className="mr-2 h-3 w-3" />
              AI-Powered Podcast Generation / AI 驱动播客生成
            </Badge>
            <h1 className="text-2xl md:text-3xl lg:text-4xl xl:text-5xl font-bold tracking-tight leading-tight mb-3 md:mb-4">
              Transform Content Into Engaging Podcasts
            </h1>
            <p className="text-sm md:text-base lg:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              粘贴链接、上传文件或输入文本——我们的 AI 即时将其转换为可在浏览器中朗读的播客，支持单人、双人模式和自定义克隆声音。
            </p>
            {/* 数据指标 */}
            <div className="flex flex-wrap justify-center gap-4 md:gap-8 mt-4 md:mt-6">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 md:h-5 md:w-5 text-primary" />
                <span className="text-lg md:text-xl font-bold">10K+</span>
                <span className="text-xs md:text-sm text-muted-foreground">Podcasts Created</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 md:h-5 md:w-5 text-primary" />
                <span className="text-lg md:text-xl font-bold">30s</span>
                <span className="text-xs md:text-sm text-muted-foreground">Avg. Generation</span>
              </div>
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 md:h-5 md:w-5 text-primary" />
                <span className="text-lg md:text-xl font-bold">50+</span>
                <span className="text-xs md:text-sm text-muted-foreground">Voice Options</span>
              </div>
            </div>
          </div>

          {/* 播客生成器 - 下方居中 */}
          <div id="generator" className="w-full max-w-2xl mx-auto">
            <Card className="overflow-hidden shadow-xl border-primary/10">
              <CardHeader className="bg-muted/30 py-3 md:py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-primary/10">
                      <Wand2 className="h-4 w-4 md:h-5 md:w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-base md:text-lg">播客生成器</CardTitle>
                      <CardDescription className="text-xs md:text-sm">AI 生成脚本 + 语音合成</CardDescription>
                    </div>
                  </div>
                  {user && (
                    <Badge variant="secondary" className="gap-1 text-xs">
                      <Zap className="h-3 w-3" />
                      {credits} credits
                    </Badge>
                  )}
                </div>
              </CardHeader>

              <CardContent className="p-4 md:p-5 space-y-4">
                {/* 浏览器语音支持提示 */}
                {!webSpeechSupported && (
                  <div className="flex items-start gap-2 p-3 rounded-lg border border-amber-200 bg-amber-50 text-amber-900 text-sm">
                    <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <div>
                      您当前的浏览器不支持 Web Speech API，可能无法播放播客。请使用最新版
                      Chrome、Edge 或 Safari。
                    </div>
                  </div>
                )}

                {/* 输入 Tabs */}
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="link" className="gap-1.5 text-xs md:text-sm">
                      <Link2 className="h-3.5 w-3.5" /> URL / 链接
                    </TabsTrigger>
                    <TabsTrigger value="file" className="gap-1.5 text-xs md:text-sm">
                      <FileUp className="h-3.5 w-3.5" /> File / 文件
                    </TabsTrigger>
                    <TabsTrigger value="text" className="gap-1.5 text-xs md:text-sm">
                      <Type className="h-3.5 w-3.5" /> Text / 文本
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="link" className="space-y-2 mt-3">
                    <Label htmlFor="url" className="text-sm">文章链接</Label>
                    <Input
                      id="url"
                      placeholder="https://example.com/article..."
                      value={linkUrl}
                      onChange={(e) => setLinkUrl(e.target.value)}
                      className="text-sm"
                    />
                  </TabsContent>

                  <TabsContent value="file" className="space-y-2 mt-3">
                    <Label className="text-sm">上传文件</Label>
                    <div
                      className="border-2 border-dashed rounded-lg py-4 md:py-5 text-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-all"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <FileUp className="h-7 w-7 mx-auto text-muted-foreground mb-1.5" />
                      <p className="text-muted-foreground text-xs md:text-sm">
                        {uploadedFile ? uploadedFile.name : '点击上传 PDF / DOC / TXT 文件'}
                      </p>
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.doc,.docx,.txt"
                      className="hidden"
                      onChange={handleFileUpload}
                    />
                  </TabsContent>

                  <TabsContent value="text" className="space-y-2 mt-3">
                    <Label htmlFor="text" className="text-sm">输入文本</Label>
                    <Textarea
                      id="text"
                      placeholder="输入你想要转换为播客的文本内容..."
                      rows={3}
                      value={textContent}
                      onChange={(e) => setTextContent(e.target.value)}
                      className="text-sm resize-none"
                    />
                  </TabsContent>
                </Tabs>

                {/* 播客类型 */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">播客类型</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      variant={podcastType === 'single' ? 'default' : 'outline'}
                      className="gap-1.5 h-10 text-xs md:text-sm"
                      onClick={() => setPodcastType('single')}
                    >
                      <UserIcon className="h-4 w-4" /> 单人主持
                    </Button>
                    <Button
                      type="button"
                      variant={podcastType === 'dual' ? 'default' : 'outline'}
                      className="gap-1.5 h-10 text-xs md:text-sm"
                      onClick={() => setPodcastType('dual')}
                    >
                      <Users className="h-4 w-4" /> 双人主持
                    </Button>
                  </div>
                </div>

                {/* 声音选择 */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">{podcastType === 'dual' ? '主持人声音' : '声音选择'}</Label>
                    <Button
                      type="button"
                      variant="link"
                      size="sm"
                      className="gap-1 h-auto p-0 text-xs"
                      onClick={() => setShowCloneDialog(true)}
                    >
                      <Mic2 className="h-3 w-3" /> 克隆声音
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 md:max-h-48 overflow-y-auto pr-1">
                    {allVoices.map((voice) => (
                      <div
                        key={voice.id}
                        className={`flex items-center gap-2 p-2 rounded-lg border transition-all cursor-pointer group ${
                          selectedVoice === voice.id
                            ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                            : 'border-border hover:border-primary/50 hover:bg-muted/30'
                        }`}
                        onClick={() => setSelectedVoice(voice.id)}
                      >
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                          voice.gender === 'Female' ? 'bg-pink-100 dark:bg-pink-900/30' : 'bg-blue-100 dark:bg-blue-900/30'
                        }`}>
                          {voice.gender === 'Female' ? (
                            <span className="text-xs font-medium text-pink-600 dark:text-pink-400">女</span>
                          ) : (
                            <span className="text-xs font-medium text-blue-600 dark:text-blue-400">男</span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs md:text-sm font-medium truncate">{voice.name}</p>
                          <p className="text-[10px] md:text-xs text-muted-foreground truncate">{voice.style}</p>
                        </div>
                        <button
                          type="button"
                          className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
                            isVoicePreviewPlaying(voice.id)
                              ? 'bg-primary text-white'
                              : 'bg-muted hover:bg-primary/10 text-muted-foreground hover:text-primary opacity-0 group-hover:opacity-100'
                          }`}
                          onClick={(e) => {
                            e.stopPropagation()
                            handlePreviewVoice(voice.id)
                          }}
                        >
                          {isVoicePreviewPlaying(voice.id) ? (
                            <Pause className="h-3.5 w-3.5 fill-current" />
                          ) : (
                            <Play className="h-3.5 w-3.5 ml-0.5 fill-current" />
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 双人模式：嘉宾声音 */}
                {podcastType === 'dual' && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">嘉宾声音</Label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 md:max-h-48 overflow-y-auto pr-1">
                      {allVoices.map((voice) => (
                        <div
                          key={voice.id}
                          className={`flex items-center gap-2 p-2 rounded-lg border transition-all cursor-pointer group ${
                            selectedVoice2 === voice.id
                              ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                              : 'border-border hover:border-primary/50 hover:bg-muted/30'
                          }`}
                          onClick={() => setSelectedVoice2(voice.id)}
                        >
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                            voice.gender === 'Female' ? 'bg-pink-100 dark:bg-pink-900/30' : 'bg-blue-100 dark:bg-blue-900/30'
                          }`}>
                            {voice.gender === 'Female' ? (
                              <span className="text-xs font-medium text-pink-600 dark:text-pink-400">女</span>
                            ) : (
                              <span className="text-xs font-medium text-blue-600 dark:text-blue-400">男</span>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs md:text-sm font-medium truncate">{voice.name}</p>
                            <p className="text-[10px] md:text-xs text-muted-foreground truncate">{voice.style}</p>
                          </div>
                          <button
                            type="button"
                            className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
                              isVoicePreviewPlaying(voice.id)
                                ? 'bg-primary text-white'
                                : 'bg-muted hover:bg-primary/10 text-muted-foreground hover:text-primary opacity-0 group-hover:opacity-100'
                            }`}
                            onClick={(e) => {
                              e.stopPropagation()
                              handlePreviewVoice(voice.id)
                            }}
                          >
                            {isVoicePreviewPlaying(voice.id) ? (
                              <Pause className="h-3.5 w-3.5 fill-current" />
                            ) : (
                              <Play className="h-3.5 w-3.5 ml-0.5 fill-current" />
                            )}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 生成按钮 */}
                <Button
                  type="button"
                  size="default"
                  className="w-full gap-2 h-11 text-sm md:text-base font-medium"
                  onClick={handleGeneratePodcast}
                  disabled={isGenerating}
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="h-4 w-4 md:h-5 md:w-5 animate-spin" /> 生成中...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 md:h-5 md:w-5" /> 生成播客
                    </>
                  )}
                </Button>

                {/* 生成进度 */}
                {isGenerating && (
                  <div className="space-y-2">
                    <Progress value={progress} className="h-1.5" />
                    <p className="text-xs text-muted-foreground text-center">{progressText}</p>
                  </div>
                )}
              </CardContent>

              {/* 生成结果 */}
              {generatedPodcast && (
                <div className="border-t p-4 md:p-5 space-y-4 bg-muted/20">
                  {/* 播放控制 */}
                  <div className="flex items-center gap-3">
                    <Button
                      variant="default"
                      size="icon"
                      className="h-11 w-11 rounded-full shadow-md"
                      onClick={togglePlayPause}
                      disabled={isGenerating}
                    >
                      {isGenerating ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : speechState === 'playing' ? (
                        <Pause className="h-5 w-5 fill-current" />
                      ) : (
                        <Play className="h-5 w-5 ml-0.5 fill-current" />
                      )}
                    </Button>
                    {speechState !== 'idle' && (
                      <Button variant="outline" size="sm" className="gap-2" onClick={stopPlayback}>
                        <Square className="h-4 w-4 fill-current" /> 停止
                      </Button>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm md:text-base truncate">{generatedPodcast.title}</p>
                        {generatedPodcast.engine && generatedPodcast.engine !== 'web-speech' && (
                          <Badge variant="secondary" className="text-xs flex-shrink-0">
                            {generatedPodcast.engine === 'cosyvoice' || generatedPodcast.engine === 'cosyvoice2'
                              ? '克隆语音'
                              : generatedPodcast.engine === 'gptsovits'
                              ? 'GPT-SoVITS'
                              : generatedPodcast.engine === 'indextts'
                              ? 'IndexTTS'
                              : 'AI 语音'}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs md:text-sm text-muted-foreground">
                        {statusText}
                        {generatedPodcast.audioMode === 'audio-file' && totalUtterances > 0 && ` · ${currentUtterance}%`}
                        {generatedPodcast.audioMode !== 'audio-file' && totalUtterances > 0 && ` · ${currentUtterance + 1}/${totalUtterances}`}
                      </p>
                      {speechState !== 'idle' && totalUtterances > 0 && (
                        <Progress value={playProgressPct} className="h-1 mt-1.5" />
                      )}
                    </div>
                    {generatedPodcast.audioMode === 'audio-file' && generatedPodcast.audioUrl && (
                      <Button variant="outline" size="sm" className="gap-1.5 flex-shrink-0" onClick={() => {
                        const a = document.createElement('a')
                        a.href = generatedPodcast.audioUrl!
                        a.download = `${generatedPodcast.title || 'podcast'}.wav`
                        a.click()
                      }}>
                        <Download className="h-4 w-4" /> 下载
                      </Button>
                    )}
                  </div>

                  {/* Highlights */}
                  {generatedPodcast.highlights && generatedPodcast.highlights.length > 0 && (
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2 text-sm">
                        <Sparkles className="h-4 w-4 text-primary" /> 关键亮点
                      </Label>
                      <ul className="space-y-1 text-xs md:text-sm text-muted-foreground">
                        {generatedPodcast.highlights.slice(0, 3).map((h, i) => (
                          <li key={i} className="flex gap-2">
                            <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                            <span>{h}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </Card>
          </div>
        </div>
      </section>

'''

# 替换内容
new_content = content[:section_start] + new_section + content[section_end:]

# 写入文件
with open('/Users/aiven/Desktop/AI/tare-solo/PodcastAI/src/app/page.tsx', 'w') as f:
    f.write(new_content)

print("Successfully updated page.tsx")
print(f"Old section length: {len(old_section)}")
print(f"New section length: {len(new_section)}")
