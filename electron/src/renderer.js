/**
 * PodcastAI Desktop - Renderer Process
 *
 * 主应用逻辑：UI 渲染、状态管理、API 调用
 */

// ════════════════════════════════════════════════════════════
// i18n 翻译
// ════════════════════════════════════════════════════════════
const I18N = {
  zh: {
    appName: 'PodcastAI',
    loading: '加载中...',
    navPodcast: '播客生成',
    navClone: '声音克隆',
    navHistory: '历史记录',
    navSettings: '设置',
    serviceStatus: '服务状态',
    serviceOnline: '在线',
    serviceOffline: '离线',
    serviceBusy: '合成中',
    serviceCheckFailed: '检测失败',
    serviceHint: '请启动本地 Python 语音服务 (默认端口 8907)',
    // v1.0.38: 账号信息显示
    currentAccount: '当前账号',
    notLoggedIn: '未登录',
    signOut: '退出登录',
    switchAccount: '切换账号',
    themeLabel: '主题',
    themeLight: '浅色',
    themeDark: '深色',
    podcastTitle: '播客生成',
    podcastSubtitle: '将链接、文本或文件转换为高质量播客',
    inputMethod: '输入方式',
    inputUrl: '链接输入',
    inputText: '文本输入',
    inputFile: '文件上传',
    urlLabel: '文章链接',
    urlPlaceholder: '粘贴文章 URL（例如微信公众号文章链接）',
    textLabel: '文本内容',
    textPlaceholder: '输入或粘贴要转换为播客的文本内容...',
    fileLabel: '上传文件',
    fileDropHint: '点击或拖拽文件到此处',
    fileSupported: '支持 PDF、Word、Markdown、TXT 等格式',
    fileSelected: '已选择文件',
    fileChange: '更换文件',
    podcastOptions: '播客选项',
    podcastType: '播客类型',
    singleHost: '单人主持',
    dualHost: '双人访谈',
    voiceSelect: '声音选择',
    voiceHost: '主持人声音',
    voiceGuest: '嘉宾声音',
    systemVoice: '系统声音',
    cloneVoice: '克隆声音',
    noCloneAvailable: '尚未创建克隆声音，请先到「声音克隆」页面创建',
    generate: '生成播客',
    generating: '生成中',
    scriptGenerating: '正在生成脚本...',
    audioSynthesizing: '正在合成音频...',
    segmentProgress: '正在合成第 {current}/{total} 段',
    audioFinalizing: '正在合成最终音频，请稍候...',
    scriptPreview: '脚本预览',
    scriptEditHint: '生成后可编辑脚本，再合成音频',
    audioPlayer: '音频播放器',
    noAudio: '暂无音频',
    duration: '时长',
    cloneTitle: '声音克隆',
    cloneSubtitle: '使用 CosyVoice2 模型克隆您的声音',
    cloneName: '克隆名称',
    cloneNamePlaceholder: '给您的克隆声音起个名字',
    cloneGender: '性别',
    cloneGenderAuto: '自动检测',
    cloneGenderMale: '男',
    cloneGenderFemale: '女',
    cloneDescription: '描述（可选）',
    cloneDescriptionPlaceholder: '例如：温柔女声、磁性男声',
    clonePromptText: '参考文本（可选，提升相似度）',
    clonePromptPlaceholder: '上传音频对应的文字内容（5-30 秒）',
    cloneAudioFile: '参考音频',
    cloneAudioHint: '上传 5-30 秒清晰的人声音频（wav/mp3/m4a）',
    cloneAudioSelected: '已选择音频',
    startClone: '开始克隆',
    cloning: '克隆中...',
    cloneSuccess: '克隆成功',
    cloneFailed: '克隆失败',
    cloneListTitle: '我的克隆声音',
    cloneEmpty: '还没有克隆声音',
    clonePreview: '试听',
    cloneDelete: '删除',
    cloneDeleteConfirm: '确定删除此克隆声音？',
    historyTitle: '历史记录',
    historyEmpty: '还没有生成过播客',
    historyCreatedAt: '创建于',
    historyDuration: '时长',
    historyScript: '脚本',
    historyPlay: '播放',
    historyDownload: '下载',
    historyDelete: '删除',
    historyDeleteConfirm: '确定删除此历史记录？',
    historyClearAll: '清空全部',
    historyClearAllConfirm: '确定清空全部历史记录？此操作不可撤销',
    settingsTitle: '设置',
    settingsLanguage: '界面语言',
    settingsService: '语音服务',
    settingsServiceUrl: '服务地址',
    settingsServiceUrlPlaceholder: 'http://localhost:8907',
    settingsServiceTimeout: '请求超时（秒）',
    settingsSave: '保存设置',
    settingsSaved: '设置已保存',
    settingsReset: '恢复默认',
    settingsAbout: '关于',
    settingsVersion: '版本',
    settingsPlatform: '平台',
    settingsArchitecture: '架构',
    errServiceUnavailable: '语音服务不可用，请检查服务是否启动',
    errCloneFailed: '声音克隆失败，请重试',
    errSynthFailed: '音频合成失败，请重试',
    errScriptFailed: '脚本生成失败，请重试',
    errInvalidUrl: '请输入有效的 URL',
    errEmptyText: '请输入文本内容',
    errNoFile: '请选择文件',
    errNoCloneName: '请输入克隆名称',
    errNoCloneAudio: '请选择参考音频',
    errNetwork: '网络错误，请检查服务是否运行',
    errTimeout: '请求超时',
    errCloneBusy: '语音合成服务正忙，请等待当前任务完成',
    errNoScript: '请先生成播客脚本',
    language: '语言',
    chinese: '中文',
    english: 'English',
    regenerate: '重新合成',
    play: '播放',
    pause: '暂停',
    download: '下载',
    downloadSuccess: '下载成功',
    delete: '删除',
    close: '关闭',
    cancel: '取消',
    confirm: '确认',
    noAudioGenerated: '尚未生成音频',
    synthesisComplete: '合成完成',
    selectVoice: '选择声音',
    useSystemVoice: '系统声音',
    useCloneVoice: '克隆声音',
    cloneNameRequired: '请输入克隆名称',
    audioFileRequired: '请选择音频文件',
    uploadAudio: '上传音频',
    previewLoading: '加载中...',
    playPreview: '试听',
    stopPreview: '停止',
    generatingScript: '正在生成脚本',
    synthesizingAudio: '正在合成音频',
    scriptGenerated: '脚本已生成',
    audioReady: '音频已就绪',
    words: '字',
    segments: '段',
    totalDuration: '总时长',
    deleteSuccess: '删除成功',
    clearSuccess: '已清空',
    saveSettingsFirst: '请先保存设置',
    serviceUrlChanged: '服务地址已更新，正在重新检测...',
    archInfo: '架构',
    appDescription: 'AI 驱动的播客生成工具，支持声音克隆和多语言',
    openSourceUrl: 'https://github.com/Aiven66/PodcastAI',
    noCloneYet: '暂无克隆声音',
    selectCloneOrSystem: '可选择系统声音或克隆声音',
    createCloneFirst: '请先创建克隆声音',
    podcastGenerated: '播客已生成',
    fileToLarge: '文件过大，请选择小于 50MB 的文件',
    unsupportedFormat: '不支持的文件格式',
    extractFileContent: '正在提取文件内容...',
    fetchingUrl: '正在抓取 URL 内容...',
    voice1Default: 'female-professional',
    voice2Default: 'male-narrator',
    // ─── 服务管理器 ───
    serviceManager: '服务管理',
    serviceManagerDesc: '管理本地 Python 语音服务（用于声音克隆和播客合成）',
    detectEnvironment: '检测环境',
    detecting: '检测中...',
    detected: '检测结果',
    pythonFound: 'Python 已安装',
    pythonNotFound: '未找到 Python（需要 3.10+）',
    pythonVersionLabel: 'Python 版本',
    pythonPathLabel: 'Python 路径',
    voiceServiceFound: '语音服务已安装',
    voiceServiceNotFound: '未找到语音服务目录',
    voiceServicePathLabel: '语音服务路径',
    voiceServiceSelectDir: '选择目录',
    voiceServiceDownload: '下载语音服务',
    voiceServiceDownloadHint: '从 GitHub 下载 voice-service 源码，然后安装 Python 依赖和 CosyVoice2 模型',
    modelsReady: 'CosyVoice2 模型已就绪',
    modelsNotReady: 'CosyVoice2 模型未下载（声音克隆需要）',
    startService: '启动服务',
    stopService: '停止服务',
    startingService: '启动中...',
    stoppingService: '停止中...',
    serviceStarted: '语音服务已启动',
    serviceStopped: '语音服务已停止',
    serviceStartFailed: '启动失败',
    serviceRunning: '服务运行中',
    serviceNotRunning: '服务未运行',
    autoStartService: '应用启动时自动启动服务',
    autoStartHint: '勾选后，打开桌面客户端会自动启动语音服务',
    serviceLogs: '服务日志',
    clearLogs: '清空日志',
    noLogs: '暂无日志',
    setupGuide: '设置向导',
    setupStep1: '1. 安装 Python 3.10+（推荐 3.11）',
    setupStep2: '2. 下载 voice-service 源码',
    setupStep3: '3. 创建虚拟环境：python3.11 -m venv venv',
    setupStep4: '4. 安装依赖：./venv/bin/pip install -r requirements.txt',
    setupStep5: '5. 下载 CosyVoice2 模型（运行 bash setup_cosyvoice.sh）',
    setupStep6: '6. 选择 voice-service 目录并点击启动服务',
    offlineBanner: '语音服务离线，无法进行声音克隆和播客合成',
    offlineBannerAction: '启动服务',
    goToSettings: '前往设置',
    processId: '进程 ID',
    selectVoiceServiceDir: '选择 voice-service 目录',
    serviceAutoDetected: '已自动检测到路径',
    pythonInstallUrl: 'https://www.python.org/downloads/',
    voiceServiceRepoUrl: 'https://github.com/Aiven66/PodcastAI',
    modelsPathHint: '模型路径：voice-service/CosyVoice/pretrained_models/CosyVoice2-0.5B',
    openInFinder: '在文件夹中显示',
    refreshDetection: '刷新检测',
    serviceStatusCheck: '检测服务状态',
    portConflict: '端口 8907 可能被占用，请检查是否有其他进程占用',
    // ─── 模型下载（v1.0.4） ───
    modelManager: '语音模型',
    modelManagerDesc: 'CosyVoice2 声音克隆模型（约 3.7GB，已内置，开箱即用）',
    modelStatus: '模型状态',
    modelReady: '模型已就绪',
    modelNotReady: '模型未下载',
    modelPartial: '部分下载',
    modelDownload: '下载模型',
    modelRedownload: '重新下载',
    modelAbort: '中止下载',
    modelDownloading: '下载中...',
    modelDownloadComplete: '模型下载完成',
    modelDownloadFailed: '模型下载失败',
    modelDownloadAborted: '已中止下载',
    modelCurrentFile: '当前文件',
    modelProgress: '总进度',
    modelSpeed: '下载速度',
    modelFiles: '文件',
    modelSize: '大小',
    modelOpenDir: '在文件夹中显示',
    modelAutoStartHint: '应用启动时会自动启动语音服务，无需手动配置',
    runtimeManager: 'Python 运行环境',
    runtimeManagerDesc: '内置 Python 运行时（安装包已剥离，首次启动自动下载并解压）',
    runtimeStatus: '运行时状态',
    runtimeReady: '已就绪',
    runtimeNotReady: '未安装',
    runtimeDownload: '下载运行环境',
    runtimeRedownload: '重新下载',
    runtimeAbort: '中止下载',
    runtimeDownloading: '下载中...',
    runtimeExtracting: '解压中...',
    runtimeVerifying: '校验中...',
    runtimeDownloadComplete: '运行环境就绪',
    runtimeDownloadFailed: '运行环境下载失败',
    runtimeDownloadAborted: '已中止下载',
    runtimeOpenDir: '在文件夹中显示',
    serviceAutoStarting: '语音服务正在启动中...',
  },
  en: {
    appName: 'PodcastAI',
    loading: 'Loading...',
    navPodcast: 'Podcast',
    navClone: 'Voice Clone',
    navHistory: 'History',
    navSettings: 'Settings',
    serviceStatus: 'Service',
    serviceOnline: 'Online',
    serviceOffline: 'Offline',
    serviceBusy: 'Busy',
    serviceCheckFailed: 'Failed',
    serviceHint: 'Please start the local Python voice service (default port 8907)',
    // v1.0.38: account info display
    currentAccount: 'Account',
    notLoggedIn: 'Not signed in',
    signOut: 'Sign out',
    switchAccount: 'Switch account',
    themeLabel: 'Theme',
    themeLight: 'Light',
    themeDark: 'Dark',
    podcastTitle: 'Generate Podcast',
    podcastSubtitle: 'Convert URLs, text, or files into high-quality podcasts',
    inputMethod: 'Input Method',
    inputUrl: 'URL Input',
    inputText: 'Text Input',
    inputFile: 'File Upload',
    urlLabel: 'Article URL',
    urlPlaceholder: 'Paste article URL (e.g. blog post URL)',
    textLabel: 'Text Content',
    textPlaceholder: 'Enter or paste text content to convert to podcast...',
    fileLabel: 'Upload File',
    fileDropHint: 'Click or drag file here',
    fileSupported: 'Supports PDF, Word, Markdown, TXT formats',
    fileSelected: 'File selected',
    fileChange: 'Change file',
    podcastOptions: 'Podcast Options',
    podcastType: 'Podcast Type',
    singleHost: 'Single Host',
    dualHost: 'Dual Host (Interview)',
    voiceSelect: 'Voice Selection',
    voiceHost: 'Host Voice',
    voiceGuest: 'Guest Voice',
    systemVoice: 'System Voice',
    cloneVoice: 'Cloned Voice',
    noCloneAvailable: 'No cloned voices yet. Please create one in the "Voice Clone" tab first',
    generate: 'Generate Podcast',
    generating: 'Generating',
    scriptGenerating: 'Generating script...',
    audioSynthesizing: 'Synthesizing audio...',
    segmentProgress: 'Synthesizing segment {current}/{total}',
    audioFinalizing: 'Finalizing audio, please wait...',
    scriptPreview: 'Script Preview',
    scriptEditHint: 'Edit the script after generation, then synthesize audio',
    audioPlayer: 'Audio Player',
    noAudio: 'No audio yet',
    duration: 'Duration',
    cloneTitle: 'Voice Cloning',
    cloneSubtitle: 'Clone your voice with CosyVoice2 model',
    cloneName: 'Clone Name',
    cloneNamePlaceholder: 'Give your cloned voice a name',
    cloneGender: 'Gender',
    cloneGenderAuto: 'Auto Detect',
    cloneGenderMale: 'Male',
    cloneGenderFemale: 'Female',
    cloneDescription: 'Description (optional)',
    cloneDescriptionPlaceholder: 'e.g. warm female, deep male',
    clonePromptText: 'Reference Text (optional, improves similarity)',
    clonePromptPlaceholder: 'Transcript of the audio (5-30 seconds)',
    cloneAudioFile: 'Reference Audio',
    cloneAudioHint: 'Upload 5-30 seconds of clear speech (wav/mp3/m4a)',
    cloneAudioSelected: 'Audio selected',
    startClone: 'Start Cloning',
    cloning: 'Cloning...',
    cloneSuccess: 'Clone created successfully',
    cloneFailed: 'Clone failed',
    cloneListTitle: 'My Cloned Voices',
    cloneEmpty: 'No cloned voices yet',
    clonePreview: 'Preview',
    cloneDelete: 'Delete',
    cloneDeleteConfirm: 'Delete this cloned voice?',
    historyTitle: 'History',
    historyEmpty: 'No podcasts generated yet',
    historyCreatedAt: 'Created at',
    historyDuration: 'Duration',
    historyScript: 'Script',
    historyPlay: 'Play',
    historyDownload: 'Download',
    historyDelete: 'Delete',
    historyDeleteConfirm: 'Delete this history record?',
    historyClearAll: 'Clear All',
    historyClearAllConfirm: 'Clear all history? This cannot be undone',
    settingsTitle: 'Settings',
    settingsLanguage: 'Interface Language',
    settingsService: 'Voice Service',
    settingsServiceUrl: 'Service URL',
    settingsServiceUrlPlaceholder: 'http://localhost:8907',
    settingsServiceTimeout: 'Request Timeout (seconds)',
    settingsSave: 'Save Settings',
    settingsSaved: 'Settings saved',
    settingsReset: 'Reset to Default',
    settingsAbout: 'About',
    settingsVersion: 'Version',
    settingsPlatform: 'Platform',
    settingsArchitecture: 'Architecture',
    errServiceUnavailable: 'Voice service unavailable. Please check if the service is running',
    errCloneFailed: 'Voice clone failed. Please try again',
    errSynthFailed: 'Audio synthesis failed. Please try again',
    errScriptFailed: 'Script generation failed. Please try again',
    errInvalidUrl: 'Please enter a valid URL',
    errEmptyText: 'Please enter text content',
    errNoFile: 'Please select a file',
    errNoCloneName: 'Please enter a clone name',
    errNoCloneAudio: 'Please select a reference audio',
    errNetwork: 'Network error. Please check if the service is running',
    errTimeout: 'Request timeout',
    errCloneBusy: 'Voice synthesis service is busy. Please wait for the current task to finish',
    errNoScript: 'Please generate the podcast script first',
    language: 'Language',
    chinese: '中文',
    english: 'English',
    regenerate: 'Re-synthesize',
    play: 'Play',
    pause: 'Pause',
    download: 'Download',
    downloadSuccess: 'Downloaded successfully',
    delete: 'Delete',
    close: 'Close',
    cancel: 'Cancel',
    confirm: 'Confirm',
    noAudioGenerated: 'No audio generated yet',
    synthesisComplete: 'Synthesis complete',
    selectVoice: 'Select Voice',
    useSystemVoice: 'System Voice',
    useCloneVoice: 'Cloned Voice',
    cloneNameRequired: 'Please enter a clone name',
    audioFileRequired: 'Please select an audio file',
    uploadAudio: 'Upload Audio',
    previewLoading: 'Loading...',
    playPreview: 'Preview',
    stopPreview: 'Stop',
    generatingScript: 'Generating script',
    synthesizingAudio: 'Synthesizing audio',
    scriptGenerated: 'Script generated',
    audioReady: 'Audio ready',
    words: 'words',
    segments: 'segments',
    totalDuration: 'Total Duration',
    deleteSuccess: 'Deleted',
    clearSuccess: 'Cleared',
    saveSettingsFirst: 'Please save settings first',
    serviceUrlChanged: 'Service URL updated, re-checking...',
    archInfo: 'Architecture',
    appDescription: 'AI-powered podcast generator with voice cloning and multi-language support',
    openSourceUrl: 'https://github.com/Aiven66/PodcastAI',
    noCloneYet: 'No cloned voices',
    selectCloneOrSystem: 'Choose system or cloned voice',
    createCloneFirst: 'Please create a cloned voice first',
    podcastGenerated: 'Podcast generated',
    fileToLarge: 'File too large. Please select a file under 50MB',
    unsupportedFormat: 'Unsupported file format',
    extractFileContent: 'Extracting file content...',
    fetchingUrl: 'Fetching URL content...',
    voice1Default: 'female-professional',
    voice2Default: 'male-narrator',
    // ─── Service Manager ───
    serviceManager: 'Service Manager',
    serviceManagerDesc: 'Manage the local Python voice service (for voice cloning and podcast synthesis)',
    detectEnvironment: 'Detect Environment',
    detecting: 'Detecting...',
    detected: 'Detection Result',
    pythonFound: 'Python installed',
    pythonNotFound: 'Python not found (3.10+ required)',
    pythonVersionLabel: 'Python Version',
    pythonPathLabel: 'Python Path',
    voiceServiceFound: 'Voice service installed',
    voiceServiceNotFound: 'Voice service directory not found',
    voiceServicePathLabel: 'Voice Service Path',
    voiceServiceSelectDir: 'Select Directory',
    voiceServiceDownload: 'Download Voice Service',
    voiceServiceDownloadHint: 'Download voice-service source from GitHub, then install Python dependencies and CosyVoice2 models',
    modelsReady: 'CosyVoice2 models ready',
    modelsNotReady: 'CosyVoice2 models not downloaded (required for voice cloning)',
    startService: 'Start Service',
    stopService: 'Stop Service',
    startingService: 'Starting...',
    stoppingService: 'Stopping...',
    serviceStarted: 'Voice service started',
    serviceStopped: 'Voice service stopped',
    serviceStartFailed: 'Failed to start',
    serviceRunning: 'Service running',
    serviceNotRunning: 'Service not running',
    autoStartService: 'Auto-start service on app launch',
    autoStartHint: 'When checked, the voice service starts automatically when the desktop app opens',
    serviceLogs: 'Service Logs',
    clearLogs: 'Clear Logs',
    noLogs: 'No logs yet',
    setupGuide: 'Setup Guide',
    setupStep1: '1. Install Python 3.10+ (3.11 recommended)',
    setupStep2: '2. Download voice-service source code',
    setupStep3: '3. Create virtual env: python3.11 -m venv venv',
    setupStep4: '4. Install deps: ./venv/bin/pip install -r requirements.txt',
    setupStep5: '5. Download CosyVoice2 models (run bash setup_cosyvoice.sh)',
    setupStep6: '6. Select voice-service directory and click Start Service',
    offlineBanner: 'Voice service offline. Voice cloning and podcast synthesis are unavailable.',
    offlineBannerAction: 'Start Service',
    goToSettings: 'Go to Settings',
    processId: 'PID',
    selectVoiceServiceDir: 'Select voice-service directory',
    serviceAutoDetected: 'Path auto-detected',
    pythonInstallUrl: 'https://www.python.org/downloads/',
    voiceServiceRepoUrl: 'https://github.com/Aiven66/PodcastAI',
    modelsPathHint: 'Model path: voice-service/CosyVoice/pretrained_models/CosyVoice2-0.5B',
    openInFinder: 'Show in Folder',
    refreshDetection: 'Refresh Detection',
    serviceStatusCheck: 'Check Service Status',
    portConflict: 'Port 8907 may be in use. Check if another process is using it.',
    // ─── Model Download (v1.0.4) ───
    modelManager: 'Voice Model',
    modelManagerDesc: 'CosyVoice2 voice cloning model (~3.7GB, pre-bundled, ready out of the box)',
    modelStatus: 'Model Status',
    modelReady: 'Model ready',
    modelNotReady: 'Model not downloaded',
    modelPartial: 'Partially downloaded',
    modelDownload: 'Download Model',
    modelRedownload: 'Re-download',
    modelAbort: 'Abort',
    modelDownloading: 'Downloading...',
    modelDownloadComplete: 'Model download complete',
    modelDownloadFailed: 'Model download failed',
    modelDownloadAborted: 'Download aborted',
    modelCurrentFile: 'Current file',
    modelProgress: 'Progress',
    modelSpeed: 'Speed',
    modelFiles: 'Files',
    modelSize: 'Size',
    modelOpenDir: 'Show in Folder',
    modelAutoStartHint: 'Voice service starts automatically on app launch — no manual setup needed',
    runtimeManager: 'Python Runtime',
    runtimeManagerDesc: 'Bundled Python runtime (stripped from installer, auto-downloads & extracts on first launch)',
    runtimeStatus: 'Runtime Status',
    runtimeReady: 'Ready',
    runtimeNotReady: 'Not installed',
    runtimeDownload: 'Download Runtime',
    runtimeRedownload: 'Re-download',
    runtimeAbort: 'Abort',
    runtimeDownloading: 'Downloading...',
    runtimeExtracting: 'Extracting...',
    runtimeVerifying: 'Verifying...',
    runtimeDownloadComplete: 'Runtime ready',
    runtimeDownloadFailed: 'Runtime download failed',
    runtimeDownloadAborted: 'Download aborted',
    runtimeOpenDir: 'Show in Folder',
    serviceAutoStarting: 'Voice service is starting...',
  },

  // ─── 日本語 ───
  ja: {
    appName: 'PodcastAI',
    loading: '読み込み中...',
    navPodcast: 'ポッドキャスト生成',
    navClone: 'ボイスクローン',
    navHistory: '履歴',
    navSettings: '設定',
    serviceStatus: 'サービス状態',
    serviceOnline: 'オンライン',
    serviceOffline: 'オフライン',
    serviceBusy: '合成中',
    serviceCheckFailed: '検出失敗',
    serviceHint: 'ローカル Python 音声サービスを起動してください（デフォルトポート 8907）',
    currentAccount: 'アカウント',
    notLoggedIn: '未ログイン',
    signOut: 'ログアウト',
    switchAccount: 'アカウント切替',
    themeLabel: 'テーマ',
    themeLight: 'ライト',
    themeDark: 'ダーク',
    podcastTitle: 'ポッドキャスト生成',
    podcastSubtitle: 'URL・テキスト・ファイルを高品質なポッドキャストに変換',
    inputMethod: '入力方法',
    inputUrl: 'URL入力',
    inputText: 'テキスト入力',
    inputFile: 'ファイルアップロード',
    urlLabel: '記事URL',
    urlPlaceholder: '記事のURLを貼り付け（例：ブログ記事のURL）',
    textLabel: 'テキスト内容',
    textPlaceholder: 'ポッドキャストに変換するテキストを入力または貼り付け...',
    fileLabel: 'ファイルアップロード',
    fileDropHint: 'クリックまたはファイルをここにドラッグ',
    fileSupported: 'PDF、Word、Markdown、TXT 形式に対応',
    fileSelected: 'ファイル選択済み',
    fileChange: 'ファイルを変更',
    podcastOptions: 'ポッドキャストオプション',
    podcastType: 'ポッドキャストタイプ',
    singleHost: '単独ホスト',
    dualHost: '2人対談（インタビュー）',
    voiceSelect: '音声選択',
    voiceHost: 'ホストの音声',
    voiceGuest: 'ゲストの音声',
    systemVoice: 'システム音声',
    cloneVoice: 'クローン音声',
    noCloneAvailable: 'クローン音声がまだありません。先に「ボイスクローン」タブで作成してください',
    generate: 'ポッドキャストを生成',
    generating: '生成中',
    scriptGenerating: 'スクリプト生成中...',
    audioSynthesizing: '音声合成中...',
    segmentProgress: 'セグメント {current}/{total} を合成中',
    audioFinalizing: '最終音声を合成中です。お待ちください...',
    scriptPreview: 'スクリプトプレビュー',
    scriptEditHint: '生成後にスクリプトを編集してから音声を合成できます',
    audioPlayer: 'オーディオプレーヤー',
    noAudio: '音声はまだありません',
    duration: '長さ',
    cloneTitle: 'ボイスクローン',
    cloneSubtitle: 'CosyVoice2 モデルであなたの声をクローン',
    cloneName: 'クローン名',
    cloneNamePlaceholder: 'クローン音声に名前を付ける',
    cloneGender: '性別',
    cloneGenderAuto: '自動検出',
    cloneGenderMale: '男性',
    cloneGenderFemale: '女性',
    cloneDescription: '説明（任意）',
    cloneDescriptionPlaceholder: '例：温かみのある女性、低音の男性',
    clonePromptText: '参照テキスト（任意、類似度向上）',
    clonePromptPlaceholder: '音声の書き起こし（5〜30秒）',
    cloneAudioFile: '参照音声',
    cloneAudioHint: '5〜30秒の鮮明な話し声をアップロード（wav/mp3/m4a）',
    cloneAudioSelected: '音声選択済み',
    startClone: 'クローン開始',
    cloning: 'クローン中...',
    cloneSuccess: 'クローン作成に成功しました',
    cloneFailed: 'クローンに失敗しました',
    cloneListTitle: 'マイクローン音声',
    cloneEmpty: 'クローン音声はまだありません',
    clonePreview: '試聴',
    cloneDelete: '削除',
    cloneDeleteConfirm: 'このクローン音声を削除しますか？',
    historyTitle: '履歴',
    historyEmpty: '生成したポッドキャストはまだありません',
    historyCreatedAt: '作成日時',
    historyDuration: '長さ',
    historyScript: 'スクリプト',
    historyPlay: '再生',
    historyDownload: 'ダウンロード',
    historyDelete: '削除',
    historyDeleteConfirm: 'この履歴を削除しますか？',
    historyClearAll: 'すべて削除',
    historyClearAllConfirm: 'すべての履歴を削除しますか？この操作は元に戻せません',
    settingsTitle: '設定',
    settingsLanguage: '表示言語',
    settingsService: '音声サービス',
    settingsServiceUrl: 'サービスURL',
    settingsServiceUrlPlaceholder: 'http://localhost:8907',
    settingsServiceTimeout: 'リクエストタイムアウト（秒）',
    settingsSave: '設定を保存',
    settingsSaved: '設定を保存しました',
    settingsReset: 'デフォルトに戻す',
    settingsAbout: 'このアプリについて',
    settingsVersion: 'バージョン',
    settingsPlatform: 'プラットフォーム',
    settingsArchitecture: 'アーキテクチャ',
    errServiceUnavailable: '音声サービスを利用できません。サービスが起動しているか確認してください',
    errCloneFailed: 'ボイスクローンに失敗しました。再試行してください',
    errSynthFailed: '音声合成に失敗しました。再試行してください',
    errScriptFailed: 'スクリプト生成に失敗しました。再試行してください',
    errInvalidUrl: '有効なURLを入力してください',
    errEmptyText: 'テキストを入力してください',
    errNoFile: 'ファイルを選択してください',
    errNoCloneName: 'クローン名を入力してください',
    errNoCloneAudio: '参照音声を選択してください',
    errNetwork: 'ネットワークエラー。サービスが実行中か確認してください',
    errTimeout: 'リクエストタイムアウト',
    errCloneBusy: '音声合成サービスがビジー状態です。現在のタスクの完了をお待ちください',
    errNoScript: '先にポッドキャストスクリプトを生成してください',
    language: '言語',
    chinese: '中文',
    english: 'English',
    regenerate: '再合成',
    play: '再生',
    pause: '一時停止',
    download: 'ダウンロード',
    downloadSuccess: 'ダウンロードしました',
    delete: '削除',
    close: '閉じる',
    cancel: 'キャンセル',
    confirm: '確認',
    noAudioGenerated: '音声はまだ生成されていません',
    synthesisComplete: '合成完了',
    selectVoice: '音声を選択',
    useSystemVoice: 'システム音声',
    useCloneVoice: 'クローン音声',
    cloneNameRequired: 'クローン名を入力してください',
    audioFileRequired: '音声ファイルを選択してください',
    uploadAudio: '音声をアップロード',
    previewLoading: '読み込み中...',
    playPreview: '試聴',
    stopPreview: '停止',
    generatingScript: 'スクリプト生成中',
    synthesizingAudio: '音声合成中',
    scriptGenerated: 'スクリプト生成済み',
    audioReady: '音声の準備完了',
    words: '語',
    segments: 'セグメント',
    totalDuration: '総時間',
    deleteSuccess: '削除しました',
    clearSuccess: 'クリアしました',
    saveSettingsFirst: '先に設定を保存してください',
    serviceUrlChanged: 'サービスURLを更新しました。再検出中...',
    archInfo: 'アーキテクチャ',
    appDescription: 'ボイスクローンと多言語対応のAIポッドキャスト生成ツール',
    openSourceUrl: 'https://github.com/Aiven66/PodcastAI',
    noCloneYet: 'クローン音声はまだありません',
    selectCloneOrSystem: 'システム音声またはクローン音声を選択',
    createCloneFirst: '先にクローン音声を作成してください',
    podcastGenerated: 'ポッドキャストを生成しました',
    fileToLarge: 'ファイルが大きすぎます。50MB未満のファイルを選択してください',
    unsupportedFormat: 'サポートされていないファイル形式です',
    extractFileContent: 'ファイル内容を抽出中...',
    fetchingUrl: 'URLの内容を取得中...',
    voice1Default: 'female-professional',
    voice2Default: 'male-narrator',
    serviceManager: 'サービス管理',
    serviceManagerDesc: 'ローカル Python 音声サービスを管理（ボイスクローンとポッドキャスト合成用）',
    detectEnvironment: '環境検出',
    detecting: '検出中...',
    detected: '検出結果',
    pythonFound: 'Python インストール済み',
    pythonNotFound: 'Python が見つかりません（3.10+ が必要）',
    pythonVersionLabel: 'Python バージョン',
    pythonPathLabel: 'Python パス',
    voiceServiceFound: '音声サービスはインストール済み',
    voiceServiceNotFound: '音声サービスのディレクトリが見つかりません',
    voiceServicePathLabel: '音声サービスのパス',
    voiceServiceSelectDir: 'ディレクトリを選択',
    voiceServiceDownload: '音声サービスをダウンロード',
    voiceServiceDownloadHint: 'GitHub から voice-service のソースをダウンロードし、Python 依存パッケージと CosyVoice2 モデルをインストールします',
    modelsReady: 'CosyVoice2 モデルの準備完了',
    modelsNotReady: 'CosyVoice2 モデルが未ダウンロード（ボイスクローンに必要）',
    startService: 'サービス開始',
    stopService: 'サービス停止',
    startingService: '開始中...',
    stoppingService: '停止中...',
    serviceStarted: '音声サービスを開始しました',
    serviceStopped: '音声サービスを停止しました',
    serviceStartFailed: '開始に失敗しました',
    serviceRunning: 'サービス実行中',
    serviceNotRunning: 'サービス停止中',
    autoStartService: 'アプリ起動時にサービスを自動開始',
    autoStartHint: 'チェックすると、デスクトップアプリを開いたときに音声サービスが自動的に起動します',
    serviceLogs: 'サービスログ',
    clearLogs: 'ログをクリア',
    noLogs: 'ログはまだありません',
    setupGuide: 'セットアップガイド',
    setupStep1: '1. Python 3.10+ をインストール（3.11 推奨）',
    setupStep2: '2. voice-service のソースコードをダウンロード',
    setupStep3: '3. 仮想環境を作成：python3.11 -m venv venv',
    setupStep4: '4. 依存パッケージをインストール：./venv/bin/pip install -r requirements.txt',
    setupStep5: '5. CosyVoice2 モデルをダウンロード（bash setup_cosyvoice.sh を実行）',
    setupStep6: '6. voice-service のディレクトリを選択して「サービス開始」をクリック',
    offlineBanner: '音声サービスがオフラインです。ボイスクローンとポッドキャスト合成は利用できません。',
    offlineBannerAction: 'サービスを開始',
    goToSettings: '設定へ移動',
    processId: 'プロセス ID',
    selectVoiceServiceDir: 'voice-service のディレクトリを選択',
    serviceAutoDetected: 'パスを自動検出しました',
    pythonInstallUrl: 'https://www.python.org/downloads/',
    voiceServiceRepoUrl: 'https://github.com/Aiven66/PodcastAI',
    modelsPathHint: 'モデルパス：voice-service/CosyVoice/pretrained_models/CosyVoice2-0.5B',
    openInFinder: 'フォルダで表示',
    refreshDetection: '再検出',
    serviceStatusCheck: 'サービス状態を確認',
    portConflict: 'ポート 8907 が使用中の可能性があります。他のプロセスが使用していないか確認してください',
    modelManager: '音声モデル',
    modelManagerDesc: 'CosyVoice2 ボイスクローンモデル（約3.7GB、同梱済み、すぐに使用可能）',
    modelStatus: 'モデル状態',
    modelReady: 'モデル準備完了',
    modelNotReady: 'モデル未ダウンロード',
    modelPartial: '一部ダウンロード済み',
    modelDownload: 'モデルをダウンロード',
    modelRedownload: '再ダウンロード',
    modelAbort: '中止',
    modelDownloading: 'ダウンロード中...',
    modelDownloadComplete: 'モデルのダウンロードが完了しました',
    modelDownloadFailed: 'モデルのダウンロードに失敗しました',
    modelDownloadAborted: 'ダウンロードを中止しました',
    modelCurrentFile: '現在のファイル',
    modelProgress: '進捗',
    modelSpeed: '速度',
    modelFiles: 'ファイル',
    modelSize: 'サイズ',
    modelOpenDir: 'フォルダで表示',
    modelAutoStartHint: 'アプリ起動時に音声サービスが自動的に起動します。手動設定は不要です',
    runtimeManager: 'Python ランタイム',
    runtimeManagerDesc: '内蔵 Python ランタイム（インストーラーから除外済み、初回起動時に自動ダウンロード・解凍）',
    runtimeStatus: 'ランタイム状態',
    runtimeReady: '利用可能',
    runtimeNotReady: '未インストール',
    runtimeDownload: 'ランタイムをダウンロード',
    runtimeRedownload: '再ダウンロード',
    runtimeAbort: '中止',
    runtimeDownloading: 'ダウンロード中...',
    runtimeExtracting: '解凍中...',
    runtimeVerifying: '検証中...',
    runtimeDownloadComplete: 'ランタイム準備完了',
    runtimeDownloadFailed: 'ランタイムのダウンロードに失敗しました',
    runtimeDownloadAborted: 'ダウンロードを中止しました',
    runtimeOpenDir: 'フォルダで表示',
    serviceAutoStarting: '音声サービスを起動中...',
  },

  // ─── 한국어 ───
  ko: {
    appName: 'PodcastAI',
    loading: '로딩 중...',
    navPodcast: '팟캐스트 생성',
    navClone: '보이스 클론',
    navHistory: '기록',
    navSettings: '설정',
    serviceStatus: '서비스 상태',
    serviceOnline: '온라인',
    serviceOffline: '오프라인',
    serviceBusy: '합성 중',
    serviceCheckFailed: '확인 실패',
    serviceHint: '로컬 Python 음성 서비스를 시작해 주세요 (기본 포트 8907)',
    currentAccount: '계정',
    notLoggedIn: '로그인되지 않음',
    signOut: '로그아웃',
    switchAccount: '계정 전환',
    themeLabel: '테마',
    themeLight: '라이트',
    themeDark: '다크',
    podcastTitle: '팟캐스트 생성',
    podcastSubtitle: 'URL, 텍스트, 파일을 고품질 팟캐스트로 변환',
    inputMethod: '입력 방식',
    inputUrl: 'URL 입력',
    inputText: '텍스트 입력',
    inputFile: '파일 업로드',
    urlLabel: '기사 URL',
    urlPlaceholder: '기사 URL을 붙여넣으세요 (예: 블로그 게시물 URL)',
    textLabel: '텍스트 내용',
    textPlaceholder: '팟캐스트로 변환할 텍스트를 입력하거나 붙여넣으세요...',
    fileLabel: '파일 업로드',
    fileDropHint: '클릭하거나 파일을 여기로 드래그하세요',
    fileSupported: 'PDF, Word, Markdown, TXT 형식 지원',
    fileSelected: '파일 선택됨',
    fileChange: '파일 변경',
    podcastOptions: '팟캐스트 옵션',
    podcastType: '팟캐스트 유형',
    singleHost: '단독 진행',
    dualHost: '2인 대담 (인터뷰)',
    voiceSelect: '음성 선택',
    voiceHost: '진행자 음성',
    voiceGuest: '게스트 음성',
    systemVoice: '시스템 음성',
    cloneVoice: '클론 음성',
    noCloneAvailable: '아직 클론 음성이 없습니다. 먼저 "보이스 클론" 탭에서 만들어 주세요',
    generate: '팟캐스트 생성',
    generating: '생성 중',
    scriptGenerating: '스크립트 생성 중...',
    audioSynthesizing: '오디오 합성 중...',
    segmentProgress: '세그먼트 {current}/{total} 합성 중',
    audioFinalizing: '최종 오디오를 합성하는 중입니다. 잠시만 기다려 주세요...',
    scriptPreview: '스크립트 미리보기',
    scriptEditHint: '생성 후 스크립트를 편집한 뒤 오디오를 합성할 수 있습니다',
    audioPlayer: '오디오 플레이어',
    noAudio: '아직 오디오가 없습니다',
    duration: '길이',
    cloneTitle: '보이스 클론',
    cloneSubtitle: 'CosyVoice2 모델로 목소리를 복제하세요',
    cloneName: '클론 이름',
    cloneNamePlaceholder: '클론 음성의 이름을 지어 주세요',
    cloneGender: '성별',
    cloneGenderAuto: '자동 감지',
    cloneGenderMale: '남성',
    cloneGenderFemale: '여성',
    cloneDescription: '설명 (선택)',
    cloneDescriptionPlaceholder: '예: 부드러운 여성, 낮은 남성',
    clonePromptText: '참조 텍스트 (선택, 유사도 향상)',
    clonePromptPlaceholder: '오디오의 스크립트 (5~30초)',
    cloneAudioFile: '참조 오디오',
    cloneAudioHint: '5~30초의 선명한 말소리를 업로드하세요 (wav/mp3/m4a)',
    cloneAudioSelected: '오디오 선택됨',
    startClone: '클론 시작',
    cloning: '클론 중...',
    cloneSuccess: '클론이 생성되었습니다',
    cloneFailed: '클론에 실패했습니다',
    cloneListTitle: '내 클론 음성',
    cloneEmpty: '아직 클론 음성이 없습니다',
    clonePreview: '미리듣기',
    cloneDelete: '삭제',
    cloneDeleteConfirm: '이 클론 음성을 삭제할까요?',
    historyTitle: '기록',
    historyEmpty: '아직 생성된 팟캐스트가 없습니다',
    historyCreatedAt: '생성일',
    historyDuration: '길이',
    historyScript: '스크립트',
    historyPlay: '재생',
    historyDownload: '다운로드',
    historyDelete: '삭제',
    historyDeleteConfirm: '이 기록을 삭제할까요?',
    historyClearAll: '전체 삭제',
    historyClearAllConfirm: '모든 기록을 삭제할까요? 되돌릴 수 없습니다',
    settingsTitle: '설정',
    settingsLanguage: '인터페이스 언어',
    settingsService: '음성 서비스',
    settingsServiceUrl: '서비스 URL',
    settingsServiceUrlPlaceholder: 'http://localhost:8907',
    settingsServiceTimeout: '요청 시간 초과 (초)',
    settingsSave: '설정 저장',
    settingsSaved: '설정이 저장되었습니다',
    settingsReset: '기본값으로 되돌리기',
    settingsAbout: '정보',
    settingsVersion: '버전',
    settingsPlatform: '플랫폼',
    settingsArchitecture: '아키텍처',
    errServiceUnavailable: '음성 서비스를 사용할 수 없습니다. 서비스가 실행 중인지 확인하세요',
    errCloneFailed: '보이스 클론에 실패했습니다. 다시 시도해 주세요',
    errSynthFailed: '오디오 합성에 실패했습니다. 다시 시도해 주세요',
    errScriptFailed: '스크립트 생성에 실패했습니다. 다시 시도해 주세요',
    errInvalidUrl: '유효한 URL을 입력해 주세요',
    errEmptyText: '텍스트를 입력해 주세요',
    errNoFile: '파일을 선택해 주세요',
    errNoCloneName: '클론 이름을 입력해 주세요',
    errNoCloneAudio: '참조 오디오를 선택해 주세요',
    errNetwork: '네트워크 오류입니다. 서비스가 실행 중인지 확인하세요',
    errTimeout: '요청 시간 초과',
    errCloneBusy: '음성 합성 서비스가 사용 중입니다. 현재 작업이 끝날 때까지 기다려 주세요',
    errNoScript: '먼저 팟캐스트 스크립트를 생성해 주세요',
    language: '언어',
    chinese: '中文',
    english: 'English',
    regenerate: '다시 합성',
    play: '재생',
    pause: '일시정지',
    download: '다운로드',
    downloadSuccess: '다운로드 완료',
    delete: '삭제',
    close: '닫기',
    cancel: '취소',
    confirm: '확인',
    noAudioGenerated: '아직 오디오가 생성되지 않았습니다',
    synthesisComplete: '합성 완료',
    selectVoice: '음성 선택',
    useSystemVoice: '시스템 음성',
    useCloneVoice: '클론 음성',
    cloneNameRequired: '클론 이름을 입력해 주세요',
    audioFileRequired: '오디오 파일을 선택해 주세요',
    uploadAudio: '오디오 업로드',
    previewLoading: '로딩 중...',
    playPreview: '미리듣기',
    stopPreview: '정지',
    generatingScript: '스크립트 생성 중',
    synthesizingAudio: '오디오 합성 중',
    scriptGenerated: '스크립트 생성됨',
    audioReady: '오디오 준비 완료',
    words: '단어',
    segments: '세그먼트',
    totalDuration: '총 길이',
    deleteSuccess: '삭제되었습니다',
    clearSuccess: '비웠습니다',
    saveSettingsFirst: '먼저 설정을 저장해 주세요',
    serviceUrlChanged: '서비스 URL이 업데이트되었습니다. 다시 확인하는 중...',
    archInfo: '아키텍처',
    appDescription: '보이스 클론과 다국어를 지원하는 AI 팟캐스트 생성 도구',
    openSourceUrl: 'https://github.com/Aiven66/PodcastAI',
    noCloneYet: '클론 음성 없음',
    selectCloneOrSystem: '시스템 음성 또는 클론 음성을 선택하세요',
    createCloneFirst: '먼저 클론 음성을 만들어 주세요',
    podcastGenerated: '팟캐스트가 생성되었습니다',
    fileToLarge: '파일이 너무 큽니다. 50MB 미만의 파일을 선택해 주세요',
    unsupportedFormat: '지원되지 않는 파일 형식입니다',
    extractFileContent: '파일 내용을 추출하는 중...',
    fetchingUrl: 'URL 내용을 가져오는 중...',
    voice1Default: 'female-professional',
    voice2Default: 'male-narrator',
    serviceManager: '서비스 관리',
    serviceManagerDesc: '로컬 Python 음성 서비스 관리 (보이스 클론 및 팟캐스트 합성용)',
    detectEnvironment: '환경 감지',
    detecting: '감지 중...',
    detected: '감지 결과',
    pythonFound: 'Python 설치됨',
    pythonNotFound: 'Python을 찾을 수 없습니다 (3.10+ 필요)',
    pythonVersionLabel: 'Python 버전',
    pythonPathLabel: 'Python 경로',
    voiceServiceFound: '음성 서비스가 설치되어 있습니다',
    voiceServiceNotFound: '음성 서비스 디렉터리를 찾을 수 없습니다',
    voiceServicePathLabel: '음성 서비스 경로',
    voiceServiceSelectDir: '디렉터리 선택',
    voiceServiceDownload: '음성 서비스 다운로드',
    voiceServiceDownloadHint: 'GitHub에서 voice-service 소스를 다운로드한 뒤 Python 의존성과 CosyVoice2 모델을 설치합니다',
    modelsReady: 'CosyVoice2 모델 준비 완료',
    modelsNotReady: 'CosyVoice2 모델이 다운로드되지 않았습니다 (보이스 클론에 필요)',
    startService: '서비스 시작',
    stopService: '서비스 중지',
    startingService: '시작 중...',
    stoppingService: '중지 중...',
    serviceStarted: '음성 서비스가 시작되었습니다',
    serviceStopped: '음성 서비스가 중지되었습니다',
    serviceStartFailed: '시작 실패',
    serviceRunning: '서비스 실행 중',
    serviceNotRunning: '서비스 중지됨',
    autoStartService: '앱 시작 시 서비스 자동 시작',
    autoStartHint: '선택하면 데스크톱 앱을 열 때 음성 서비스가 자동으로 시작됩니다',
    serviceLogs: '서비스 로그',
    clearLogs: '로그 지우기',
    noLogs: '로그가 없습니다',
    setupGuide: '설정 가이드',
    setupStep1: '1. Python 3.10+ 설치 (3.11 권장)',
    setupStep2: '2. voice-service 소스 코드 다운로드',
    setupStep3: '3. 가상 환경 생성: python3.11 -m venv venv',
    setupStep4: '4. 의존성 설치: ./venv/bin/pip install -r requirements.txt',
    setupStep5: '5. CosyVoice2 모델 다운로드 (bash setup_cosyvoice.sh 실행)',
    setupStep6: '6. voice-service 디렉터리를 선택하고 서비스 시작 클릭',
    offlineBanner: '음성 서비스가 오프라인입니다. 보이스 클론과 팟캐스트 합성을 사용할 수 없습니다.',
    offlineBannerAction: '서비스 시작',
    goToSettings: '설정으로 이동',
    processId: '프로세스 ID',
    selectVoiceServiceDir: 'voice-service 디렉터리 선택',
    serviceAutoDetected: '경로가 자동 감지되었습니다',
    pythonInstallUrl: 'https://www.python.org/downloads/',
    voiceServiceRepoUrl: 'https://github.com/Aiven66/PodcastAI',
    modelsPathHint: '모델 경로: voice-service/CosyVoice/pretrained_models/CosyVoice2-0.5B',
    openInFinder: '폴더에서 보기',
    refreshDetection: '다시 감지',
    serviceStatusCheck: '서비스 상태 확인',
    portConflict: '포트 8907이 사용 중일 수 있습니다. 다른 프로세스가 사용 중인지 확인하세요',
    modelManager: '음성 모델',
    modelManagerDesc: 'CosyVoice2 보이스 클론 모델 (약 3.7GB, 내장됨, 바로 사용 가능)',
    modelStatus: '모델 상태',
    modelReady: '모델 준비 완료',
    modelNotReady: '모델이 다운로드되지 않았습니다',
    modelPartial: '일부 다운로드됨',
    modelDownload: '모델 다운로드',
    modelRedownload: '다시 다운로드',
    modelAbort: '중단',
    modelDownloading: '다운로드 중...',
    modelDownloadComplete: '모델 다운로드 완료',
    modelDownloadFailed: '모델 다운로드 실패',
    modelDownloadAborted: '다운로드가 중단되었습니다',
    modelCurrentFile: '현재 파일',
    modelProgress: '진행률',
    modelSpeed: '속도',
    modelFiles: '파일',
    modelSize: '크기',
    modelOpenDir: '폴더에서 보기',
    modelAutoStartHint: '앱 시작 시 음성 서비스가 자동으로 시작됩니다. 수동 설정이 필요 없습니다',
    runtimeManager: 'Python 런타임',
    runtimeManagerDesc: '내장 Python 런타임 (설치 프로그램에서 제외, 첫 실행 시 자동 다운로드·압축 해제)',
    runtimeStatus: '런타임 상태',
    runtimeReady: '준비 완료',
    runtimeNotReady: '설치되지 않음',
    runtimeDownload: '런타임 다운로드',
    runtimeRedownload: '다시 다운로드',
    runtimeAbort: '중단',
    runtimeDownloading: '다운로드 중...',
    runtimeExtracting: '압축 해제 중...',
    runtimeVerifying: '검증 중...',
    runtimeDownloadComplete: '런타임 준비 완료',
    runtimeDownloadFailed: '런타임 다운로드 실패',
    runtimeDownloadAborted: '다운로드가 중단되었습니다',
    runtimeOpenDir: '폴더에서 표시',
    serviceAutoStarting: '음성 서비스를 시작하는 중...',
  },

  // ─── Español ───
  es: {
    appName: 'PodcastAI',
    loading: 'Cargando...',
    navPodcast: 'Generar podcast',
    navClone: 'Clonar voz',
    navHistory: 'Historial',
    navSettings: 'Ajustes',
    serviceStatus: 'Estado del servicio',
    serviceOnline: 'En línea',
    serviceOffline: 'Sin conexión',
    serviceBusy: 'Sintetizando',
    serviceCheckFailed: 'Error al comprobar',
    serviceHint: 'Inicie el servicio de voz Python local (puerto predeterminado 8907)',
    currentAccount: 'Cuenta',
    notLoggedIn: 'No has iniciado sesión',
    signOut: 'Cerrar sesión',
    switchAccount: 'Cambiar de cuenta',
    themeLabel: 'Tema',
    themeLight: 'Claro',
    themeDark: 'Oscuro',
    podcastTitle: 'Generar podcast',
    podcastSubtitle: 'Convierte URLs, texto o archivos en podcasts de alta calidad',
    inputMethod: 'Método de entrada',
    inputUrl: 'Introducir URL',
    inputText: 'Introducir texto',
    inputFile: 'Subir archivo',
    urlLabel: 'URL del artículo',
    urlPlaceholder: 'Pega la URL del artículo (p. ej., la URL de una entrada de blog)',
    textLabel: 'Contenido de texto',
    textPlaceholder: 'Introduce o pega el texto que quieres convertir en podcast...',
    fileLabel: 'Subir archivo',
    fileDropHint: 'Haz clic o arrastra el archivo aquí',
    fileSupported: 'Admite formatos PDF, Word, Markdown y TXT',
    fileSelected: 'Archivo seleccionado',
    fileChange: 'Cambiar archivo',
    podcastOptions: 'Opciones del podcast',
    podcastType: 'Tipo de podcast',
    singleHost: 'Un solo presentador',
    dualHost: 'Dos presentadores (entrevista)',
    voiceSelect: 'Selección de voz',
    voiceHost: 'Voz del presentador',
    voiceGuest: 'Voz del invitado',
    systemVoice: 'Voz del sistema',
    cloneVoice: 'Voz clonada',
    noCloneAvailable: 'Aún no hay voces clonadas. Crea una primero en la pestaña "Clonar voz"',
    generate: 'Generar podcast',
    generating: 'Generando',
    scriptGenerating: 'Generando guion...',
    audioSynthesizing: 'Sintetizando audio...',
    segmentProgress: 'Sintetizando segmento {current}/{total}',
    audioFinalizing: 'Finalizando el audio, espera...',
    scriptPreview: 'Vista previa del guion',
    scriptEditHint: 'Edita el guion tras generarlo y luego sintetiza el audio',
    audioPlayer: 'Reproductor de audio',
    noAudio: 'Aún no hay audio',
    duration: 'Duración',
    cloneTitle: 'Clonación de voz',
    cloneSubtitle: 'Clona tu voz con el modelo CosyVoice2',
    cloneName: 'Nombre del clon',
    cloneNamePlaceholder: 'Ponle un nombre a tu voz clonada',
    cloneGender: 'Género',
    cloneGenderAuto: 'Detección automática',
    cloneGenderMale: 'Masculino',
    cloneGenderFemale: 'Femenino',
    cloneDescription: 'Descripción (opcional)',
    cloneDescriptionPlaceholder: 'p. ej., voz femenina cálida, voz masculina grave',
    clonePromptText: 'Texto de referencia (opcional, mejora la similitud)',
    clonePromptPlaceholder: 'Transcripción del audio (5-30 segundos)',
    cloneAudioFile: 'Audio de referencia',
    cloneAudioHint: 'Sube de 5 a 30 segundos de voz clara (wav/mp3/m4a)',
    cloneAudioSelected: 'Audio seleccionado',
    startClone: 'Iniciar clonación',
    cloning: 'Clonando...',
    cloneSuccess: 'Clon creado correctamente',
    cloneFailed: 'Error al clonar',
    cloneListTitle: 'Mis voces clonadas',
    cloneEmpty: 'Aún no hay voces clonadas',
    clonePreview: 'Escuchar',
    cloneDelete: 'Eliminar',
    cloneDeleteConfirm: '¿Eliminar esta voz clonada?',
    historyTitle: 'Historial',
    historyEmpty: 'Todavía no has generado podcasts',
    historyCreatedAt: 'Creado el',
    historyDuration: 'Duración',
    historyScript: 'Guion',
    historyPlay: 'Reproducir',
    historyDownload: 'Descargar',
    historyDelete: 'Eliminar',
    historyDeleteConfirm: '¿Eliminar este registro del historial?',
    historyClearAll: 'Borrar todo',
    historyClearAllConfirm: '¿Borrar todo el historial? Esta acción no se puede deshacer',
    settingsTitle: 'Ajustes',
    settingsLanguage: 'Idioma de la interfaz',
    settingsService: 'Servicio de voz',
    settingsServiceUrl: 'URL del servicio',
    settingsServiceUrlPlaceholder: 'http://localhost:8907',
    settingsServiceTimeout: 'Tiempo de espera (segundos)',
    settingsSave: 'Guardar ajustes',
    settingsSaved: 'Ajustes guardados',
    settingsReset: 'Restablecer valores',
    settingsAbout: 'Acerca de',
    settingsVersion: 'Versión',
    settingsPlatform: 'Plataforma',
    settingsArchitecture: 'Arquitectura',
    errServiceUnavailable: 'Servicio de voz no disponible. Comprueba si el servicio está en ejecución',
    errCloneFailed: 'Error al clonar la voz. Inténtalo de nuevo',
    errSynthFailed: 'Error al sintetizar el audio. Inténtalo de nuevo',
    errScriptFailed: 'Error al generar el guion. Inténtalo de nuevo',
    errInvalidUrl: 'Introduce una URL válida',
    errEmptyText: 'Introduce el contenido de texto',
    errNoFile: 'Selecciona un archivo',
    errNoCloneName: 'Introduce un nombre para el clon',
    errNoCloneAudio: 'Selecciona un audio de referencia',
    errNetwork: 'Error de red. Comprueba si el servicio está en ejecución',
    errTimeout: 'Tiempo de espera agotado',
    errCloneBusy: 'El servicio de síntesis de voz está ocupado. Espera a que termine la tarea actual',
    errNoScript: 'Genera primero el guion del podcast',
    language: 'Idioma',
    chinese: '中文',
    english: 'English',
    regenerate: 'Resintetizar',
    play: 'Reproducir',
    pause: 'Pausar',
    download: 'Descargar',
    downloadSuccess: 'Descargado correctamente',
    delete: 'Eliminar',
    close: 'Cerrar',
    cancel: 'Cancelar',
    confirm: 'Confirmar',
    noAudioGenerated: 'Aún no se ha generado audio',
    synthesisComplete: 'Síntesis completada',
    selectVoice: 'Seleccionar voz',
    useSystemVoice: 'Voz del sistema',
    useCloneVoice: 'Voz clonada',
    cloneNameRequired: 'Introduce un nombre para el clon',
    audioFileRequired: 'Selecciona un archivo de audio',
    uploadAudio: 'Subir audio',
    previewLoading: 'Cargando...',
    playPreview: 'Escuchar',
    stopPreview: 'Detener',
    generatingScript: 'Generando guion',
    synthesizingAudio: 'Sintetizando audio',
    scriptGenerated: 'Guion generado',
    audioReady: 'Audio listo',
    words: 'palabras',
    segments: 'segmentos',
    totalDuration: 'Duración total',
    deleteSuccess: 'Eliminado',
    clearSuccess: 'Borrado',
    saveSettingsFirst: 'Guarda primero los ajustes',
    serviceUrlChanged: 'URL del servicio actualizada, comprobando de nuevo...',
    archInfo: 'Arquitectura',
    appDescription: 'Generador de podcasts con IA compatible con clonación de voz y varios idiomas',
    openSourceUrl: 'https://github.com/Aiven66/PodcastAI',
    noCloneYet: 'No hay voces clonadas',
    selectCloneOrSystem: 'Elige voz del sistema o clonada',
    createCloneFirst: 'Crea primero una voz clonada',
    podcastGenerated: 'Podcast generado',
    fileToLarge: 'Archivo demasiado grande. Selecciona uno de menos de 50 MB',
    unsupportedFormat: 'Formato de archivo no compatible',
    extractFileContent: 'Extrayendo el contenido del archivo...',
    fetchingUrl: 'Obteniendo el contenido de la URL...',
    voice1Default: 'female-professional',
    voice2Default: 'male-narrator',
    serviceManager: 'Gestión del servicio',
    serviceManagerDesc: 'Gestiona el servicio de voz Python local (para clonación de voz y síntesis de podcasts)',
    detectEnvironment: 'Detectar entorno',
    detecting: 'Detectando...',
    detected: 'Resultado de la detección',
    pythonFound: 'Python instalado',
    pythonNotFound: 'Python no encontrado (se requiere 3.10+)',
    pythonVersionLabel: 'Versión de Python',
    pythonPathLabel: 'Ruta de Python',
    voiceServiceFound: 'Servicio de voz instalado',
    voiceServiceNotFound: 'No se encontró el directorio del servicio de voz',
    voiceServicePathLabel: 'Ruta del servicio de voz',
    voiceServiceSelectDir: 'Seleccionar directorio',
    voiceServiceDownload: 'Descargar servicio de voz',
    voiceServiceDownloadHint: 'Descarga el código fuente de voice-service desde GitHub e instala las dependencias de Python y los modelos CosyVoice2',
    modelsReady: 'Modelos CosyVoice2 listos',
    modelsNotReady: 'Modelos CosyVoice2 no descargados (necesarios para clonar voz)',
    startService: 'Iniciar servicio',
    stopService: 'Detener servicio',
    startingService: 'Iniciando...',
    stoppingService: 'Deteniendo...',
    serviceStarted: 'Servicio de voz iniciado',
    serviceStopped: 'Servicio de voz detenido',
    serviceStartFailed: 'Error al iniciar',
    serviceRunning: 'Servicio en ejecución',
    serviceNotRunning: 'Servicio detenido',
    autoStartService: 'Iniciar el servicio automáticamente al abrir la app',
    autoStartHint: 'Si lo activas, el servicio de voz se inicia automáticamente al abrir la app de escritorio',
    serviceLogs: 'Registros del servicio',
    clearLogs: 'Borrar registros',
    noLogs: 'Sin registros todavía',
    setupGuide: 'Guía de configuración',
    setupStep1: '1. Instala Python 3.10+ (se recomienda 3.11)',
    setupStep2: '2. Descarga el código fuente de voice-service',
    setupStep3: '3. Crea un entorno virtual: python3.11 -m venv venv',
    setupStep4: '4. Instala dependencias: ./venv/bin/pip install -r requirements.txt',
    setupStep5: '5. Descarga los modelos CosyVoice2 (ejecuta bash setup_cosyvoice.sh)',
    setupStep6: '6. Selecciona el directorio de voice-service y pulsa Iniciar servicio',
    offlineBanner: 'Servicio de voz sin conexión. La clonación de voz y la síntesis de podcasts no están disponibles.',
    offlineBannerAction: 'Iniciar servicio',
    goToSettings: 'Ir a Ajustes',
    processId: 'PID',
    selectVoiceServiceDir: 'Selecciona el directorio de voice-service',
    serviceAutoDetected: 'Ruta detectada automáticamente',
    pythonInstallUrl: 'https://www.python.org/downloads/',
    voiceServiceRepoUrl: 'https://github.com/Aiven66/PodcastAI',
    modelsPathHint: 'Ruta del modelo: voice-service/CosyVoice/pretrained_models/CosyVoice2-0.5B',
    openInFinder: 'Mostrar en carpeta',
    refreshDetection: 'Actualizar detección',
    serviceStatusCheck: 'Comprobar estado del servicio',
    portConflict: 'El puerto 8907 puede estar en uso. Comprueba si otro proceso lo está utilizando',
    modelManager: 'Modelo de voz',
    modelManagerDesc: 'Modelo de clonación de voz CosyVoice2 (~3,7 GB, incluido, listo para usar)',
    modelStatus: 'Estado del modelo',
    modelReady: 'Modelo listo',
    modelNotReady: 'Modelo no descargado',
    modelPartial: 'Parcialmente descargado',
    modelDownload: 'Descargar modelo',
    modelRedownload: 'Volver a descargar',
    modelAbort: 'Cancelar',
    modelDownloading: 'Descargando...',
    modelDownloadComplete: 'Descarga del modelo completada',
    modelDownloadFailed: 'Error al descargar el modelo',
    modelDownloadAborted: 'Descarga cancelada',
    modelCurrentFile: 'Archivo actual',
    modelProgress: 'Progreso',
    modelSpeed: 'Velocidad',
    modelFiles: 'Archivos',
    modelSize: 'Tamaño',
    modelOpenDir: 'Mostrar en carpeta',
    modelAutoStartHint: 'El servicio de voz se inicia automáticamente al abrir la app; no requiere configuración manual',
    runtimeManager: 'Entorno Python',
    runtimeManagerDesc: 'Entorno Python integrado (excluido del instalador, se descarga y extrae automáticamente en el primer inicio)',
    runtimeStatus: 'Estado del entorno',
    runtimeReady: 'Listo',
    runtimeNotReady: 'No instalado',
    runtimeDownload: 'Descargar entorno',
    runtimeRedownload: 'Volver a descargar',
    runtimeAbort: 'Cancelar',
    runtimeDownloading: 'Descargando...',
    runtimeExtracting: 'Extrayendo...',
    runtimeVerifying: 'Verificando...',
    runtimeDownloadComplete: 'Entorno listo',
    runtimeDownloadFailed: 'Error al descargar el entorno',
    runtimeDownloadAborted: 'Descarga cancelada',
    runtimeOpenDir: 'Mostrar en carpeta',
    serviceAutoStarting: 'Iniciando el servicio de voz...',
  },

  // ─── Français ───
  fr: {
    appName: 'PodcastAI',
    loading: 'Chargement...',
    navPodcast: 'Générer un podcast',
    navClone: 'Clonage de voix',
    navHistory: 'Historique',
    navSettings: 'Paramètres',
    serviceStatus: 'État du service',
    serviceOnline: 'En ligne',
    serviceOffline: 'Hors ligne',
    serviceBusy: 'Synthèse en cours',
    serviceCheckFailed: 'Échec de la vérification',
    serviceHint: 'Veuillez démarrer le service vocal Python local (port par défaut 8907)',
    currentAccount: 'Compte',
    notLoggedIn: 'Non connecté',
    signOut: 'Se déconnecter',
    switchAccount: 'Changer de compte',
    themeLabel: 'Thème',
    themeLight: 'Clair',
    themeDark: 'Sombre',
    podcastTitle: 'Générer un podcast',
    podcastSubtitle: 'Convertissez des URL, du texte ou des fichiers en podcasts de haute qualité',
    inputMethod: 'Mode de saisie',
    inputUrl: 'Saisie d’URL',
    inputText: 'Saisie de texte',
    inputFile: 'Téléverser un fichier',
    urlLabel: 'URL de l’article',
    urlPlaceholder: 'Collez l’URL de l’article (ex. l’URL d’un article de blog)',
    textLabel: 'Contenu texte',
    textPlaceholder: 'Saisissez ou collez le texte à convertir en podcast...',
    fileLabel: 'Téléverser un fichier',
    fileDropHint: 'Cliquez ou faites glisser le fichier ici',
    fileSupported: 'Formats pris en charge : PDF, Word, Markdown, TXT',
    fileSelected: 'Fichier sélectionné',
    fileChange: 'Changer de fichier',
    podcastOptions: 'Options du podcast',
    podcastType: 'Type de podcast',
    singleHost: 'Animateur unique',
    dualHost: 'Deux animateurs (interview)',
    voiceSelect: 'Sélection de la voix',
    voiceHost: 'Voix de l’animateur',
    voiceGuest: 'Voix de l’invité',
    systemVoice: 'Voix système',
    cloneVoice: 'Voix clonée',
    noCloneAvailable: 'Aucune voix clonée pour le moment. Créez-en une d’abord dans l’onglet « Clonage de voix »',
    generate: 'Générer le podcast',
    generating: 'Génération',
    scriptGenerating: 'Génération du script...',
    audioSynthesizing: 'Synthèse audio en cours...',
    segmentProgress: 'Synthèse du segment {current}/{total}',
    audioFinalizing: 'Finalisation de l’audio, veuillez patienter...',
    scriptPreview: 'Aperçu du script',
    scriptEditHint: 'Modifiez le script après génération, puis synthétisez l’audio',
    audioPlayer: 'Lecteur audio',
    noAudio: 'Pas encore d’audio',
    duration: 'Durée',
    cloneTitle: 'Clonage de voix',
    cloneSubtitle: 'Clonez votre voix avec le modèle CosyVoice2',
    cloneName: 'Nom du clone',
    cloneNamePlaceholder: 'Donnez un nom à votre voix clonée',
    cloneGender: 'Genre',
    cloneGenderAuto: 'Détection automatique',
    cloneGenderMale: 'Homme',
    cloneGenderFemale: 'Femme',
    cloneDescription: 'Description (facultatif)',
    cloneDescriptionPlaceholder: 'ex. voix féminine chaleureuse, voix masculine grave',
    clonePromptText: 'Texte de référence (facultatif, améliore la similitude)',
    clonePromptPlaceholder: 'Transcription de l’audio (5 à 30 secondes)',
    cloneAudioFile: 'Audio de référence',
    cloneAudioHint: 'Téléversez 5 à 30 secondes de voix claire (wav/mp3/m4a)',
    cloneAudioSelected: 'Audio sélectionné',
    startClone: 'Démarrer le clonage',
    cloning: 'Clonage...',
    cloneSuccess: 'Clone créé avec succès',
    cloneFailed: 'Échec du clonage',
    cloneListTitle: 'Mes voix clonées',
    cloneEmpty: 'Aucune voix clonée pour le moment',
    clonePreview: 'Écouter',
    cloneDelete: 'Supprimer',
    cloneDeleteConfirm: 'Supprimer cette voix clonée ?',
    historyTitle: 'Historique',
    historyEmpty: 'Aucun podcast généré pour le moment',
    historyCreatedAt: 'Créé le',
    historyDuration: 'Durée',
    historyScript: 'Script',
    historyPlay: 'Lecture',
    historyDownload: 'Télécharger',
    historyDelete: 'Supprimer',
    historyDeleteConfirm: 'Supprimer cet élément d’historique ?',
    historyClearAll: 'Tout effacer',
    historyClearAllConfirm: 'Effacer tout l’historique ? Cette action est irréversible',
    settingsTitle: 'Paramètres',
    settingsLanguage: 'Langue de l’interface',
    settingsService: 'Service vocal',
    settingsServiceUrl: 'URL du service',
    settingsServiceUrlPlaceholder: 'http://localhost:8907',
    settingsServiceTimeout: 'Délai d’expiration (secondes)',
    settingsSave: 'Enregistrer les paramètres',
    settingsSaved: 'Paramètres enregistrés',
    settingsReset: 'Rétablir les valeurs par défaut',
    settingsAbout: 'À propos',
    settingsVersion: 'Version',
    settingsPlatform: 'Plateforme',
    settingsArchitecture: 'Architecture',
    errServiceUnavailable: 'Service vocal indisponible. Vérifiez qu’il est en cours d’exécution',
    errCloneFailed: 'Échec du clonage de la voix. Veuillez réessayer',
    errSynthFailed: 'Échec de la synthèse audio. Veuillez réessayer',
    errScriptFailed: 'Échec de la génération du script. Veuillez réessayer',
    errInvalidUrl: 'Veuillez saisir une URL valide',
    errEmptyText: 'Veuillez saisir le contenu texte',
    errNoFile: 'Veuillez sélectionner un fichier',
    errNoCloneName: 'Veuillez saisir un nom de clone',
    errNoCloneAudio: 'Veuillez sélectionner un audio de référence',
    errNetwork: 'Erreur réseau. Vérifiez que le service est en cours d’exécution',
    errTimeout: 'Délai d’expiration dépassé',
    errCloneBusy: 'Le service de synthèse vocale est occupé. Attendez la fin de la tâche en cours',
    errNoScript: 'Générez d’abord le script du podcast',
    language: 'Langue',
    chinese: '中文',
    english: 'English',
    regenerate: 'Resynthétiser',
    play: 'Lecture',
    pause: 'Pause',
    download: 'Télécharger',
    downloadSuccess: 'Téléchargement réussi',
    delete: 'Supprimer',
    close: 'Fermer',
    cancel: 'Annuler',
    confirm: 'Confirmer',
    noAudioGenerated: 'Aucun audio généré pour le moment',
    synthesisComplete: 'Synthèse terminée',
    selectVoice: 'Sélectionner une voix',
    useSystemVoice: 'Voix système',
    useCloneVoice: 'Voix clonée',
    cloneNameRequired: 'Veuillez saisir un nom de clone',
    audioFileRequired: 'Veuillez sélectionner un fichier audio',
    uploadAudio: 'Téléverser un audio',
    previewLoading: 'Chargement...',
    playPreview: 'Écouter',
    stopPreview: 'Arrêter',
    generatingScript: 'Génération du script',
    synthesizingAudio: 'Synthèse audio',
    scriptGenerated: 'Script généré',
    audioReady: 'Audio prêt',
    words: 'mots',
    segments: 'segments',
    totalDuration: 'Durée totale',
    deleteSuccess: 'Supprimé',
    clearSuccess: 'Effacé',
    saveSettingsFirst: 'Enregistrez d’abord les paramètres',
    serviceUrlChanged: 'URL du service mise à jour, nouvelle vérification...',
    archInfo: 'Architecture',
    appDescription: 'Générateur de podcasts par IA avec clonage de voix et prise en charge multilingue',
    openSourceUrl: 'https://github.com/Aiven66/PodcastAI',
    noCloneYet: 'Aucune voix clonée',
    selectCloneOrSystem: 'Choisissez une voix système ou clonée',
    createCloneFirst: 'Créez d’abord une voix clonée',
    podcastGenerated: 'Podcast généré',
    fileToLarge: 'Fichier trop volumineux. Sélectionnez un fichier de moins de 50 Mo',
    unsupportedFormat: 'Format de fichier non pris en charge',
    extractFileContent: 'Extraction du contenu du fichier...',
    fetchingUrl: 'Récupération du contenu de l’URL...',
    voice1Default: 'female-professional',
    voice2Default: 'male-narrator',
    serviceManager: 'Gestion du service',
    serviceManagerDesc: 'Gérez le service vocal Python local (pour le clonage de voix et la synthèse de podcasts)',
    detectEnvironment: 'Détecter l’environnement',
    detecting: 'Détection...',
    detected: 'Résultat de la détection',
    pythonFound: 'Python installé',
    pythonNotFound: 'Python introuvable (3.10+ requis)',
    pythonVersionLabel: 'Version de Python',
    pythonPathLabel: 'Chemin de Python',
    voiceServiceFound: 'Service vocal installé',
    voiceServiceNotFound: 'Répertoire du service vocal introuvable',
    voiceServicePathLabel: 'Chemin du service vocal',
    voiceServiceSelectDir: 'Sélectionner un répertoire',
    voiceServiceDownload: 'Télécharger le service vocal',
    voiceServiceDownloadHint: 'Téléchargez le code source de voice-service depuis GitHub, puis installez les dépendances Python et les modèles CosyVoice2',
    modelsReady: 'Modèles CosyVoice2 prêts',
    modelsNotReady: 'Modèles CosyVoice2 non téléchargés (requis pour le clonage de voix)',
    startService: 'Démarrer le service',
    stopService: 'Arrêter le service',
    startingService: 'Démarrage...',
    stoppingService: 'Arrêt...',
    serviceStarted: 'Service vocal démarré',
    serviceStopped: 'Service vocal arrêté',
    serviceStartFailed: 'Échec du démarrage',
    serviceRunning: 'Service en cours d’exécution',
    serviceNotRunning: 'Service arrêté',
    autoStartService: 'Démarrer automatiquement le service au lancement',
    autoStartHint: 'Si activé, le service vocal démarre automatiquement à l’ouverture de l’application',
    serviceLogs: 'Journaux du service',
    clearLogs: 'Effacer les journaux',
    noLogs: 'Aucun journal pour le moment',
    setupGuide: 'Guide d’installation',
    setupStep1: '1. Installez Python 3.10+ (3.11 recommandé)',
    setupStep2: '2. Téléchargez le code source de voice-service',
    setupStep3: '3. Créez un environnement virtuel : python3.11 -m venv venv',
    setupStep4: '4. Installez les dépendances : ./venv/bin/pip install -r requirements.txt',
    setupStep5: '5. Téléchargez les modèles CosyVoice2 (exécutez bash setup_cosyvoice.sh)',
    setupStep6: '6. Sélectionnez le répertoire voice-service et cliquez sur Démarrer le service',
    offlineBanner: 'Service vocal hors ligne. Le clonage de voix et la synthèse de podcasts sont indisponibles.',
    offlineBannerAction: 'Démarrer le service',
    goToSettings: 'Aller aux Paramètres',
    processId: 'PID',
    selectVoiceServiceDir: 'Sélectionnez le répertoire voice-service',
    serviceAutoDetected: 'Chemin détecté automatiquement',
    pythonInstallUrl: 'https://www.python.org/downloads/',
    voiceServiceRepoUrl: 'https://github.com/Aiven66/PodcastAI',
    modelsPathHint: 'Chemin du modèle : voice-service/CosyVoice/pretrained_models/CosyVoice2-0.5B',
    openInFinder: 'Afficher dans le dossier',
    refreshDetection: 'Actualiser la détection',
    serviceStatusCheck: 'Vérifier l’état du service',
    portConflict: 'Le port 8907 est peut-être occupé. Vérifiez qu’un autre processus ne l’utilise pas',
    modelManager: 'Modèle vocal',
    modelManagerDesc: 'Modèle de clonage de voix CosyVoice2 (~3,7 Go, préinstallé, prêt à l’emploi)',
    modelStatus: 'État du modèle',
    modelReady: 'Modèle prêt',
    modelNotReady: 'Modèle non téléchargé',
    modelPartial: 'Partiellement téléchargé',
    modelDownload: 'Télécharger le modèle',
    modelRedownload: 'Retélécharger',
    modelAbort: 'Interrompre',
    modelDownloading: 'Téléchargement...',
    modelDownloadComplete: 'Téléchargement du modèle terminé',
    modelDownloadFailed: 'Échec du téléchargement du modèle',
    modelDownloadAborted: 'Téléchargement interrompu',
    modelCurrentFile: 'Fichier actuel',
    modelProgress: 'Progression',
    modelSpeed: 'Vitesse',
    modelFiles: 'Fichiers',
    modelSize: 'Taille',
    modelOpenDir: 'Afficher dans le dossier',
    modelAutoStartHint: 'Le service vocal démarre automatiquement au lancement de l’application — aucune configuration manuelle',
    runtimeManager: 'Runtime Python',
    runtimeManagerDesc: 'Runtime Python intégré (exclu de l’installeur, téléchargé et extrait automatiquement au premier lancement)',
    runtimeStatus: 'État du runtime',
    runtimeReady: 'Prêt',
    runtimeNotReady: 'Non installé',
    runtimeDownload: 'Télécharger le runtime',
    runtimeRedownload: 'Re-télécharger',
    runtimeAbort: 'Annuler',
    runtimeDownloading: 'Téléchargement...',
    runtimeExtracting: 'Extraction...',
    runtimeVerifying: 'Vérification...',
    runtimeDownloadComplete: 'Runtime prêt',
    runtimeDownloadFailed: 'Échec du téléchargement du runtime',
    runtimeDownloadAborted: 'Téléchargement annulé',
    runtimeOpenDir: 'Afficher dans le dossier',
    serviceAutoStarting: 'Démarrage du service vocal...',
  },

  // ─── Deutsch ───
  de: {
    appName: 'PodcastAI',
    loading: 'Wird geladen...',
    navPodcast: 'Podcast erstellen',
    navClone: 'Stimmklon',
    navHistory: 'Verlauf',
    navSettings: 'Einstellungen',
    serviceStatus: 'Dienststatus',
    serviceOnline: 'Online',
    serviceOffline: 'Offline',
    serviceBusy: 'Synthese läuft',
    serviceCheckFailed: 'Prüfung fehlgeschlagen',
    serviceHint: 'Bitte starten Sie den lokalen Python-Sprachdienst (Standardport 8907)',
    currentAccount: 'Konto',
    notLoggedIn: 'Nicht angemeldet',
    signOut: 'Abmelden',
    switchAccount: 'Konto wechseln',
    themeLabel: 'Design',
    themeLight: 'Hell',
    themeDark: 'Dunkel',
    podcastTitle: 'Podcast erstellen',
    podcastSubtitle: 'Konvertieren Sie URLs, Text oder Dateien in hochwertige Podcasts',
    inputMethod: 'Eingabemethode',
    inputUrl: 'URL-Eingabe',
    inputText: 'Texteingabe',
    inputFile: 'Datei-Upload',
    urlLabel: 'Artikel-URL',
    urlPlaceholder: 'Artikel-URL einfügen (z. B. Blogbeitrag-URL)',
    textLabel: 'Textinhalt',
    textPlaceholder: 'Text eingeben oder einfügen, der in einen Podcast umgewandelt werden soll...',
    fileLabel: 'Datei hochladen',
    fileDropHint: 'Klicken oder ziehen Sie die Datei hierher',
    fileSupported: 'Unterstützt PDF, Word, Markdown und TXT',
    fileSelected: 'Datei ausgewählt',
    fileChange: 'Datei ändern',
    podcastOptions: 'Podcast-Optionen',
    podcastType: 'Podcast-Typ',
    singleHost: 'Einzelner Moderator',
    dualHost: 'Zwei Moderatoren (Interview)',
    voiceSelect: 'Stimmauswahl',
    voiceHost: 'Stimme des Moderators',
    voiceGuest: 'Stimme des Gasts',
    systemVoice: 'Systemstimme',
    cloneVoice: 'Geklonte Stimme',
    noCloneAvailable: 'Noch keine geklonten Stimmen. Bitte erstellen Sie zuerst eine im Tab „Stimmklon“',
    generate: 'Podcast generieren',
    generating: 'Wird generiert',
    scriptGenerating: 'Skript wird generiert...',
    audioSynthesizing: 'Audio wird synthetisiert...',
    segmentProgress: 'Segment {current}/{total} wird synthetisiert',
    audioFinalizing: 'Audio wird finalisiert, bitte warten...',
    scriptPreview: 'Skriptvorschau',
    scriptEditHint: 'Bearbeiten Sie das Skript nach der Generierung und synthetisieren Sie dann das Audio',
    audioPlayer: 'Audio-Player',
    noAudio: 'Noch kein Audio',
    duration: 'Dauer',
    cloneTitle: 'Stimmklonen',
    cloneSubtitle: 'Klonen Sie Ihre Stimme mit dem CosyVoice2-Modell',
    cloneName: 'Klonname',
    cloneNamePlaceholder: 'Geben Sie Ihrer geklonten Stimme einen Namen',
    cloneGender: 'Geschlecht',
    cloneGenderAuto: 'Automatisch erkennen',
    cloneGenderMale: 'Männlich',
    cloneGenderFemale: 'Weiblich',
    cloneDescription: 'Beschreibung (optional)',
    cloneDescriptionPlaceholder: 'z. B. warme Frauenstimme, tiefe Männerstimme',
    clonePromptText: 'Referenztext (optional, verbessert die Ähnlichkeit)',
    clonePromptPlaceholder: 'Transkript des Audios (5–30 Sekunden)',
    cloneAudioFile: 'Referenz-Audio',
    cloneAudioHint: 'Laden Sie 5–30 Sekunden klare Sprache hoch (wav/mp3/m4a)',
    cloneAudioSelected: 'Audio ausgewählt',
    startClone: 'Klonen starten',
    cloning: 'Klonen läuft...',
    cloneSuccess: 'Klon erfolgreich erstellt',
    cloneFailed: 'Klonen fehlgeschlagen',
    cloneListTitle: 'Meine geklonten Stimmen',
    cloneEmpty: 'Noch keine geklonten Stimmen',
    clonePreview: 'Anhören',
    cloneDelete: 'Löschen',
    cloneDeleteConfirm: 'Diese geklonte Stimme löschen?',
    historyTitle: 'Verlauf',
    historyEmpty: 'Noch keine Podcasts generiert',
    historyCreatedAt: 'Erstellt am',
    historyDuration: 'Dauer',
    historyScript: 'Skript',
    historyPlay: 'Wiedergabe',
    historyDownload: 'Herunterladen',
    historyDelete: 'Löschen',
    historyDeleteConfirm: 'Diesen Verlaufseintrag löschen?',
    historyClearAll: 'Alles löschen',
    historyClearAllConfirm: 'Gesamten Verlauf löschen? Dies kann nicht rückgängig gemacht werden',
    settingsTitle: 'Einstellungen',
    settingsLanguage: 'Sprache der Oberfläche',
    settingsService: 'Sprachdienst',
    settingsServiceUrl: 'Dienst-URL',
    settingsServiceUrlPlaceholder: 'http://localhost:8907',
    settingsServiceTimeout: 'Zeitüberschreitung (Sekunden)',
    settingsSave: 'Einstellungen speichern',
    settingsSaved: 'Einstellungen gespeichert',
    settingsReset: 'Auf Standard zurücksetzen',
    settingsAbout: 'Über',
    settingsVersion: 'Version',
    settingsPlatform: 'Plattform',
    settingsArchitecture: 'Architektur',
    errServiceUnavailable: 'Sprachdienst nicht verfügbar. Bitte prüfen Sie, ob der Dienst läuft',
    errCloneFailed: 'Stimmklonen fehlgeschlagen. Bitte erneut versuchen',
    errSynthFailed: 'Audiosynthese fehlgeschlagen. Bitte erneut versuchen',
    errScriptFailed: 'Skriptgenerierung fehlgeschlagen. Bitte erneut versuchen',
    errInvalidUrl: 'Bitte geben Sie eine gültige URL ein',
    errEmptyText: 'Bitte geben Sie Textinhalt ein',
    errNoFile: 'Bitte wählen Sie eine Datei aus',
    errNoCloneName: 'Bitte geben Sie einen Klonnamen ein',
    errNoCloneAudio: 'Bitte wählen Sie ein Referenz-Audio aus',
    errNetwork: 'Netzwerkfehler. Bitte prüfen Sie, ob der Dienst läuft',
    errTimeout: 'Zeitüberschreitung der Anfrage',
    errCloneBusy: 'Der Sprachsynthese-Dienst ist beschäftigt. Bitte warten Sie, bis die aktuelle Aufgabe abgeschlossen ist',
    errNoScript: 'Bitte generieren Sie zuerst das Podcast-Skript',
    language: 'Sprache',
    chinese: '中文',
    english: 'English',
    regenerate: 'Erneut synthetisieren',
    play: 'Wiedergabe',
    pause: 'Pause',
    download: 'Herunterladen',
    downloadSuccess: 'Erfolgreich heruntergeladen',
    delete: 'Löschen',
    close: 'Schließen',
    cancel: 'Abbrechen',
    confirm: 'Bestätigen',
    noAudioGenerated: 'Noch kein Audio generiert',
    synthesisComplete: 'Synthese abgeschlossen',
    selectVoice: 'Stimme auswählen',
    useSystemVoice: 'Systemstimme',
    useCloneVoice: 'Geklonte Stimme',
    cloneNameRequired: 'Bitte geben Sie einen Klonnamen ein',
    audioFileRequired: 'Bitte wählen Sie eine Audiodatei aus',
    uploadAudio: 'Audio hochladen',
    previewLoading: 'Wird geladen...',
    playPreview: 'Anhören',
    stopPreview: 'Stopp',
    generatingScript: 'Skript wird generiert',
    synthesizingAudio: 'Audio wird synthetisiert',
    scriptGenerated: 'Skript generiert',
    audioReady: 'Audio bereit',
    words: 'Wörter',
    segments: 'Segmente',
    totalDuration: 'Gesamtdauer',
    deleteSuccess: 'Gelöscht',
    clearSuccess: 'Geleert',
    saveSettingsFirst: 'Bitte speichern Sie zuerst die Einstellungen',
    serviceUrlChanged: 'Dienst-URL aktualisiert, erneute Prüfung...',
    archInfo: 'Architektur',
    appDescription: 'KI-gestützter Podcast-Generator mit Stimmklonen und Mehrsprachigkeit',
    openSourceUrl: 'https://github.com/Aiven66/PodcastAI',
    noCloneYet: 'Keine geklonten Stimmen',
    selectCloneOrSystem: 'Systemstimme oder geklonte Stimme wählen',
    createCloneFirst: 'Bitte erstellen Sie zuerst eine geklonte Stimme',
    podcastGenerated: 'Podcast generiert',
    fileToLarge: 'Datei zu groß. Bitte wählen Sie eine Datei unter 50 MB',
    unsupportedFormat: 'Nicht unterstütztes Dateiformat',
    extractFileContent: 'Dateiinhalt wird extrahiert...',
    fetchingUrl: 'URL-Inhalt wird abgerufen...',
    voice1Default: 'female-professional',
    voice2Default: 'male-narrator',
    serviceManager: 'Dienstverwaltung',
    serviceManagerDesc: 'Verwalten Sie den lokalen Python-Sprachdienst (für Stimmklonen und Podcast-Synthese)',
    detectEnvironment: 'Umgebung erkennen',
    detecting: 'Erkennung läuft...',
    detected: 'Ergebnis der Erkennung',
    pythonFound: 'Python installiert',
    pythonNotFound: 'Python nicht gefunden (3.10+ erforderlich)',
    pythonVersionLabel: 'Python-Version',
    pythonPathLabel: 'Python-Pfad',
    voiceServiceFound: 'Sprachdienst installiert',
    voiceServiceNotFound: 'Sprachdienst-Verzeichnis nicht gefunden',
    voiceServicePathLabel: 'Sprachdienst-Pfad',
    voiceServiceSelectDir: 'Verzeichnis auswählen',
    voiceServiceDownload: 'Sprachdienst herunterladen',
    voiceServiceDownloadHint: 'Lädt den voice-service-Quellcode von GitHub herunter und installiert die Python-Abhängigkeiten sowie die CosyVoice2-Modelle',
    modelsReady: 'CosyVoice2-Modelle bereit',
    modelsNotReady: 'CosyVoice2-Modelle nicht heruntergeladen (für Stimmklonen erforderlich)',
    startService: 'Dienst starten',
    stopService: 'Dienst stoppen',
    startingService: 'Wird gestartet...',
    stoppingService: 'Wird gestoppt...',
    serviceStarted: 'Sprachdienst gestartet',
    serviceStopped: 'Sprachdienst gestoppt',
    serviceStartFailed: 'Start fehlgeschlagen',
    serviceRunning: 'Dienst läuft',
    serviceNotRunning: 'Dienst gestoppt',
    autoStartService: 'Dienst beim App-Start automatisch starten',
    autoStartHint: 'Wenn aktiviert, wird der Sprachdienst beim Öffnen der Desktop-App automatisch gestartet',
    serviceLogs: 'Dienstprotokolle',
    clearLogs: 'Protokolle löschen',
    noLogs: 'Noch keine Protokolle',
    setupGuide: 'Einrichtungsanleitung',
    setupStep1: '1. Python 3.10+ installieren (3.11 empfohlen)',
    setupStep2: '2. voice-service-Quellcode herunterladen',
    setupStep3: '3. Virtuelle Umgebung erstellen: python3.11 -m venv venv',
    setupStep4: '4. Abhängigkeiten installieren: ./venv/bin/pip install -r requirements.txt',
    setupStep5: '5. CosyVoice2-Modelle herunterladen (bash setup_cosyvoice.sh ausführen)',
    setupStep6: '6. voice-service-Verzeichnis auswählen und auf „Dienst starten“ klicken',
    offlineBanner: 'Sprachdienst offline. Stimmklonen und Podcast-Synthese sind nicht verfügbar.',
    offlineBannerAction: 'Dienst starten',
    goToSettings: 'Zu den Einstellungen',
    processId: 'PID',
    selectVoiceServiceDir: 'voice-service-Verzeichnis auswählen',
    serviceAutoDetected: 'Pfad automatisch erkannt',
    pythonInstallUrl: 'https://www.python.org/downloads/',
    voiceServiceRepoUrl: 'https://github.com/Aiven66/PodcastAI',
    modelsPathHint: 'Modellpfad: voice-service/CosyVoice/pretrained_models/CosyVoice2-0.5B',
    openInFinder: 'Im Ordner anzeigen',
    refreshDetection: 'Erkennung aktualisieren',
    serviceStatusCheck: 'Dienststatus prüfen',
    portConflict: 'Port 8907 ist möglicherweise belegt. Prüfen Sie, ob ein anderer Prozess ihn verwendet',
    modelManager: 'Sprachmodell',
    modelManagerDesc: 'CosyVoice2-Stimmklonmodell (~3,7 GB, vorinstalliert, sofort einsatzbereit)',
    modelStatus: 'Modellstatus',
    modelReady: 'Modell bereit',
    modelNotReady: 'Modell nicht heruntergeladen',
    modelPartial: 'Teilweise heruntergeladen',
    modelDownload: 'Modell herunterladen',
    modelRedownload: 'Erneut herunterladen',
    modelAbort: 'Abbrechen',
    modelDownloading: 'Wird heruntergeladen...',
    modelDownloadComplete: 'Modell-Download abgeschlossen',
    modelDownloadFailed: 'Modell-Download fehlgeschlagen',
    modelDownloadAborted: 'Download abgebrochen',
    modelCurrentFile: 'Aktuelle Datei',
    modelProgress: 'Fortschritt',
    modelSpeed: 'Geschwindigkeit',
    modelFiles: 'Dateien',
    modelSize: 'Größe',
    modelOpenDir: 'Im Ordner anzeigen',
    modelAutoStartHint: 'Der Sprachdienst startet automatisch beim App-Start — keine manuelle Einrichtung nötig',
    runtimeManager: 'Python-Laufzeit',
    runtimeManagerDesc: 'Integrierte Python-Laufzeit (aus Installer entfernt, wird beim ersten Start automatisch heruntergeladen und entpackt)',
    runtimeStatus: 'Status der Laufzeit',
    runtimeReady: 'Bereit',
    runtimeNotReady: 'Nicht installiert',
    runtimeDownload: 'Laufzeit herunterladen',
    runtimeRedownload: 'Erneut herunterladen',
    runtimeAbort: 'Abbrechen',
    runtimeDownloading: 'Wird heruntergeladen...',
    runtimeExtracting: 'Wird entpackt...',
    runtimeVerifying: 'Wird überprüft...',
    runtimeDownloadComplete: 'Laufzeit bereit',
    runtimeDownloadFailed: 'Download der Laufzeit fehlgeschlagen',
    runtimeDownloadAborted: 'Download abgebrochen',
    runtimeOpenDir: 'Im Ordner anzeigen',
    serviceAutoStarting: 'Sprachdienst wird gestartet...',
  },

  // ─── Português ───
  pt: {
    appName: 'PodcastAI',
    loading: 'Carregando...',
    navPodcast: 'Gerar podcast',
    navClone: 'Clonar voz',
    navHistory: 'Histórico',
    navSettings: 'Configurações',
    serviceStatus: 'Status do serviço',
    serviceOnline: 'Online',
    serviceOffline: 'Offline',
    serviceBusy: 'Sintetizando',
    serviceCheckFailed: 'Falha na verificação',
    serviceHint: 'Inicie o serviço de voz Python local (porta padrão 8907)',
    currentAccount: 'Conta',
    notLoggedIn: 'Não conectado',
    signOut: 'Sair',
    switchAccount: 'Trocar de conta',
    themeLabel: 'Tema',
    themeLight: 'Claro',
    themeDark: 'Escuro',
    podcastTitle: 'Gerar podcast',
    podcastSubtitle: 'Converta URLs, texto ou arquivos em podcasts de alta qualidade',
    inputMethod: 'Método de entrada',
    inputUrl: 'Entrada de URL',
    inputText: 'Entrada de texto',
    inputFile: 'Enviar arquivo',
    urlLabel: 'URL do artigo',
    urlPlaceholder: 'Cole a URL do artigo (ex.: URL de uma postagem de blog)',
    textLabel: 'Conteúdo de texto',
    textPlaceholder: 'Digite ou cole o texto a ser convertido em podcast...',
    fileLabel: 'Enviar arquivo',
    fileDropHint: 'Clique ou arraste o arquivo para cá',
    fileSupported: 'Suporta formatos PDF, Word, Markdown e TXT',
    fileSelected: 'Arquivo selecionado',
    fileChange: 'Alterar arquivo',
    podcastOptions: 'Opções do podcast',
    podcastType: 'Tipo de podcast',
    singleHost: 'Apresentador único',
    dualHost: 'Dois apresentadores (entrevista)',
    voiceSelect: 'Seleção de voz',
    voiceHost: 'Voz do apresentador',
    voiceGuest: 'Voz do convidado',
    systemVoice: 'Voz do sistema',
    cloneVoice: 'Voz clonada',
    noCloneAvailable: 'Ainda não há vozes clonadas. Crie uma primeiro na aba "Clonar voz"',
    generate: 'Gerar podcast',
    generating: 'Gerando',
    scriptGenerating: 'Gerando roteiro...',
    audioSynthesizing: 'Sintetizando áudio...',
    segmentProgress: 'Sintetizando segmento {current}/{total}',
    audioFinalizing: 'Finalizando o áudio, aguarde...',
    scriptPreview: 'Pré-visualização do roteiro',
    scriptEditHint: 'Edite o roteiro após a geração e depois sintetize o áudio',
    audioPlayer: 'Player de áudio',
    noAudio: 'Ainda sem áudio',
    duration: 'Duração',
    cloneTitle: 'Clonagem de voz',
    cloneSubtitle: 'Clone sua voz com o modelo CosyVoice2',
    cloneName: 'Nome do clone',
    cloneNamePlaceholder: 'Dê um nome à sua voz clonada',
    cloneGender: 'Gênero',
    cloneGenderAuto: 'Detecção automática',
    cloneGenderMale: 'Masculino',
    cloneGenderFemale: 'Feminino',
    cloneDescription: 'Descrição (opcional)',
    cloneDescriptionPlaceholder: 'ex.: voz feminina suave, voz masculina grave',
    clonePromptText: 'Texto de referência (opcional, melhora a similaridade)',
    clonePromptPlaceholder: 'Transcrição do áudio (5 a 30 segundos)',
    cloneAudioFile: 'Áudio de referência',
    cloneAudioHint: 'Envie de 5 a 30 segundos de fala clara (wav/mp3/m4a)',
    cloneAudioSelected: 'Áudio selecionado',
    startClone: 'Iniciar clonagem',
    cloning: 'Clonando...',
    cloneSuccess: 'Clone criado com sucesso',
    cloneFailed: 'Falha na clonagem',
    cloneListTitle: 'Minhas vozes clonadas',
    cloneEmpty: 'Ainda não há vozes clonadas',
    clonePreview: 'Ouvir',
    cloneDelete: 'Excluir',
    cloneDeleteConfirm: 'Excluir esta voz clonada?',
    historyTitle: 'Histórico',
    historyEmpty: 'Nenhum podcast gerado ainda',
    historyCreatedAt: 'Criado em',
    historyDuration: 'Duração',
    historyScript: 'Roteiro',
    historyPlay: 'Reproduzir',
    historyDownload: 'Baixar',
    historyDelete: 'Excluir',
    historyDeleteConfirm: 'Excluir este registro do histórico?',
    historyClearAll: 'Limpar tudo',
    historyClearAllConfirm: 'Limpar todo o histórico? Esta ação não pode ser desfeita',
    settingsTitle: 'Configurações',
    settingsLanguage: 'Idioma da interface',
    settingsService: 'Serviço de voz',
    settingsServiceUrl: 'URL do serviço',
    settingsServiceUrlPlaceholder: 'http://localhost:8907',
    settingsServiceTimeout: 'Tempo limite da requisição (segundos)',
    settingsSave: 'Salvar configurações',
    settingsSaved: 'Configurações salvas',
    settingsReset: 'Restaurar padrão',
    settingsAbout: 'Sobre',
    settingsVersion: 'Versão',
    settingsPlatform: 'Plataforma',
    settingsArchitecture: 'Arquitetura',
    errServiceUnavailable: 'Serviço de voz indisponível. Verifique se o serviço está em execução',
    errCloneFailed: 'Falha na clonagem de voz. Tente novamente',
    errSynthFailed: 'Falha na síntese de áudio. Tente novamente',
    errScriptFailed: 'Falha na geração do roteiro. Tente novamente',
    errInvalidUrl: 'Insira uma URL válida',
    errEmptyText: 'Insira o conteúdo de texto',
    errNoFile: 'Selecione um arquivo',
    errNoCloneName: 'Insira um nome para o clone',
    errNoCloneAudio: 'Selecione um áudio de referência',
    errNetwork: 'Erro de rede. Verifique se o serviço está em execução',
    errTimeout: 'Tempo limite da requisição excedido',
    errCloneBusy: 'O serviço de síntese de voz está ocupado. Aguarde a conclusão da tarefa atual',
    errNoScript: 'Gere primeiro o roteiro do podcast',
    language: 'Idioma',
    chinese: '中文',
    english: 'English',
    regenerate: 'Ressintetizar',
    play: 'Reproduzir',
    pause: 'Pausar',
    download: 'Baixar',
    downloadSuccess: 'Baixado com sucesso',
    delete: 'Excluir',
    close: 'Fechar',
    cancel: 'Cancelar',
    confirm: 'Confirmar',
    noAudioGenerated: 'Nenhum áudio gerado ainda',
    synthesisComplete: 'Síntese concluída',
    selectVoice: 'Selecionar voz',
    useSystemVoice: 'Voz do sistema',
    useCloneVoice: 'Voz clonada',
    cloneNameRequired: 'Insira um nome para o clone',
    audioFileRequired: 'Selecione um arquivo de áudio',
    uploadAudio: 'Enviar áudio',
    previewLoading: 'Carregando...',
    playPreview: 'Ouvir',
    stopPreview: 'Parar',
    generatingScript: 'Gerando roteiro',
    synthesizingAudio: 'Sintetizando áudio',
    scriptGenerated: 'Roteiro gerado',
    audioReady: 'Áudio pronto',
    words: 'palavras',
    segments: 'segmentos',
    totalDuration: 'Duração total',
    deleteSuccess: 'Excluído',
    clearSuccess: 'Limpo',
    saveSettingsFirst: 'Salve as configurações primeiro',
    serviceUrlChanged: 'URL do serviço atualizada, verificando novamente...',
    archInfo: 'Arquitetura',
    appDescription: 'Gerador de podcasts com IA com clonagem de voz e suporte a vários idiomas',
    openSourceUrl: 'https://github.com/Aiven66/PodcastAI',
    noCloneYet: 'Nenhuma voz clonada',
    selectCloneOrSystem: 'Escolha voz do sistema ou clonada',
    createCloneFirst: 'Crie primeiro uma voz clonada',
    podcastGenerated: 'Podcast gerado',
    fileToLarge: 'Arquivo muito grande. Selecione um arquivo com menos de 50 MB',
    unsupportedFormat: 'Formato de arquivo não suportado',
    extractFileContent: 'Extraindo o conteúdo do arquivo...',
    fetchingUrl: 'Buscando o conteúdo da URL...',
    voice1Default: 'female-professional',
    voice2Default: 'male-narrator',
    serviceManager: 'Gerenciamento do serviço',
    serviceManagerDesc: 'Gerencie o serviço de voz Python local (para clonagem de voz e síntese de podcasts)',
    detectEnvironment: 'Detectar ambiente',
    detecting: 'Detectando...',
    detected: 'Resultado da detecção',
    pythonFound: 'Python instalado',
    pythonNotFound: 'Python não encontrado (3.10+ necessário)',
    pythonVersionLabel: 'Versão do Python',
    pythonPathLabel: 'Caminho do Python',
    voiceServiceFound: 'Serviço de voz instalado',
    voiceServiceNotFound: 'Diretório do serviço de voz não encontrado',
    voiceServicePathLabel: 'Caminho do serviço de voz',
    voiceServiceSelectDir: 'Selecionar diretório',
    voiceServiceDownload: 'Baixar serviço de voz',
    voiceServiceDownloadHint: 'Baixe o código-fonte do voice-service do GitHub e instale as dependências Python e os modelos CosyVoice2',
    modelsReady: 'Modelos CosyVoice2 prontos',
    modelsNotReady: 'Modelos CosyVoice2 não baixados (necessários para clonagem de voz)',
    startService: 'Iniciar serviço',
    stopService: 'Parar serviço',
    startingService: 'Iniciando...',
    stoppingService: 'Parando...',
    serviceStarted: 'Serviço de voz iniciado',
    serviceStopped: 'Serviço de voz parado',
    serviceStartFailed: 'Falha ao iniciar',
    serviceRunning: 'Serviço em execução',
    serviceNotRunning: 'Serviço parado',
    autoStartService: 'Iniciar serviço automaticamente ao abrir o app',
    autoStartHint: 'Se marcado, o serviço de voz inicia automaticamente ao abrir o app desktop',
    serviceLogs: 'Registros do serviço',
    clearLogs: 'Limpar registros',
    noLogs: 'Nenhum registro ainda',
    setupGuide: 'Guia de configuração',
    setupStep1: '1. Instale o Python 3.10+ (3.11 recomendado)',
    setupStep2: '2. Baixe o código-fonte do voice-service',
    setupStep3: '3. Crie um ambiente virtual: python3.11 -m venv venv',
    setupStep4: '4. Instale as dependências: ./venv/bin/pip install -r requirements.txt',
    setupStep5: '5. Baixe os modelos CosyVoice2 (execute bash setup_cosyvoice.sh)',
    setupStep6: '6. Selecione o diretório voice-service e clique em Iniciar serviço',
    offlineBanner: 'Serviço de voz offline. A clonagem de voz e a síntese de podcasts estão indisponíveis.',
    offlineBannerAction: 'Iniciar serviço',
    goToSettings: 'Ir para Configurações',
    processId: 'PID',
    selectVoiceServiceDir: 'Selecione o diretório voice-service',
    serviceAutoDetected: 'Caminho detectado automaticamente',
    pythonInstallUrl: 'https://www.python.org/downloads/',
    voiceServiceRepoUrl: 'https://github.com/Aiven66/PodcastAI',
    modelsPathHint: 'Caminho do modelo: voice-service/CosyVoice/pretrained_models/CosyVoice2-0.5B',
    openInFinder: 'Mostrar na pasta',
    refreshDetection: 'Atualizar detecção',
    serviceStatusCheck: 'Verificar status do serviço',
    portConflict: 'A porta 8907 pode estar em uso. Verifique se outro processo a está utilizando',
    modelManager: 'Modelo de voz',
    modelManagerDesc: 'Modelo de clonagem de voz CosyVoice2 (~3,7 GB, incluído, pronto para uso)',
    modelStatus: 'Status do modelo',
    modelReady: 'Modelo pronto',
    modelNotReady: 'Modelo não baixado',
    modelPartial: 'Parcialmente baixado',
    modelDownload: 'Baixar modelo',
    modelRedownload: 'Baixar novamente',
    modelAbort: 'Interromper',
    modelDownloading: 'Baixando...',
    modelDownloadComplete: 'Download do modelo concluído',
    modelDownloadFailed: 'Falha no download do modelo',
    modelDownloadAborted: 'Download interrompido',
    modelCurrentFile: 'Arquivo atual',
    modelProgress: 'Progresso',
    modelSpeed: 'Velocidade',
    modelFiles: 'Arquivos',
    modelSize: 'Tamanho',
    modelOpenDir: 'Mostrar na pasta',
    modelAutoStartHint: 'O serviço de voz inicia automaticamente ao abrir o app — sem configuração manual',
    runtimeManager: 'Runtime Python',
    runtimeManagerDesc: 'Runtime Python integrado (excluído do instalador, baixado e extraído automaticamente no primeiro início)',
    runtimeStatus: 'Status do runtime',
    runtimeReady: 'Pronto',
    runtimeNotReady: 'Não instalado',
    runtimeDownload: 'Baixar runtime',
    runtimeRedownload: 'Baixar novamente',
    runtimeAbort: 'Cancelar',
    runtimeDownloading: 'Baixando...',
    runtimeExtracting: 'Extraindo...',
    runtimeVerifying: 'Verificando...',
    runtimeDownloadComplete: 'Runtime pronto',
    runtimeDownloadFailed: 'Falha no download do runtime',
    runtimeDownloadAborted: 'Download cancelado',
    runtimeOpenDir: 'Mostrar na pasta',
    serviceAutoStarting: 'Iniciando o serviço de voz...',
  },

  // ─── Русский ───
  ru: {
    appName: 'PodcastAI',
    loading: 'Загрузка...',
    navPodcast: 'Создать подкаст',
    navClone: 'Клонирование голоса',
    navHistory: 'История',
    navSettings: 'Настройки',
    serviceStatus: 'Состояние сервиса',
    serviceOnline: 'Онлайн',
    serviceOffline: 'Офлайн',
    serviceBusy: 'Синтез',
    serviceCheckFailed: 'Ошибка проверки',
    serviceHint: 'Запустите локальный Python-сервис голоса (порт по умолчанию 8907)',
    currentAccount: 'Аккаунт',
    notLoggedIn: 'Не выполнен вход',
    signOut: 'Выйти',
    switchAccount: 'Сменить аккаунт',
    themeLabel: 'Тема',
    themeLight: 'Светлая',
    themeDark: 'Тёмная',
    podcastTitle: 'Создание подкаста',
    podcastSubtitle: 'Превращайте ссылки, текст или файлы в качественные подкасты',
    inputMethod: 'Способ ввода',
    inputUrl: 'Ввод ссылки',
    inputText: 'Ввод текста',
    inputFile: 'Загрузка файла',
    urlLabel: 'Ссылка на статью',
    urlPlaceholder: 'Вставьте ссылку на статью (например, ссылку на пост в блоге)',
    textLabel: 'Текст',
    textPlaceholder: 'Введите или вставьте текст для преобразования в подкаст...',
    fileLabel: 'Загрузить файл',
    fileDropHint: 'Нажмите или перетащите файл сюда',
    fileSupported: 'Поддерживаются форматы PDF, Word, Markdown, TXT',
    fileSelected: 'Файл выбран',
    fileChange: 'Изменить файл',
    podcastOptions: 'Параметры подкаста',
    podcastType: 'Тип подкаста',
    singleHost: 'Один ведущий',
    dualHost: 'Два ведущих (интервью)',
    voiceSelect: 'Выбор голоса',
    voiceHost: 'Голос ведущего',
    voiceGuest: 'Голос гостя',
    systemVoice: 'Системный голос',
    cloneVoice: 'Клонированный голос',
    noCloneAvailable: 'Пока нет клонированных голосов. Сначала создайте их на вкладке «Клонирование голоса»',
    generate: 'Создать подкаст',
    generating: 'Создание',
    scriptGenerating: 'Генерация сценария...',
    audioSynthesizing: 'Синтез аудио...',
    segmentProgress: 'Синтез фрагмента {current}/{total}',
    audioFinalizing: 'Завершение синтеза аудио, подождите...',
    scriptPreview: 'Предпросмотр сценария',
    scriptEditHint: 'После генерации отредактируйте сценарий, затем синтезируйте аудио',
    audioPlayer: 'Аудиоплеер',
    noAudio: 'Аудио пока нет',
    duration: 'Длительность',
    cloneTitle: 'Клонирование голоса',
    cloneSubtitle: 'Клонируйте свой голос с помощью модели CosyVoice2',
    cloneName: 'Название клона',
    cloneNamePlaceholder: 'Придумайте название для клонированного голоса',
    cloneGender: 'Пол',
    cloneGenderAuto: 'Определить автоматически',
    cloneGenderMale: 'Мужской',
    cloneGenderFemale: 'Женский',
    cloneDescription: 'Описание (необязательно)',
    cloneDescriptionPlaceholder: 'например: тёплый женский, низкий мужской',
    clonePromptText: 'Опорный текст (необязательно, повышает схожесть)',
    clonePromptPlaceholder: 'Расшифровка аудио (5–30 секунд)',
    cloneAudioFile: 'Опорное аудио',
    cloneAudioHint: 'Загрузите 5–30 секунд чистой речи (wav/mp3/m4a)',
    cloneAudioSelected: 'Аудио выбрано',
    startClone: 'Начать клонирование',
    cloning: 'Клонирование...',
    cloneSuccess: 'Клон успешно создан',
    cloneFailed: 'Не удалось клонировать',
    cloneListTitle: 'Мои клонированные голоса',
    cloneEmpty: 'Пока нет клонированных голосов',
    clonePreview: 'Прослушать',
    cloneDelete: 'Удалить',
    cloneDeleteConfirm: 'Удалить этот клонированный голос?',
    historyTitle: 'История',
    historyEmpty: 'Подкасты пока не создавались',
    historyCreatedAt: 'Создано',
    historyDuration: 'Длительность',
    historyScript: 'Сценарий',
    historyPlay: 'Воспроизвести',
    historyDownload: 'Скачать',
    historyDelete: 'Удалить',
    historyDeleteConfirm: 'Удалить эту запись из истории?',
    historyClearAll: 'Очистить всё',
    historyClearAllConfirm: 'Очистить всю историю? Действие необратимо',
    settingsTitle: 'Настройки',
    settingsLanguage: 'Язык интерфейса',
    settingsService: 'Голосовой сервис',
    settingsServiceUrl: 'Адрес сервиса',
    settingsServiceUrlPlaceholder: 'http://localhost:8907',
    settingsServiceTimeout: 'Таймаут запроса (секунды)',
    settingsSave: 'Сохранить настройки',
    settingsSaved: 'Настройки сохранены',
    settingsReset: 'Восстановить по умолчанию',
    settingsAbout: 'О программе',
    settingsVersion: 'Версия',
    settingsPlatform: 'Платформа',
    settingsArchitecture: 'Архитектура',
    errServiceUnavailable: 'Голосовой сервис недоступен. Проверьте, запущен ли он',
    errCloneFailed: 'Не удалось клонировать голос. Попробуйте снова',
    errSynthFailed: 'Не удалось синтезировать аудио. Попробуйте снова',
    errScriptFailed: 'Не удалось сгенерировать сценарий. Попробуйте снова',
    errInvalidUrl: 'Введите корректную ссылку',
    errEmptyText: 'Введите текст',
    errNoFile: 'Выберите файл',
    errNoCloneName: 'Введите название клона',
    errNoCloneAudio: 'Выберите опорное аудио',
    errNetwork: 'Ошибка сети. Проверьте, запущен ли сервис',
    errTimeout: 'Таймаут запроса',
    errCloneBusy: 'Сервис синтеза голоса занят. Дождитесь завершения текущей задачи',
    errNoScript: 'Сначала сгенерируйте сценарий подкаста',
    language: 'Язык',
    chinese: '中文',
    english: 'English',
    regenerate: 'Синтезировать заново',
    play: 'Воспроизвести',
    pause: 'Пауза',
    download: 'Скачать',
    downloadSuccess: 'Успешно скачано',
    delete: 'Удалить',
    close: 'Закрыть',
    cancel: 'Отмена',
    confirm: 'Подтвердить',
    noAudioGenerated: 'Аудио ещё не сгенерировано',
    synthesisComplete: 'Синтез завершён',
    selectVoice: 'Выбор голоса',
    useSystemVoice: 'Системный голос',
    useCloneVoice: 'Клонированный голос',
    cloneNameRequired: 'Введите название клона',
    audioFileRequired: 'Выберите аудиофайл',
    uploadAudio: 'Загрузить аудио',
    previewLoading: 'Загрузка...',
    playPreview: 'Прослушать',
    stopPreview: 'Стоп',
    generatingScript: 'Генерация сценария',
    synthesizingAudio: 'Синтез аудио',
    scriptGenerated: 'Сценарий сгенерирован',
    audioReady: 'Аудио готово',
    words: 'слов',
    segments: 'фрагментов',
    totalDuration: 'Общая длительность',
    deleteSuccess: 'Удалено',
    clearSuccess: 'Очищено',
    saveSettingsFirst: 'Сначала сохраните настройки',
    serviceUrlChanged: 'Адрес сервиса обновлён, повторная проверка...',
    archInfo: 'Архитектура',
    appDescription: 'ИИ-генератор подкастов с клонированием голоса и поддержкой нескольких языков',
    openSourceUrl: 'https://github.com/Aiven66/PodcastAI',
    noCloneYet: 'Нет клонированных голосов',
    selectCloneOrSystem: 'Выберите системный или клонированный голос',
    createCloneFirst: 'Сначала создайте клонированный голос',
    podcastGenerated: 'Подкаст создан',
    fileToLarge: 'Файл слишком большой. Выберите файл меньше 50 МБ',
    unsupportedFormat: 'Неподдерживаемый формат файла',
    extractFileContent: 'Извлечение содержимого файла...',
    fetchingUrl: 'Получение содержимого по ссылке...',
    voice1Default: 'female-professional',
    voice2Default: 'male-narrator',
    serviceManager: 'Управление сервисом',
    serviceManagerDesc: 'Управление локальным Python-сервисом голоса (для клонирования и синтеза подкастов)',
    detectEnvironment: 'Проверить окружение',
    detecting: 'Проверка...',
    detected: 'Результат проверки',
    pythonFound: 'Python установлен',
    pythonNotFound: 'Python не найден (требуется 3.10+)',
    pythonVersionLabel: 'Версия Python',
    pythonPathLabel: 'Путь к Python',
    voiceServiceFound: 'Голосовой сервис установлен',
    voiceServiceNotFound: 'Каталог голосового сервиса не найден',
    voiceServicePathLabel: 'Путь к голосовому сервису',
    voiceServiceSelectDir: 'Выбрать каталог',
    voiceServiceDownload: 'Скачать голосовой сервис',
    voiceServiceDownloadHint: 'Скачивает исходный код voice-service с GitHub, затем устанавливает зависимости Python и модели CosyVoice2',
    modelsReady: 'Модели CosyVoice2 готовы',
    modelsNotReady: 'Модели CosyVoice2 не скачаны (нужны для клонирования голоса)',
    startService: 'Запустить сервис',
    stopService: 'Остановить сервис',
    startingService: 'Запуск...',
    stoppingService: 'Остановка...',
    serviceStarted: 'Голосовой сервис запущен',
    serviceStopped: 'Голосовой сервис остановлен',
    serviceStartFailed: 'Не удалось запустить',
    serviceRunning: 'Сервис работает',
    serviceNotRunning: 'Сервис остановлен',
    autoStartService: 'Автозапуск сервиса при старте приложения',
    autoStartHint: 'Если включено, голосовой сервис запускается автоматически при открытии приложения',
    serviceLogs: 'Журналы сервиса',
    clearLogs: 'Очистить журналы',
    noLogs: 'Журналов пока нет',
    setupGuide: 'Инструкция по настройке',
    setupStep1: '1. Установите Python 3.10+ (рекомендуется 3.11)',
    setupStep2: '2. Скачайте исходный код voice-service',
    setupStep3: '3. Создайте виртуальное окружение: python3.11 -m venv venv',
    setupStep4: '4. Установите зависимости: ./venv/bin/pip install -r requirements.txt',
    setupStep5: '5. Скачайте модели CosyVoice2 (выполните bash setup_cosyvoice.sh)',
    setupStep6: '6. Выберите каталог voice-service и нажмите «Запустить сервис»',
    offlineBanner: 'Голосовой сервис офлайн. Клонирование голоса и синтез подкастов недоступны.',
    offlineBannerAction: 'Запустить сервис',
    goToSettings: 'Перейти в настройки',
    processId: 'PID',
    selectVoiceServiceDir: 'Выберите каталог voice-service',
    serviceAutoDetected: 'Путь определён автоматически',
    pythonInstallUrl: 'https://www.python.org/downloads/',
    voiceServiceRepoUrl: 'https://github.com/Aiven66/PodcastAI',
    modelsPathHint: 'Путь к модели: voice-service/CosyVoice/pretrained_models/CosyVoice2-0.5B',
    openInFinder: 'Показать в папке',
    refreshDetection: 'Обновить проверку',
    serviceStatusCheck: 'Проверить состояние сервиса',
    portConflict: 'Порт 8907 может быть занят. Проверьте, не использует ли его другой процесс',
    modelManager: 'Голосовая модель',
    modelManagerDesc: 'Модель клонирования голоса CosyVoice2 (~3,7 ГБ, встроена, готова к работе)',
    modelStatus: 'Состояние модели',
    modelReady: 'Модель готова',
    modelNotReady: 'Модель не скачана',
    modelPartial: 'Частично скачана',
    modelDownload: 'Скачать модель',
    modelRedownload: 'Скачать заново',
    modelAbort: 'Прервать',
    modelDownloading: 'Скачивание...',
    modelDownloadComplete: 'Скачивание модели завершено',
    modelDownloadFailed: 'Ошибка скачивания модели',
    modelDownloadAborted: 'Скачивание прервано',
    modelCurrentFile: 'Текущий файл',
    modelProgress: 'Прогресс',
    modelSpeed: 'Скорость',
    modelFiles: 'Файлы',
    modelSize: 'Размер',
    modelOpenDir: 'Показать в папке',
    modelAutoStartHint: 'Голосовой сервис запускается автоматически при старте приложения — настройка не требуется',
    runtimeManager: 'Среда выполнения Python',
    runtimeManagerDesc: 'Встроенная среда выполнения Python (исключена из установщика, автоматически загружается и распаковывается при первом запуске)',
    runtimeStatus: 'Статус среды',
    runtimeReady: 'Готово',
    runtimeNotReady: 'Не установлено',
    runtimeDownload: 'Загрузить среду',
    runtimeRedownload: 'Перезагрузить',
    runtimeAbort: 'Прервать',
    runtimeDownloading: 'Загрузка...',
    runtimeExtracting: 'Распаковка...',
    runtimeVerifying: 'Проверка...',
    runtimeDownloadComplete: 'Среда готова',
    runtimeDownloadFailed: 'Не удалось загрузить среду',
    runtimeDownloadAborted: 'Загрузка прервана',
    runtimeOpenDir: 'Показать в папке',
    serviceAutoStarting: 'Голосовой сервис запускается...',
  },
}

// ════════════════════════════════════════════════════════════
// 系统声音模板
// ════════════════════════════════════════════════════════════
const VOICE_TEMPLATES = [
  { id: 'female-professional', nameZh: 'Sarah 晓晓（专业女主播）', nameEn: 'Sarah (Professional Female Host)', gender: 'Female' },
  { id: 'female-friendly', nameZh: 'Emma 晓伊（友好亲切）', nameEn: 'Emma (Friendly & Warm)', gender: 'Female' },
  { id: 'female-northeast', nameZh: 'Beibei 小北（东北话）', nameEn: 'Beibei (Northeast Dialect)', gender: 'Female' },
  { id: 'female-shaanxi', nameZh: 'Nini 小妮（陕西话）', nameEn: 'Nini (Shaanxi Dialect)', gender: 'Female' },
  { id: 'male-narrator', nameZh: 'David 云希（经典叙述）', nameEn: 'David (Classic Narration)', gender: 'Male' },
  { id: 'male-deep', nameZh: 'James 云健（低沉磁性）', nameEn: 'James (Deep & Magnetic)', gender: 'Male' },
  { id: 'male-sunny', nameZh: 'Tom 云扬（阳光活力）', nameEn: 'Tom (Sunny & Energetic)', gender: 'Male' },
  { id: 'male-youth', nameZh: 'Leo 云夏（青春少年）', nameEn: 'Leo (Youthful Boy)', gender: 'Male' },
  { id: 'en-female-jenny', nameZh: 'Jenny (US English)', nameEn: 'Jenny (US English)', gender: 'Female' },
  { id: 'en-female-ariana', nameZh: 'Aria (US English)', nameEn: 'Aria (US English)', gender: 'Female' },
  { id: 'en-female-sarah', nameZh: 'Sarah (UK English)', nameEn: 'Sarah (UK English)', gender: 'Female' },
  { id: 'en-male-guy', nameZh: 'Guy (US English)', nameEn: 'Guy (US English)', gender: 'Male' },
  { id: 'en-male-ryan', nameZh: 'Ryan (US English)', nameEn: 'Ryan (US English)', gender: 'Male' },
  { id: 'en-male-james', nameZh: 'James (UK English)', nameEn: 'James (UK English)', gender: 'Male' },
]

// ════════════════════════════════════════════════════════════
// 多语言支持（与 web 端 src/lib/i18n/locales.ts 保持一致）
// ════════════════════════════════════════════════════════════
const LOCALE_OPTIONS = [
  { code: 'en', nativeName: 'English', htmlLang: 'en' },
  { code: 'zh', nativeName: '中文', htmlLang: 'zh-CN' },
  { code: 'ja', nativeName: '日本語', htmlLang: 'ja' },
  { code: 'ko', nativeName: '한국어', htmlLang: 'ko' },
  { code: 'es', nativeName: 'Español', htmlLang: 'es' },
  { code: 'fr', nativeName: 'Français', htmlLang: 'fr' },
  { code: 'de', nativeName: 'Deutsch', htmlLang: 'de' },
  { code: 'pt', nativeName: 'Português', htmlLang: 'pt' },
  { code: 'ru', nativeName: 'Русский', htmlLang: 'ru' },
]
const SUPPORTED_LOCALE_CODES = LOCALE_OPTIONS.map((l) => l.code)

/** 首次启动时根据系统语言推断界面语言，无法识别时回退英文 */
function detectSystemLocale() {
  const candidates = [navigator.language, ...(navigator.languages || [])]
  for (const raw of candidates) {
    if (!raw) continue
    const base = String(raw).toLowerCase().split('-')[0]
    if (SUPPORTED_LOCALE_CODES.includes(base)) return base
  }
  return 'en'
}

function localeHtmlLang(locale) {
  const meta = LOCALE_OPTIONS.find((l) => l.code === locale)
  return meta ? meta.htmlLang : locale
}

// ════════════════════════════════════════════════════════════
// 应用状态
// ════════════════════════════════════════════════════════════
const savedLocale = localStorage.getItem('podcastai-locale')
const state = {
  // 优先级：用户手动选择 > 系统语言 > 英文
  locale: SUPPORTED_LOCALE_CODES.includes(savedLocale) ? savedLocale : detectSystemLocale(),
  serviceUrl: localStorage.getItem('podcastai-service-url') || 'http://localhost:8907',
  serviceTimeout: parseInt(localStorage.getItem('podcastai-timeout') || '60', 10),
  theme: localStorage.getItem('podcastai-theme') || 'light',
  serviceStatus: 'unknown',
  activeView: 'podcast',
  inputMethod: 'url',
  podcastType: 'single',
  voice1: 'female-professional',
  voice2: 'male-narrator',
  clones: [],
  history: JSON.parse(localStorage.getItem('podcastai-history') || '[]'),
  isGenerating: false,
  isCloning: false,
  progress: { current: 0, total: 0, stage: '' },
  synthFinalizing: false,
  audioBuffer: null, // v1.0.17: 保存音频 ArrayBuffer 用于 IPC 下载
  scriptText: '',
  audioUrl: null,
  audioBlob: null,
  synthError: null, // v1.0.26: 合成错误信息（持久显示）
  // 表单
  urlInput: '',
  textInput: '',
  uploadedFile: null,
  uploadedFileContent: '',
  cloneName: '',
  cloneGender: '',
  cloneDescription: '',
  clonePromptText: '',
  cloneAudioFile: null,
  // 预览
  previewAudio: null,
  previewPlayingId: null,
  previewLoadingId: null,
  // v1.0.9: 播客页面声音试听
  podcastVoiceAudio: null,
  podcastVoicePlaying: null,  // 'voice1' | 'voice2' | null
  podcastVoiceLoading: null,  // 'voice1' | 'voice2' | null
  // 服务管理器
  serviceManager: {
    detecting: false,
    isStarting: false,
    isStopping: false,
    detection: null, // { python, pythonVersion, venvPython, voiceServicePath, hasMainPy, hasVenv, hasModels, platform }
    processRunning: false,
    processPid: null,
    logs: [],
    autoStart: false,
    settingsLoaded: false,
  },
  // 模型下载（v1.0.4）
  model: {
    status: null, // { ready, existing, total, missing }
    downloadState: {
      isDownloading: false,
      currentFile: '',
      currentIndex: 0,
      totalFiles: 0,
      bytesDownloaded: 0,
      totalBytes: 0,
      speed: 0,
      error: null,
      percent: 0,
    },
  },
  // v1.0.79: Python 运行时（安装包剥离，首次启动下载）
  runtime: {
    installed: false,
    downloadState: {
      isDownloading: false,
      stage: 'idle',
      bytesDownloaded: 0,
      totalBytes: 0,
      speed: 0,
      error: null,
      installed: false,
      percent: 0,
    },
  },
  // 客户端版本信息（init 时异步加载）
  appVersion: { version: '1.0.5', platform: 'unknown', arch: 'unknown' },
  // v1.0.31: 认证状态
  auth: {
    isAuthenticated: false,
    token: null,
    email: null,
    name: null,
    userId: null,
  },
}

// ════════════════════════════════════════════════════════════
// 工具函数
// ════════════════════════════════════════════════════════════
function t(key, params = {}) {
  // 当前语言字典 → (中文回退 zh，其余回退 en) → key 本身
  const fallback = state.locale === 'zh' ? I18N.zh[key] : I18N.en[key]
  let str = (I18N[state.locale] && I18N[state.locale][key]) || fallback || key
  for (const [k, v] of Object.entries(params)) {
    str = str.replace(`{${k}}`, v)
  }
  return str
}

function voiceName(template) {
  return state.locale === 'zh' ? template.nameZh : template.nameEn
}

function formatTime(seconds) {
  if (!seconds || isNaN(seconds)) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function formatDate(timestamp) {
  const d = new Date(timestamp)
  const now = Date.now()
  const diff = now - timestamp
  if (diff < 60000) return state.locale === 'zh' ? '刚刚' : 'just now'
  if (diff < 3600000) return state.locale === 'zh' ? `${Math.floor(diff/60000)}分钟前` : `${Math.floor(diff/60000)}m ago`
  if (diff < 86400000) return state.locale === 'zh' ? `${Math.floor(diff/3600000)}小时前` : `${Math.floor(diff/3600000)}h ago`
  return d.toLocaleDateString(localeHtmlLang(state.locale))
}

function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let i = 0
  let v = bytes
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  return `${v.toFixed(i === 0 ? 0 : (v < 10 ? 2 : 1))} ${units[i]}`
}

function toast(message, type = 'info') {
  const container = document.getElementById('toast-container')
  const colors = {
    info: 'bg-blue-600',
    success: 'bg-green-600',
    error: 'bg-red-600',
    warning: 'bg-amber-600',
  }
  const el = document.createElement('div')
  el.className = `toast-enter pointer-events-auto px-4 py-3 rounded-lg shadow-lg text-white text-sm max-w-sm ${colors[type] || colors.info}`
  el.textContent = message
  container.appendChild(el)
  // v1.0.26: 错误类型 toast 持续 10 秒，其他类型 3.5 秒
  const duration = type === 'error' ? 10000 : 3500
  setTimeout(() => {
    el.style.opacity = '0'
    el.style.transition = 'opacity 0.3s'
    setTimeout(() => el.remove(), 300)
  }, duration)
}

// ════════════════════════════════════════════════════════════
// API 调用
// ════════════════════════════════════════════════════════════
async function checkServiceHealth() {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 5000)
    const res = await fetch(`${state.serviceUrl}/health`, { signal: controller.signal })
    clearTimeout(timer)
    if (!res.ok) {
      state.serviceStatus = 'offline'
      return false
    }
    const data = await res.json()
    state.serviceStatus = data.cosyvoice_busy ? 'busy' : 'online'
    return true
  } catch (err) {
    state.serviceStatus = 'offline'
    return false
  }
}

async function fetchClones() {
  try {
    const res = await fetch(`${state.serviceUrl}/clones`)
    if (!res.ok) return
    const data = await res.json()
    state.clones = Array.isArray(data.clones) ? data.clones : (Array.isArray(data) ? data : [])
  } catch (err) {
    console.error('Failed to fetch clones:', err)
  }
}

async function createClone(formData) {
  const res = await fetch(`${state.serviceUrl}/clone`, {
    method: 'POST',
    body: formData,
  })
  if (!res.ok) {
    const errText = await res.text()
    throw new Error(errText || `HTTP ${res.status}`)
  }
  return await res.json()
}

async function synthesizePodcast(script, cloneIds, podcastType, voice1, voice2, onProgress) {
  const formData = new FormData()
  formData.append('script', script)
  formData.append('clone_ids', JSON.stringify(cloneIds || []))
  formData.append('podcast_type', podcastType)
  formData.append('voice1', voice1 || '')
  formData.append('voice2', voice2 || '')

  // v1.0.28: 空闲超时机制（从 3 分钟增加到 10 分钟）
  // 后端每 10 秒发送心跳，正常情况下不会触发超时
  // 但 HTTP 缓冲可能导致心跳延迟，10 分钟更安全
  // 配合 main.ts 自动重启 + renderer.js 重试机制，即使超时也能恢复
  const controller = new AbortController()
  let _idleTimeoutId = setTimeout(() => controller.abort(), 10 * 60 * 1000)
  const _resetIdleTimer = () => {
    clearTimeout(_idleTimeoutId)
    _idleTimeoutId = setTimeout(() => controller.abort(), 10 * 60 * 1000)
  }

  // v1.0.30: 用 try-finally 确保函数退出时 abort controller
  // 防止重试时旧请求的 TCP 连接残留，导致后端 Broken pipe
  try {
  let res
  try {
    res = await fetch(`${state.serviceUrl}/synthesize-podcast`, {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    })
  } catch (fetchErr) {
    clearTimeout(_idleTimeoutId)
    if (fetchErr.name === 'AbortError') {
      throw new Error('语音服务连接超时（10 分钟内无响应，可能服务已崩溃，正在尝试自动恢复）')
    }
    // v1.0.28: BodyStreamBuffer was aborted 等网络错误也触发重试
    throw fetchErr
  }

  if (!res.ok) {
    clearTimeout(_idleTimeoutId)
    const errText = await res.text()
    throw new Error(errText || `HTTP ${res.status}`)
  }

  // 检查响应类型：SSE 流（text/event-stream）或直接音频
  const contentType = res.headers.get('content-type') || ''

  if (contentType.includes('text/event-stream') || contentType.includes('application/x-ndjson')) {
    // v1.0.11: 后端使用 application/x-ndjson（每行一个 JSON），按行分隔
    // 兼容 SSE（\n\n）和 ndjson（\n）两种格式
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    const audioChunks = []

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        // v1.0.27: 每次收到数据就重置空闲计时器，证明服务还活着
        _resetIdleTimer()
        buffer += decoder.decode(value, { stream: true })

        // v1.0.11: 兼容 \n\n (SSE) 和 \n (ndjson) 分隔
        // 后端 _send_event 输出格式：JSON + "\n"
        const events = buffer.split('\n')
        buffer = events.pop() || '' // 保留最后一段未完成的内容

        for (const evt of events) {
          const line = evt.trim()
          if (!line) continue
          // 兼容 SSE "data: ..." 前缀和裸 JSON
          const jsonStr = line.startsWith('data:') ? line.slice(5).trim() : line
          if (!jsonStr) continue
          try {
            const data = JSON.parse(jsonStr)
            if (data.type === 'segment_start' && onProgress) {
              onProgress({ stage: 'synth', current: data.segment_index + 1, total: data.total_segments })
            } else if (data.type === 'segment_done' && onProgress) {
              // v1.0.11: 段完成也更新进度（更细粒度反馈）
              onProgress({ stage: 'synth', current: data.segment_index + 1, total: data.total_segments })
            } else if (data.type === 'finalizing') {
              // v1.0.15: 后端进入最终合并阶段，前端切换到 finalizing UI
              // 避免段合成 100% 后无反馈的卡死假象
              if (onProgress) onProgress({ stage: 'finalizing', current: 0, total: 0 })
            } else if (data.type === 'audio' && data.url) {
              // 下载音频分段
              const audioRes = await fetch(`${state.serviceUrl}${data.url}`)
              if (audioRes.ok) {
                const chunk = await audioRes.arrayBuffer()
                audioChunks.push(chunk)
              }
            } else if (data.type === 'complete' && data.audio_url) {
              // 兼容旧版 complete 事件
              clearTimeout(_idleTimeoutId)
              // v1.0.20: 回退到 ArrayBuffer 下载方案
              // v1.0.18 的 HTTP URL 方案在 Electron <audio> 中时长为 0（StaticFiles CORS/MIME 问题）
              const dlUrl = `${state.serviceUrl}${data.audio_url}`
              console.log('[Podcast] Downloading audio from:', dlUrl)
              const audioRes = await fetch(dlUrl)
              if (audioRes.ok) {
                const buf = await audioRes.arrayBuffer()
                console.log('[Podcast] Audio downloaded:', buf.byteLength, 'bytes')
                if (buf.byteLength > 0) return buf
                throw new Error('Downloaded audio is empty (0 bytes)')
              }
              throw new Error(`Failed to download audio (HTTP ${audioRes.status})`)
            } else if (data.type === 'done' && data.audio_url) {
              // v1.0.11: 后端实际发送的是 done 事件（之前前端只认 complete，导致拿不到音频）
              clearTimeout(_idleTimeoutId)
              // v1.0.20: 回退到 ArrayBuffer 下载方案
              // v1.0.18 的 HTTP URL 方案在 Electron <audio> 中时长为 0
              // blob URL 在 CSP 允许 blob: media-src 的情况下可以正常播放
              const dlUrl = `${state.serviceUrl}${data.audio_url}`
              console.log('[Podcast] Downloading audio from:', dlUrl)
              const audioRes = await fetch(dlUrl)
              if (audioRes.ok) {
                const buf = await audioRes.arrayBuffer()
                console.log('[Podcast] Audio downloaded:', buf.byteLength, 'bytes')
                if (buf.byteLength > 0) return buf
                throw new Error('Downloaded audio is empty (0 bytes)')
              }
              throw new Error(`Failed to download audio (HTTP ${audioRes.status})`)
            } else if (data.type === 'error') {
              clearTimeout(_idleTimeoutId)
              throw new Error(data.message || data.error || 'Synthesis failed')
            }
            // 忽略 start / heartbeat / segment_failed 等事件
          } catch (e) {
            // v1.0.17: 区分 JSON 解析错误和业务错误
            // - JSON 解析失败：warn 并继续（不影响后续事件）
            // - 业务错误（下载失败、超时、error 事件）：重新抛出，让外层 catch 处理
            if (e instanceof SyntaxError) {
              console.warn('Failed to parse event JSON:', line, e)
            } else {
              // 业务错误，重新抛出
              throw e
            }
          }
        }
      }
    } finally {
      clearTimeout(_idleTimeoutId)
    }

    // v1.0.26: 流结束但没拿到 done 事件
    // 之前返回 null 会导致上层抛"返回空结果"，但真实原因可能是后端异常未发 done 事件
    if (audioChunks.length > 0) {
      // v1.0.20: 返回分块的 ArrayBuffer（降级方案）
      console.warn('[Podcast] Stream ended without done event, using collected chunks:', audioChunks.length)
      return audioChunks[0]
    }
    // v1.0.26: 抛出明确错误，避免上层收到 null 后给出"返回空结果"这种误导性提示
    // v1.0.30: 错误信息包含 "aborted" 关键词，使上层重试机制可以识别并重试
    throw new Error('音频流结束但未收到完成事件（后端可能异常退出或连接中断，请查看服务日志）[aborted]')
  } else if (contentType.includes('audio/')) {
    clearTimeout(_idleTimeoutId)
    // v1.0.20: 直接返回音频 ArrayBuffer
    return await res.arrayBuffer()
  } else {
    clearTimeout(_idleTimeoutId)
    // JSON 响应（可能是错误或降级）
    const data = await res.json().catch(() => ({}))
    if (data.error) throw new Error(data.error)
    if (data.audioUrl) {
      // v1.0.20: 下载音频到 ArrayBuffer
      const audioRes = await fetch(`${state.serviceUrl}${data.audioUrl}`)
      if (audioRes.ok) return await audioRes.arrayBuffer()
    }
    throw new Error('Unexpected response format')
  }
  } finally {
    // v1.0.30: 确保函数退出时关闭连接
    // 防止重试时旧请求的 TCP 连接残留，导致后端 Broken pipe
    clearTimeout(_idleTimeoutId)
    try { controller.abort() } catch(e) {}
  }
}

// v1.0.23: 内置播客脚本生成算法（不依赖在线 API）
// 参考 route.ts 的降级算法，增加元信息过滤和口语化重组
function generatePodcastScriptLocal(content, podcastType) {
  // 1) 噪声行过滤（整行匹配，用于有换行的内容）
  const NOISE_LINE_PATTERNS = [
    /^你说的完全正确/, /^作者[：:]/, /^来源[：:]/, /^出处[：:]/, /^转自[：:]/,
    /^本文作者/, /^公众号/, /^微信公号/, /^商务合作/, /^投稿邮箱/, /^联系方式/,
    /^扫码/, /^长按/, /二维码/, /关注公众号/, /回复.*获取/, /点击.*链接/,
    /阅读原文/, /查看更多/, /下载.*APP/, /进入.*小程序/,
    /点赞转发/, /记得关注/, /星标/, /轻点两下/, /取消赞|取消在看/,
    /^赞$/, /^在看$/, /^分享$/, /^留言$/, /^收藏$/, /^听过$/, /^原创$/, /^赞赏$/,
    /长按.*二维码/, /扫描.*关注/, /点击.*关注/, /欢迎.*关注/, /更多精彩/,
    /版权归原作者/, /本文.*首发/, /此文.*转载/, /每天都在更新/,
    /觉得文章还不错/, /附在文后|文末有|附在文末/, /^@[作作]者/,
    /^--end--$/, /↑阅读之前记得关注/, /如果觉得文章还不错/,
    /在小说阅读器/, /^去阅读$/, /沉浸阅读/, /读本章/,
    /视频加载失败/, /请刷新页面/, /^刷新\s*$/,
  ]

  // 2) 段落内噪声片段替换
  const NOISE_FRAGMENT_PATTERNS = [
    [/你说的完全正确/g, ''], [/作者[：:][^\n]*/g, ''], [/来源[：:][^\n]*/g, ''],
    [/出处[：:][^\n]*/g, ''], [/公众号[：:]?[^\n]*/g, ''], [/关注公众号[^\n]*/g, ''],
    [/扫码关注[^\n]*/g, ''], [/长按.*二维码[^\n]*/g, ''],
    [/[+＋]星标/g, ''], [/视频加载失败，?请刷新页面再试/g, ''],
    [/@[作作]者：?[^\n]*/g, ''], [/轻点两下取消(赞|在看)/g, ''],
    // v1.0.41: 移除微信阅读器等噪声短语（不是整行，是片段）
    [/在小说阅读器读本章/g, ''], [/在小说阅读器中沉浸阅读/g, ''], [/去阅读/g, ''],
  ]

  // v1.0.41: 关键修复 — URL 提取的内容通常是单行（所有换行被 \s+ 替换成空格）
  // 旧逻辑用 content.split('\n') 按段落过滤噪声，但单行内容会被 NOISE_LINE_PATTERNS
  // 整体拒绝（只要包含"在小说阅读器"等关键词，整个 15K 字内容全部被丢弃）
  // 修复：先将噪声片段替换掉，再按句子（。！？）分割，最后按句子级过滤噪声
  let cleanedContent = content
  for (const [pattern, replacement] of NOISE_FRAGMENT_PATTERNS) {
    cleanedContent = cleanedContent.replace(pattern, replacement)
  }
  // 压缩多余空白
  cleanedContent = cleanedContent.replace(/\s+/g, ' ').trim()

  // 3) 按句子分割（而不是按段落，因为 URL 内容可能没有换行）
  const rawSentences = cleanedContent
    .split(/[。！？；]|[.!?](?=\s|$)/)
    .map(s => s.trim())
    .filter(s => s.length >= 8)

  // 4) 句子级噪声过滤
  const cleanSentences = []
  const seen = new Set()
  for (const s of rawSentences) {
    // 跳过噪声句子
    let isNoise = false
    for (const pattern of NOISE_LINE_PATTERNS) {
      if (pattern.test(s)) { isNoise = true; break }
    }
    if (isNoise) continue
    if (/^[\s\-=*_~`#>|+]+$/.test(s)) continue
    // 去重（前 20 字相同视为重复）
    const key = s.slice(0, 20)
    if (seen.has(key)) continue
    seen.add(key)
    cleanSentences.push(s)
  }

  // 5) 提取核心信息点
  // v1.0.42: 增加每条信息点长度（55→120字），保留更多细节，让播客内容更丰富
  const keyPoints = cleanSentences
    .map(s => {
      if (s.length <= 120) return s
      const cutPos = s.lastIndexOf('，', 110)
      if (cutPos > 30) return s.slice(0, cutPos)
      return s.slice(0, 110)
    })
    .filter(s => s.length >= 10)

  // v1.0.42: 增加脚本长度 — 旧值 8000/12000 字只生成约 20 分钟播客
  // 新值 20000/30000 字可生成 40-60 分钟播客，与真实播客时长一致
  const maxScriptChars = podcastType === 'dual' ? 30000 : 20000

  if (podcastType === 'dual') {
    // === 双人对话播客 ===
    const lines = []
    const firstPoint = keyPoints[0] || '一个值得关注的话题'
    const secondPoint = keyPoints[1] || '确实挺有意思的'

    // v1.0.23: 更自然的开场（参考商业访谈风格）
    lines.push('[主持人]')
    lines.push(`最近有个事儿挺值得聊聊的，${firstPoint}。`)
    lines.push('')
    lines.push('[嘉宾]')
    lines.push(`嗯，这个我也在关注。${secondPoint}。`)
    lines.push('')

    const hostLeadIns = [
      '那我能不能这样理解，', '你这个点其实是在说，', '我换一个角度问，',
      '等一下，你刚才说的那个点，', '说到这个，', '有个细节我想追问，',
      '这一点很关键，', '但我想提一个不同的看法，', '让我想到一个问题，',
    ]
    const guestLeadIns = [
      '对，', '没错，', '其实吧，', '我补充一下，',
      '而且还有一个点，', '有意思的是，', '具体来说，',
      '我换个说法，', '说得再直接一点，',
    ]

    let idx = 2
    let totalChars = firstPoint.length + secondPoint.length + 40
    let turn = 0

    while (idx < keyPoints.length && totalChars < maxScriptChars) {
      const content = keyPoints[idx]
      if (!content) { idx++; turn++; continue }

      if (turn % 2 === 0) {
        const leadIn = hostLeadIns[turn % hostLeadIns.length]
        lines.push('[主持人]')
        lines.push(`${leadIn}${content}。`)
        totalChars += content.length + leadIn.length + 2
      } else {
        const leadIn = guestLeadIns[turn % guestLeadIns.length]
        lines.push('[嘉宾]')
        lines.push(`${leadIn}${content}。`)
        totalChars += content.length + leadIn.length + 2
      }
      lines.push('')
      idx++; turn++
    }

    // v1.0.23: 更有洞察的收尾
    const lastTurnWasHost = (turn - 1) % 2 === 0
    if (lastTurnWasHost) {
      lines.push('[嘉宾]')
      lines.push('嗯，确实，这个话题还有很多值得深入聊的地方。')
      lines.push('')
    }
    lines.push('[主持人]')
    lines.push('聊了这么多，你觉得这个事儿最值得关注的是什么？')
    lines.push('')
    lines.push('[嘉宾]')
    lines.push('我觉得核心还是看后续怎么发展。今天就聊到这儿吧。')
    lines.push('')
    lines.push('[主持人]')
    lines.push('好，感谢收听，我们下期再见。')
    lines.push('')

    return lines.join('\n')
  }

  // === 单人播客 ===
  const lines = []
  const firstPoint = keyPoints[0] || '一个值得关注的话题'

  // v1.0.23: 更有吸引力的开场
  lines.push(`最近有个事儿挺值得聊聊的，${firstPoint}。`)
  lines.push('')

  const transitions = [
    '说到这个，', '你知道吗，', '有意思的是，', '这里有个细节，',
    '我个人觉得，', '另外提一句，', '其实啊，', '回到刚才说的，',
    '换句话说，', '这让我想到，',
  ]

  let idx = 1
  let totalChars = firstPoint.length + 40
  let transIdx = 0

  while (idx < keyPoints.length && totalChars < maxScriptChars) {
    const point = keyPoints[idx]
    if (!point) { idx++; continue }
    const trans = transitions[transIdx % transitions.length]
    transIdx++
    lines.push(`${trans}${point}。`)
    lines.push('')
    totalChars += point.length + trans.length + 3
    idx++
  }

  // v1.0.23: 更有余味的收尾
  lines.push('好了，今天就聊到这儿。')
  lines.push('如果你对这个话题有自己的看法，欢迎留言讨论。')
  lines.push('我们下期再见。')

  return lines.join('\n')
}

// 通过在线 API 生成播客脚本（需要 LLM）
// v1.0.23: 添加超时和空脚本校验，失败时降级到本地算法
async function generatePodcastScriptOnline(content, podcastType) {
  const onlineApiUrl = 'https://podcastai.clipopai.com/api/podcast/generate'
  const res = await fetch(onlineApiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      // v1.0.23: 在线 API 需要 type 参数
      type: 'text',
      text: content,
      podcastType,
      source: 'desktop',
    }),
    signal: AbortSignal.timeout(90000),
  })
  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`在线 API 调用失败: ${errText}`)
  }
  const data = await res.json()
  const script = data.script || data.content || ''
  if (!script || script.trim().length < 10) {
    throw new Error('在线 API 返回空脚本')
  }
  return script
}

// v1.0.21: 从 HTML 中提取正文内容（支持微信公众号）
// v1.0.39: 改进微信正文提取，使用栈匹配处理嵌套 div
function extractMainContentFromHtml(html) {
  // 1. 优先提取微信公众号正文容器（使用栈匹配处理嵌套 div）
  const weixinSelectors = [
    { id: 'js_content', label: 'js_content' },
    { class: 'rich_media_content', label: 'rich_media_content' },
  ]

  for (const sel of weixinSelectors) {
    // 找到起始标签位置
    let startIdx = -1
    if (sel.id) {
      const re = new RegExp(`<div[^>]+id=["']${sel.id}["'][^>]*>`, 'i')
      const m = html.match(re)
      if (m) startIdx = m.index + m[0].length
    } else if (sel.class) {
      const re = new RegExp(`<div[^>]+class=["'][^"']*${sel.class}[^"']*["'][^>]*>`, 'i')
      const m = html.match(re)
      if (m) startIdx = m.index + m[0].length
    }
    if (startIdx < 0) continue

    // 从起始位置开始，用栈匹配找到对应的闭合 </div>
    let depth = 1
    let i = startIdx
    const divOpenRe = /<div[^>]*>/gi
    const divCloseRe = /<\/div>/gi
    let endIdx = -1
    while (i < html.length) {
      divOpenRe.lastIndex = i
      divCloseRe.lastIndex = i
      const openMatch = divOpenRe.exec(html)
      const closeMatch = divCloseRe.exec(html)
      if (!closeMatch) break
      if (openMatch && openMatch.index < closeMatch.index) {
        depth++
        i = openMatch.index + openMatch[0].length
      } else {
        depth--
        i = closeMatch.index + closeMatch[0].length
        if (depth === 0) {
          endIdx = closeMatch.index
          break
        }
      }
    }
    if (endIdx < 0) continue

    const innerHtml = html.slice(startIdx, endIdx)
    const text = innerHtml
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim()
    if (text.length > 50) return text
  }

  // 2. 通用正文提取：移除 script/style/nav/header/footer，再去标签
  let cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
  // 3. 尝试找 article 或 main 标签
  const articleMatch = cleaned.match(/<article[^>]*>([\s\S]*?)<\/article>/i)
  if (articleMatch && articleMatch[1].trim().length > 100) {
    cleaned = articleMatch[1]
  } else {
    const mainMatch = cleaned.match(/<main[^>]*>([\s\S]*?)<\/main>/i)
    if (mainMatch && mainMatch[1].trim().length > 100) {
      cleaned = mainMatch[1]
    }
  }
  return cleaned
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

// 从 URL 提取内容
// v1.0.39: 优先使用 Electron 主进程 IPC 代理抓取（绕过 CORS），降级到渲染进程 fetch
async function fetchUrlContent(url) {
  let html = null
  let lastError = null

  // 方案1：通过 Electron 主进程 IPC 抓取（绕过 CORS，支持微信等网站）
  if (window.podcastai?.url?.fetch) {
    try {
      const result = await window.podcastai.url.fetch(url)
      if (result && result.success && result.html && result.html.length > 200) {
        html = result.html
      } else if (result && result.error) {
        lastError = result.error
      }
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e)
    }
  }

  // 方案2：降级到渲染进程直接 fetch（某些环境可能不受 CORS 限制）
  if (!html) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        },
        signal: AbortSignal.timeout(15000),
      })
      if (res.ok) {
        html = await res.text()
      }
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e)
    }
  }

  if (!html) {
    throw new Error(`URL 抓取失败${lastError ? '：' + lastError : ''}`)
  }

  const content = extractMainContentFromHtml(html)
  if (!content || content.length < 50) {
    throw new Error('URL 内容提取失败：抓取到的页面无有效正文（可能是反爬页面或需要登录）')
  }
  return content
}

// 读取文件内容
async function readFileContent(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error(t('errFileReadFailed')))
    // 对于文本文件直接读取
    if (file.type.startsWith('text/') || /\.(txt|md|markdown)$/i.test(file.name)) {
      reader.readAsText(file)
    } else {
      // PDF/Word 等二进制格式，尝试当文本读（降级方案）
      reader.readAsText(file)
    }
  })
}

// ════════════════════════════════════════════════════════════
// UI 渲染
// ════════════════════════════════════════════════════════════
// v1.0.72: macOS hiddenInset 标题栏的红绿灯按钮（关闭/最小化/最大化）
// 叠加在网页内容左上角 (x:16-68, y:18-30)。macOS 下侧边栏 logo 区域
// 增加顶部让位空间（pt-12=48px），使 logo 位于按钮下方，避免遮挡；
// Windows 使用原生标题栏，无需让位。
const IS_MAC = /Mac|iPhone|iPad|iPod/.test(navigator.userAgent)

function render() {
  const app = document.getElementById('app')
  app.innerHTML = `
    <!-- Sidebar -->
    <aside class="w-64 flex-shrink-0 bg-white border-r border-stone-200 flex flex-col app-drag">
      <div class="${IS_MAC ? 'pt-12' : ''} px-5 ${IS_MAC ? 'pb-4' : 'py-5'} border-b border-stone-200">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-600 to-purple-600 flex items-center justify-center">
            <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
              <path d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3"></path>
            </svg>
          </div>
          <div>
            <div class="font-bold text-lg gradient-text">PodcastAI</div>
            <div class="text-xs text-stone-400">v${state.appVersion.version}</div>
          </div>
        </div>
      </div>

      <nav class="flex-1 p-3 space-y-1 app-no-drag">
        ${renderNavItem('podcast', 'M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3', t('navPodcast'))}
        ${renderNavItem('clone', 'M12 20.94c1.5 0 2.75 1.06 4 1.06 3 0 6-8 6-12.22A4.91 4.91 0 0 0 17 5c-2.22 0-4 1.44-5 2-1-.56-2.78-2-5-2a4.9 4.9 0 0 0-5 4.78C2 14 5 22 8 22c1.25 0 2.5-1.06 4-1.06Z', t('navClone'))}
        ${renderNavItem('history', 'M12 8v4l3 3m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z', t('navHistory'))}
        ${renderNavItem('settings', 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 0 0 1.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 0 0-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 0 0-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 0 0-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 0 0-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 0 0 1.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065Z M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z', t('navSettings'))}
      </nav>

      <!-- Service status -->
      <div class="p-4 border-t border-stone-200 app-no-drag">
        <div class="text-xs text-stone-400 mb-2">${t('serviceStatus')}</div>
        <div class="flex items-center gap-2">
          <div class="w-2 h-2 rounded-full pulse-dot ${serviceStatusColor()}"></div>
          <span class="text-sm">${serviceStatusLabel()}</span>
        </div>
        <div class="text-xs text-stone-500 mt-1 truncate">${state.serviceUrl}</div>
      </div>

      <!-- Language switcher -->
      <div class="p-4 border-t border-stone-200 app-no-drag">
        <select onchange="setLocale(this.value)" aria-label="${t('language')}"
          class="w-full py-1.5 px-2 text-xs rounded-md border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-600 dark:text-stone-300 focus:outline-none focus:border-primary-500 cursor-pointer">
          ${LOCALE_OPTIONS.map((l) => `<option value="${l.code}" ${state.locale === l.code ? 'selected' : ''}>${l.nativeName}</option>`).join('')}
        </select>
      </div>

      <!-- v1.0.75: 主题切换（浅色 / 深色） -->
      <div class="px-4 py-3 border-t border-stone-200 app-no-drag">
        <div class="flex gap-1 bg-stone-100 rounded-lg p-1">
          <button onclick="setTheme('light')" class="flex-1 py-1.5 text-xs rounded-md transition ${state.theme === 'light' ? 'bg-primary-600 text-white' : 'text-stone-500 hover:text-primary-700'}">${t('themeLight')}</button>
          <button onclick="setTheme('dark')" class="flex-1 py-1.5 text-xs rounded-md transition ${state.theme === 'dark' ? 'bg-primary-600 text-white' : 'text-stone-500 hover:text-primary-700'}">${t('themeDark')}</button>
        </div>
      </div>

      <!-- v1.0.38: 当前登录账号信息 -->
      <div class="p-4 border-t border-stone-200 app-no-drag mt-auto">
        <div class="text-xs text-stone-400 mb-2">${t('currentAccount')}</div>
        ${state.auth.isAuthenticated && (state.auth.email || state.auth.name)
          ? `<div class="flex items-center gap-2 mb-2">
              <div class="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
                ${(state.auth.name || state.auth.email || '?').charAt(0).toUpperCase()}
              </div>
              <div class="flex-1 min-w-0">
                ${state.auth.name ? `<div class="text-sm font-medium text-stone-900 truncate">${escapeHtml(state.auth.name)}</div>` : ''}
                <div class="text-xs text-stone-500 truncate">${escapeHtml(state.auth.email || '')}</div>
              </div>
            </div>
            <button onclick="desktopSignOut()" class="text-xs text-stone-500 hover:text-red-600 transition">${t('signOut')}</button>`
          : `<div class="text-sm text-stone-400">${t('notLoggedIn')}</div>`
        }
      </div>
    </aside>

    <!-- Main content -->
    <main class="flex-1 flex flex-col overflow-hidden app-no-drag">
      <!-- Offline banner -->
      ${state.serviceStatus === 'offline' ? renderOfflineBanner() : ''}
      <div class="flex-1 overflow-y-auto">
        ${renderView()}
      </div>
    </main>
  `
}

function renderOfflineBanner() {
  const sm = state.serviceManager
  // v1.0.4: 服务由 main.ts 自动启动；如果进程已运行但 HTTP 还未就绪，提示"正在启动"
  const isAutoStarting = sm.processRunning && state.serviceStatus === 'offline'
  return `
    <div class="bg-amber-50 border-b border-amber-200 px-6 py-3 flex items-center justify-between gap-4">
      <div class="flex items-center gap-3 flex-1 min-w-0">
        <div class="w-2 h-2 rounded-full bg-amber-500 pulse-dot shrink-0"></div>
        <div class="text-sm text-amber-800 truncate">
          ${isAutoStarting ? t('serviceAutoStarting') : t('offlineBanner')}
          ${sm.processRunning ? ` · <span class="text-amber-700">${t('serviceRunning')} (PID ${sm.processPid})</span>` : ''}
        </div>
      </div>
      <div class="flex items-center gap-2 shrink-0">
        ${isAutoStarting ? '' : `
          <button onclick="startServiceAction()" ${sm.isStarting ? 'disabled' : ''} class="px-3 py-1.5 text-xs bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white rounded-md transition flex items-center gap-1.5">
            ${sm.isStarting ? `
              <svg class="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>
              ${t('startingService')}
            ` : `
              <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"></path></svg>
              ${t('offlineBannerAction')}
            `}
          </button>
        `}
        <button onclick="switchView('settings')" class="px-3 py-1.5 text-xs bg-stone-100 hover:bg-stone-200 text-stone-600 rounded-md transition">
          ${t('goToSettings')}
        </button>
      </div>
    </div>
  `
}

function renderNavItem(view, iconPath, label) {
  const isActive = state.activeView === view
  return `
    <button onclick="switchView('${view}')" class="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition ${isActive ? 'bg-primary-50 text-primary-700' : 'text-stone-500 hover:bg-stone-100'}">
      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
        <path d="${iconPath}"></path>
      </svg>
      <span class="text-sm font-medium">${label}</span>
    </button>
  `
}

function serviceStatusColor() {
  switch (state.serviceStatus) {
    case 'online': return 'bg-green-500'
    case 'busy': return 'bg-amber-500'
    case 'offline': return 'bg-red-500'
    default: return 'bg-stone-400'
  }
}

function serviceStatusLabel() {
  switch (state.serviceStatus) {
    case 'online': return t('serviceOnline')
    case 'busy': return t('serviceBusy')
    case 'offline': return t('serviceOffline')
    default: return t('serviceCheckFailed')
  }
}

function renderView() {
  switch (state.activeView) {
    case 'podcast': return renderPodcastView()
    case 'clone': return renderCloneView()
    case 'history': return renderHistoryView()
    case 'settings': return renderSettingsView()
    default: return renderPodcastView()
  }
}

// ════════════════════════════════════════════════════════════
// 视图：播客生成
// ════════════════════════════════════════════════════════════
function renderPodcastView() {
  return `
    <div class="max-w-5xl mx-auto p-8">
      <div class="mb-8">
        <h1 class="text-3xl font-bold mb-2">${t('podcastTitle')}</h1>
        <p class="text-stone-500">${t('podcastSubtitle')}</p>
      </div>

      <!-- Input method tabs -->
      <div class="mb-6">
        <div class="text-sm text-stone-400 mb-2">${t('inputMethod')}</div>
        <div class="flex gap-2 bg-white/80 p-1 rounded-xl border border-stone-200 w-fit">
          ${renderInputMethodTab('url', 'M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71', t('inputUrl'))}
          ${renderInputMethodTab('text', 'M4 6h16M4 12h16M4 18h7', t('inputText'))}
          ${renderInputMethodTab('file', 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6', t('inputFile'))}
        </div>
      </div>

      <!-- Input area -->
      <div class="mb-6">
        ${renderInputArea()}
      </div>

      <!-- Options -->
      <div class="mb-6 bg-white/80 rounded-xl border border-stone-200 p-5">
        <h3 class="text-sm font-semibold mb-4 text-stone-600">${t('podcastOptions')}</h3>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label class="block text-xs text-stone-400 mb-2">${t('podcastType')}</label>
            <div class="flex gap-2">
              <button onclick="setPodcastType('single')" class="flex-1 px-3 py-2 text-sm rounded-lg border transition ${state.podcastType === 'single' ? 'border-primary-600 bg-primary-50 text-primary-700' : 'border-stone-300 text-stone-500 hover:border-stone-400'}">${t('singleHost')}</button>
              <button onclick="setPodcastType('dual')" class="flex-1 px-3 py-2 text-sm rounded-lg border transition ${state.podcastType === 'dual' ? 'border-primary-600 bg-primary-50 text-primary-700' : 'border-stone-300 text-stone-500 hover:border-stone-400'}">${t('dualHost')}</button>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-1 ${state.podcastType === 'dual' ? 'md:grid-cols-2' : ''} gap-4">
          <div>
            <label class="block text-xs text-stone-400 mb-2">${t('voiceHost')}</label>
            ${renderVoiceSelect('voice1')}
          </div>
          ${state.podcastType === 'dual' ? `
            <div>
              <label class="block text-xs text-stone-400 mb-2">${t('voiceGuest')}</label>
              ${renderVoiceSelect('voice2')}
            </div>
          ` : ''}
        </div>
      </div>

      <!-- Generate button -->
      <button onclick="generatePodcast()" ${state.isGenerating ? 'disabled' : ''} class="w-full py-3.5 rounded-xl bg-gradient-to-r from-primary-600 to-purple-600 hover:from-primary-500 hover:to-purple-500 text-white font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
        ${state.isGenerating ? `
          <svg class="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z"></path>
          </svg>
          ${t('generating')}
        ` : t('generate')}
      </button>

      <!-- Progress -->
      ${state.isGenerating ? renderProgress() : ''}

      <!-- Script preview -->
      ${state.scriptText ? renderScriptPreview() : ''}

      <!-- v1.0.26: 合成状态/错误显示区域 -->
      ${state.synthError ? renderSynthError() : ''}
      ${state.isGenerating && state.scriptText && !state.audioUrl ? renderSynthStatus() : ''}

      <!-- Audio player -->
      ${state.audioUrl ? renderAudioPlayer() : ''}
    </div>
  `
}

function renderInputMethodTab(method, iconPath, label) {
  const isActive = state.inputMethod === method
  return `
    <button onclick="setInputMethod('${method}')" class="flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition ${isActive ? 'bg-primary-600 text-white' : 'text-stone-500 hover:text-primary-700'}">
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
        <path d="${iconPath}"></path>
      </svg>
      ${label}
    </button>
  `
}

function renderInputArea() {
  switch (state.inputMethod) {
    case 'url':
      return `
        <label class="block text-sm text-stone-400 mb-2">${t('urlLabel')}</label>
        <input type="url" value="${escapeHtml(state.urlInput)}" oninput="state.urlInput = this.value" placeholder="${t('urlPlaceholder')}" class="w-full px-4 py-3 bg-white border border-stone-200 rounded-xl text-stone-900 placeholder-stone-400 focus:border-primary-600 focus:outline-none transition">
      `
    case 'text':
      return `
        <label class="block text-sm text-stone-400 mb-2">${t('textLabel')}</label>
        <textarea oninput="state.textInput = this.value" placeholder="${t('textPlaceholder')}" class="w-full px-4 py-3 bg-white border border-stone-200 rounded-xl text-stone-900 placeholder-stone-400 focus:border-primary-600 focus:outline-none transition resize-y" rows="8">${escapeHtml(state.textInput)}</textarea>
      `
    case 'file':
      return `
        <label class="block text-sm text-stone-400 mb-2">${t('fileLabel')}</label>
        <div onclick="document.getElementById('file-input').click()" class="border-2 border-dashed border-stone-300 hover:border-primary-600 rounded-xl p-8 text-center cursor-pointer transition">
          ${state.uploadedFile ? `
            <div class="text-primary-600 mb-2">
              <svg class="w-10 h-10 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
                <path d="M9 12l2 2 4-4m6 2a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"></path>
              </svg>
            </div>
            <div class="text-sm font-medium">${escapeHtml(state.uploadedFile.name)}</div>
            <div class="text-xs text-stone-400 mt-1">${(state.uploadedFile.size / 1024 / 1024).toFixed(2)} MB</div>
            <div class="text-xs text-primary-600 mt-2">${t('fileChange')}</div>
          ` : `
            <div class="text-stone-400 mb-2">
              <svg class="w-10 h-10 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
                <path d="M7 16a4 4 0 0 1-.88-7.903A5 5 0 1 1 15.9 6L16 6a5 5 0 0 1 0 10H7zm5-4V4m0 0L8 8m4-4l4 4"></path>
              </svg>
            </div>
            <div class="text-sm">${t('fileDropHint')}</div>
            <div class="text-xs text-stone-400 mt-1">${t('fileSupported')}</div>
          `}
        </div>
        <input id="file-input" type="file" accept=".txt,.md,.markdown,.pdf,.doc,.docx" class="hidden" onchange="handleFileUpload(this.files[0])">
      `
  }
}

function renderVoiceSelect(target) {
  const currentValue = state[target]
  const systemVoices = VOICE_TEMPLATES
  const cloneVoices = state.clones
  const isLoading = state.podcastVoiceLoading === target
  const isPlaying = state.podcastVoicePlaying === target

  return `
    <div class="flex gap-2">
      <select onchange="state.${target} = this.value; render()" class="flex-1 px-3 py-2 bg-white border border-stone-200 rounded-lg text-stone-900 text-sm focus:border-primary-600 focus:outline-none">
        <optgroup label="${t('systemVoice')}">
          ${systemVoices.map(v => `<option value="${v.id}" ${currentValue === v.id ? 'selected' : ''}>${voiceName(v)}</option>`).join('')}
        </optgroup>
        ${cloneVoices.length > 0 ? `
          <optgroup label="${t('cloneVoice')}">
            ${cloneVoices.map(c => `<option value="clone-${c.id}" ${currentValue === `clone-${c.id}` ? 'selected' : ''}>${escapeHtml(c.name)} (${c.gender === 'male' ? t('cloneGenderMale') : t('cloneGenderFemale')})</option>`).join('')}
          </optgroup>
        ` : ''}
      </select>
      <button onclick="previewPodcastVoice('${target}')" ${isLoading ? 'disabled' : ''} class="px-3 py-2 rounded-lg border border-stone-200 hover:border-primary-600 hover:text-primary-600 text-stone-500 transition disabled:opacity-50 flex items-center justify-center" title="${t('clonePreview')}">
        ${isLoading ? `
          <svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>
        ` : isPlaying ? `
          <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"></path></svg>
        ` : `
          <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"></path></svg>
        `}
      </button>
    </div>
  `
}

function renderProgress() {
  const { stage, current, total } = state.progress
  // v1.0.16: 进度计算修复 — 段合成阶段上限 90%，避免 1 段时 segment_start 立即显示 100% 造成卡死假象
  // - synth 阶段：current/total * 90%（最高 90%，留 10% 给最终合并）
  // - finalizing 阶段：95%
  // - 完成：100%（由 audioUrl 状态触发，不在这里显示）
  let percent
  if (state.synthFinalizing) {
    percent = 95
  } else if (stage === 'synth' && total > 0) {
    percent = Math.min(90, Math.round((current / total) * 90))
  } else if (stage === 'script') {
    percent = total > 0 ? Math.round((current / total) * 90) : 0
  } else {
    percent = 0
  }
  // v1.0.15: finalizing 阶段显示"正在合成最终音频..."
  const stageText = state.synthFinalizing
    ? t('audioFinalizing')
    : (stage === 'script' ? t('scriptGenerating') : (stage === 'synth' ? t('segmentProgress', { current, total }) : t('audioSynthesizing')))

  return `
    <div class="mt-4 p-4 bg-white/80 rounded-xl border border-stone-200">
      <div class="flex items-center justify-between mb-2">
        <div class="text-sm text-stone-600">${stageText}</div>
        <div class="text-sm text-primary-600">${percent}%</div>
      </div>
      <div class="h-2 bg-stone-100 rounded-full overflow-hidden">
        <div class="h-full bg-gradient-to-r from-primary-600 to-purple-600 rounded-full transition-all" style="width: ${percent}%"></div>
      </div>
    </div>
  `
}

function renderScriptPreview() {
  return `
    <div class="mt-6">
      <div class="flex items-center justify-between mb-2">
        <h3 class="text-sm font-semibold text-stone-600">${t('scriptPreview')}</h3>
        <span class="text-xs text-stone-400">${state.scriptText.length} ${t('words')}</span>
      </div>
      <textarea onchange="state.scriptText = this.value" class="w-full px-4 py-3 bg-white border border-stone-200 rounded-xl text-stone-900 text-sm focus:border-primary-600 focus:outline-none resize-y" rows="10">${escapeHtml(state.scriptText)}</textarea>
      <div class="text-xs text-stone-400 mt-1">${t('scriptEditHint')}</div>
      <div class="flex gap-2 mt-2">
        <button onclick="synthesizeOnly()" class="px-4 py-2 text-sm bg-stone-100 hover:bg-stone-200 rounded-lg transition">${t('regenerate')}</button>
      </div>
    </div>
  `
}

function renderAudioPlayer() {
  return `
    <div class="mt-6 p-5 bg-gradient-to-br from-primary-50 to-purple-50 rounded-xl border border-stone-200">
      <div class="flex items-center justify-between mb-3">
        <h3 class="text-sm font-semibold">${t('audioPlayer')}</h3>
        <button onclick="downloadPodcast()" class="text-xs text-primary-600 hover:text-primary-700 flex items-center gap-1">
          <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path d="M4 16v1a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
          ${t('download')}
        </button>
      </div>
      <audio controls preload="auto" src="${state.audioUrl}" class="w-full"
        onerror="console.error('[Audio] Error:', event.target.error); this.nextElementSibling?.classList.remove('hidden'); this.nextElementSibling && (this.nextElementSibling.textContent = 'Audio load error: ' + (event.target.error?.message || 'unknown'))"
        onloadedmetadata="console.log('[Audio] Duration:', event.target.duration, 's')"
      ></audio>
      <div class="hidden mt-2 text-xs text-red-600"></div>
    </div>
  `
}

// v1.0.26: 合成错误显示区域（持久显示，不依赖 toast）
function renderSynthError() {
  return `
    <div class="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl">
      <div class="flex items-start gap-3">
        <svg class="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
          <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
        </svg>
        <div class="flex-1">
          <h4 class="text-sm font-semibold text-red-800 mb-1">音频合成失败</h4>
          <p class="text-xs text-red-700 break-all">${escapeHtml(state.synthError)}</p>
          <button onclick="state.synthError = null; render()" class="mt-2 text-xs text-red-600 hover:text-red-800 underline">
            关闭
          </button>
        </div>
      </div>
    </div>
  `
}

// v1.0.26: 合成进行中状态显示（在脚本下方）
function renderSynthStatus() {
  const stageText = state.synthFinalizing
    ? '正在合成最终音频，请稍候...'
    : state.progress && state.progress.total > 0
      ? `正在合成音频 ${state.progress.current}/${state.progress.total} 段`
      : '正在准备合成...'
  return `
    <div class="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-xl">
      <div class="flex items-center gap-3">
        <svg class="animate-spin h-5 w-5 text-blue-600 flex-shrink-0" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z"></path>
        </svg>
        <div>
          <h4 class="text-sm font-semibold text-blue-800">${stageText}</h4>
          <p class="text-xs text-blue-600 mt-0.5">合成过程可能需要几分钟，请勿关闭窗口</p>
        </div>
      </div>
    </div>
  `
}

// v1.0.20: 通过 IPC 下载音频文件（使用已保存的 audioBuffer）
window.downloadPodcast = async function() {
  if (!state.audioBuffer) {
    toast(t('errNoAudio') || 'No audio to download', 'error')
    return
  }
  try {
    const defaultName = `podcast-${Date.now()}.wav`
    const result = await window.podcastai.dialog.saveFile(defaultName, state.audioBuffer)
    if (result.success) {
      toast(t('downloadSuccess') || 'Downloaded successfully', 'success')
    } else if (!result.canceled) {
      toast(result.error || 'Download failed', 'error')
    }
  } catch (e) {
    toast(e.message || 'Download failed', 'error')
  }
}

// ════════════════════════════════════════════════════════════
// 视图：声音克隆
// ════════════════════════════════════════════════════════════
function renderCloneView() {
  const modelReady = !!(state.model && state.model.status && state.model.status.ready)
  const modelDownloading = !!(state.model && state.model.downloadState && state.model.downloadState.isDownloading)
  const modelPercent = (state.model && state.model.downloadState && state.model.downloadState.percent) || 0
  const canClone = modelReady && !modelDownloading

  return `
    <div class="max-w-5xl mx-auto p-8">
      <div class="mb-8">
        <h1 class="text-3xl font-bold mb-2">${t('cloneTitle')}</h1>
        <p class="text-stone-500">${t('cloneSubtitle')}</p>
      </div>

      <!-- 模型状态引导卡片 -->
      ${!modelReady ? `
        <div class="mb-6 rounded-xl border ${modelDownloading ? 'border-primary-200 bg-primary-50' : 'border-amber-200 bg-amber-50'} p-4">
          <div class="flex items-start gap-3">
            <div class="flex-shrink-0 mt-0.5">
              ${modelDownloading ? `
                <svg class="w-5 h-5 text-primary-600 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z"></path>
                </svg>
              ` : `
                <svg class="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                </svg>
              `}
            </div>
            <div class="flex-1 min-w-0">
              <div class="text-sm font-medium ${modelDownloading ? 'text-primary-900' : 'text-amber-900'}">
                ${modelDownloading ? `模型下载中 ${modelPercent}%` : '模型未下载'}
              </div>
              <div class="text-xs ${modelDownloading ? 'text-primary-700' : 'text-amber-700'} mt-1">
                ${modelDownloading ? '声音克隆功能需要等待 CosyVoice2 模型下载完成后才能使用' : '声音克隆需要 CosyVoice2 模型，正在自动下载中...'}
              </div>
              ${modelDownloading ? `
                <div class="mt-2 h-2 bg-primary-100 rounded-full overflow-hidden">
                  <div class="h-full bg-primary-600 rounded-full transition-all" style="width: ${modelPercent}%"></div>
                </div>
              ` : ''}
            </div>
          </div>
        </div>
      ` : `
        <div class="mb-6 rounded-xl border border-green-200 bg-green-50 p-4">
          <div class="flex items-center gap-3">
            <svg class="w-5 h-5 text-green-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path></svg>
            <div class="text-sm font-medium text-green-900">${t('modelReady')}</div>
          </div>
        </div>
      `}

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- Clone form -->
        <div class="bg-white/80 rounded-xl border border-stone-200 p-6 space-y-4">
          <div>
            <label class="block text-sm text-stone-500 mb-2">${t('cloneName')} *</label>
            <input type="text" value="${escapeHtml(state.cloneName)}" oninput="state.cloneName = this.value" placeholder="${t('cloneNamePlaceholder')}" class="w-full px-3 py-2 bg-white border border-stone-200 rounded-lg text-stone-900 text-sm focus:border-primary-600 focus:outline-none">
          </div>

          <div>
            <label class="block text-sm text-stone-500 mb-2">${t('cloneGender')}</label>
            <div class="flex gap-2">
              <button onclick="state.cloneGender = ''" class="flex-1 py-2 text-sm rounded-lg border transition ${state.cloneGender === '' ? 'border-primary-600 bg-primary-50 text-primary-700' : 'border-stone-300 text-stone-500'}">${t('cloneGenderAuto')}</button>
              <button onclick="state.cloneGender = 'male'" class="flex-1 py-2 text-sm rounded-lg border transition ${state.cloneGender === 'male' ? 'border-primary-600 bg-primary-50 text-primary-700' : 'border-stone-300 text-stone-500'}">${t('cloneGenderMale')}</button>
              <button onclick="state.cloneGender = 'female'" class="flex-1 py-2 text-sm rounded-lg border transition ${state.cloneGender === 'female' ? 'border-primary-600 bg-primary-50 text-primary-700' : 'border-stone-300 text-stone-500'}">${t('cloneGenderFemale')}</button>
            </div>
          </div>

          <div>
            <label class="block text-sm text-stone-500 mb-2">${t('cloneDescription')}</label>
            <input type="text" value="${escapeHtml(state.cloneDescription)}" oninput="state.cloneDescription = this.value" placeholder="${t('cloneDescriptionPlaceholder')}" class="w-full px-3 py-2 bg-white border border-stone-200 rounded-lg text-stone-900 text-sm focus:border-primary-600 focus:outline-none">
          </div>

          <div>
            <label class="block text-sm text-stone-500 mb-2">${t('clonePromptText')}</label>
            <textarea value="${escapeHtml(state.clonePromptText)}" oninput="state.clonePromptText = this.value" placeholder="${t('clonePromptPlaceholder')}" class="w-full px-3 py-2 bg-white border border-stone-200 rounded-lg text-stone-900 text-sm focus:border-primary-600 focus:outline-none resize-y" rows="3">${escapeHtml(state.clonePromptText)}</textarea>
          </div>

          <div>
            <label class="block text-sm text-stone-500 mb-2">${t('cloneAudioFile')} *</label>
            <div onclick="document.getElementById('clone-audio-input').click()" class="border-2 border-dashed border-stone-300 hover:border-primary-600 rounded-lg p-4 text-center cursor-pointer transition">
              ${state.cloneAudioFile ? `
                <div class="text-sm font-medium text-primary-600">${escapeHtml(state.cloneAudioFile.name)}</div>
                <div class="text-xs text-stone-500 mt-1">${(state.cloneAudioFile.size / 1024 / 1024).toFixed(2)} MB</div>
              ` : `
                <div class="text-xs text-stone-500">${t('cloneAudioHint')}</div>
              `}
            </div>
            <input id="clone-audio-input" type="file" accept="audio/wav,audio/mp3,audio/m4a,audio/aac,audio/*" class="hidden" onchange="handleCloneAudioUpload(this.files[0])">
          </div>

          <button onclick="handleCloneButtonClick()"
                  ${(state.isCloning || (!canClone && !modelDownloading)) ? 'disabled' : ''}
                  class="w-full py-3 rounded-xl ${canClone ? 'bg-gradient-to-r from-primary-600 to-purple-600 hover:from-primary-500 hover:to-purple-500 text-white' : 'bg-stone-200 text-stone-500 hover:bg-stone-300'} font-semibold transition flex items-center justify-center gap-2">
            ${state.isCloning ? `
              <svg class="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z"></path>
              </svg>
              ${t('cloning')}
            ` : modelDownloading ? `模型下载中 ${modelPercent}%` : !modelReady ? '请先下载模型' : t('startClone')}
          </button>
        </div>

        <!-- Clone list -->
        <div class="bg-white/80 rounded-xl border border-stone-200 p-6">
          <h3 class="text-sm font-semibold mb-4">${t('cloneListTitle')} (${state.clones.length})</h3>
          ${state.clones.length === 0 ? `
            <div class="text-center py-12 text-stone-400">
              <svg class="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
                <path d="M12 20.94c1.5 0 2.75 1.06 4 1.06 3 0 6-8 6-12.22A4.91 4.91 0 0 0 17 5c-2.22 0-4 1.44-5 2-1-.56-2.78-2-5-2a4.9 4.9 0 0 0-5 4.78C2 14 5 22 8 22c1.25 0 2.5-1.06 4-1.06Z"></path>
              </svg>
              <div class="text-sm">${t('cloneEmpty')}</div>
            </div>
          ` : `
            <div class="space-y-2 max-h-96 overflow-y-auto">
              ${state.clones.map(c => renderCloneItem(c)).join('')}
            </div>
          `}
        </div>
      </div>
    </div>
  `
}

function renderCloneItem(clone) {
  const isPlaying = state.previewPlayingId === clone.id
  const isLoading = state.previewLoadingId === clone.id
  return `
    <div class="flex items-center justify-between p-3 bg-white rounded-lg border border-stone-200 hover:border-stone-300 transition">
      <div class="flex-1 min-w-0">
        <div class="text-sm font-medium truncate">${escapeHtml(clone.name)}</div>
        <div class="text-xs text-stone-400 mt-0.5">
          ${clone.gender === 'male' ? t('cloneGenderMale') : t('cloneGenderFemale')} · ${formatDate((clone.created_at || 0) * 1000)}
        </div>
      </div>
      <div class="flex items-center gap-1">
        <button onclick="previewClone('${clone.id}')" ${isLoading ? 'disabled' : ''} class="p-2 text-stone-500 hover:text-primary-600 disabled:opacity-50 transition" title="${t('clonePreview')}">
          ${isLoading ? `
            <svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>
          ` : isPlaying ? `
            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"></path></svg>
          ` : `
            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"></path></svg>
          `}
        </button>
        <button onclick="deleteClone('${clone.id}')" class="p-2 text-stone-500 hover:text-red-400 transition" title="${t('cloneDelete')}">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path d="M19 7l-.867 12.142A2 2 0 0 1 16.138 21H7.862a2 2 0 0 1-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v3M4 7h16"></path></svg>
        </button>
      </div>
    </div>
  `
}

// ════════════════════════════════════════════════════════════
// 视图：历史记录
// ════════════════════════════════════════════════════════════
function renderHistoryView() {
  return `
    <div class="max-w-5xl mx-auto p-8">
      <div class="flex items-center justify-between mb-8">
        <div>
          <h1 class="text-3xl font-bold mb-2">${t('historyTitle')}</h1>
          <p class="text-stone-500 text-sm">${state.history.length} ${state.locale === 'zh' ? '条记录' : 'records'}</p>
        </div>
        ${state.history.length > 0 ? `
          <button onclick="clearAllHistory()" class="px-3 py-1.5 text-sm text-red-400 hover:text-red-300 border border-red-500/30 hover:border-red-500/50 rounded-lg transition">${t('historyClearAll')}</button>
        ` : ''}
      </div>

      ${state.history.length === 0 ? `
        <div class="text-center py-20 text-stone-400">
          <svg class="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
            <path d="M12 8v4l3 3m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"></path>
          </svg>
          <div class="text-lg">${t('historyEmpty')}</div>
        </div>
      ` : `
        <div class="space-y-3">
          ${state.history.map(h => renderHistoryItem(h)).join('')}
        </div>
      `}
    </div>
  `
}

function renderHistoryItem(item) {
  return `
    <div class="bg-white/80 rounded-xl border border-stone-200 p-4 hover:border-stone-300 transition">
      <div class="flex items-start justify-between mb-2">
        <div class="flex-1 min-w-0">
          <div class="font-medium truncate">${escapeHtml(item.title || 'Untitled')}</div>
          <div class="text-xs text-stone-400 mt-1">
            ${formatDate(item.createdAt)} · ${item.duration || 0}s · ${item.script.length} ${t('words')}
          </div>
        </div>
        <div class="flex items-center gap-1 ml-2">
          ${item.audioUrl ? `
            <button onclick="playHistoryAudio('${item.id}')" class="p-2 text-stone-500 hover:text-primary-600 transition" title="${t('historyPlay')}">
              <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"></path></svg>
            </button>
            <a href="${item.audioUrl}" download="podcast-${item.id}.wav" class="p-2 text-stone-500 hover:text-primary-600 transition" title="${t('historyDownload')}">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path d="M4 16v1a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
            </a>
          ` : ''}
          <button onclick="deleteHistory('${item.id}')" class="p-2 text-stone-500 hover:text-red-400 transition" title="${t('historyDelete')}">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path d="M19 7l-.867 12.142A2 2 0 0 1 16.138 21H7.862a2 2 0 0 1-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v3M4 7h16"></path></svg>
          </button>
        </div>
      </div>
      <details class="text-sm text-stone-500">
        <summary class="cursor-pointer hover:text-stone-600">${t('historyScript')}</summary>
        <div class="mt-2 p-3 bg-white rounded-lg text-xs whitespace-pre-wrap max-h-48 overflow-y-auto">${escapeHtml(item.script)}</div>
      </details>
    </div>
  `
}

// ════════════════════════════════════════════════════════════
// 视图：设置
// ════════════════════════════════════════════════════════════
function renderSettingsView() {
  const version = state.appVersion
  const sm = state.serviceManager
  const d = sm.detection
  return `
    <div class="max-w-3xl mx-auto p-8">
      <div class="mb-8">
        <h1 class="text-3xl font-bold mb-2">${t('settingsTitle')}</h1>
      </div>

      <!-- Language -->
      <div class="bg-white/80 rounded-xl border border-stone-200 p-5 mb-4">
        <h3 class="text-sm font-semibold mb-3">${t('settingsLanguage')}</h3>
        <select onchange="setLocale(this.value)" aria-label="${t('settingsLanguage')}"
          class="w-full py-2 px-3 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-200 focus:outline-none focus:border-primary-500 cursor-pointer">
          ${LOCALE_OPTIONS.map((l) => `<option value="${l.code}" ${state.locale === l.code ? 'selected' : ''}>${l.nativeName}</option>`).join('')}
        </select>
      </div>

      <!-- Model Manager (v1.0.4) -->
      ${renderModelManager()}

      <!-- Runtime Manager (v1.0.79) -->
      ${renderRuntimeManager()}

      <!-- Service Manager -->
      <div class="bg-white/80 rounded-xl border border-stone-200 p-5 mb-4">
        <div class="flex items-start justify-between mb-3">
          <div>
            <h3 class="text-sm font-semibold">${t('serviceManager')}</h3>
            <p class="text-xs text-stone-400 mt-1">${t('serviceManagerDesc')}</p>
          </div>
          <button onclick="detectServiceEnvironment()" class="px-3 py-1.5 text-xs bg-stone-100 hover:bg-stone-200 text-stone-600 rounded-md transition flex items-center gap-1.5">
            ${sm.detecting ? `
              <svg class="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>
              ${t('detecting')}
            ` : t('refreshDetection')}
          </button>
        </div>

        <!-- Detection result -->
        ${d ? renderServiceDetectionResult(d) : `
          <div class="text-center py-6 text-stone-400 text-sm">
            ${t('detected')} — ${t('detectEnvironment')}
          </div>
        `}

        <!-- Service controls -->
        ${d && d.voiceServicePath ? `
          <div class="mt-4 pt-4 border-t border-stone-200 space-y-3">
            <div class="flex items-center gap-2">
              ${sm.processRunning ? `
                <button onclick="stopServiceAction()" ${sm.isStopping ? 'disabled' : ''} class="px-4 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-sm rounded-lg transition flex items-center gap-2">
                  ${sm.isStopping ? `<svg class="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>${t('stoppingService')}` : `
                  <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M6 6h12v12H6z"></path></svg>
                  ${t('stopService')}
                `}
                </button>
                <span class="text-xs text-green-400 flex items-center gap-1">
                  <span class="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                  ${t('serviceRunning')} (PID ${sm.processPid || '?'})
                </span>
              ` : `
                <button onclick="startServiceAction()" ${(sm.isStarting || !d.python) ? 'disabled' : ''} class="px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm rounded-lg transition flex items-center gap-2">
                  ${sm.isStarting ? `<svg class="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>${t('startingService')}` : `
                  <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"></path></svg>
                  ${t('startService')}
                `}
                </button>
                ${d.python ? '' : `<span class="text-xs text-amber-400">${t('pythonNotFound')}</span>`}
              `}
            </div>

            <!-- Auto-start checkbox -->
            <label class="flex items-start gap-2 cursor-pointer">
              <input type="checkbox" ${sm.autoStart ? 'checked' : ''} onchange="toggleAutoStart(this.checked)" class="mt-0.5 accent-primary-600">
              <div>
                <div class="text-sm text-stone-600">${t('autoStartService')}</div>
                <div class="text-xs text-stone-400 mt-0.5">${t('autoStartHint')}</div>
              </div>
            </label>
          </div>
        ` : ''}

        <!-- Logs -->
        ${d && d.voiceServicePath ? `
          <div class="mt-4 pt-4 border-t border-stone-200">
            <div class="flex items-center justify-between mb-2">
              <h4 class="text-xs font-semibold text-stone-500">${t('serviceLogs')}</h4>
              <button onclick="clearServiceLogs()" class="text-xs text-stone-400 hover:text-stone-600">${t('clearLogs')}</button>
            </div>
            <div id="service-logs" class="bg-stone-50 rounded-lg p-3 max-h-48 overflow-y-auto font-mono text-xs space-y-0.5">
              ${sm.logs.length === 0 ? `<div class="text-stone-500">${t('noLogs')}</div>` : sm.logs.map(l => `<div class="text-stone-500 whitespace-pre-wrap">${escapeHtml(l)}</div>`).join('')}
            </div>
          </div>
        ` : ''}

      </div>

      <!-- Service URL -->
      <div class="bg-white/80 rounded-xl border border-stone-200 p-5 mb-4">
        <h3 class="text-sm font-semibold mb-3">${t('settingsService')}</h3>
        <div class="space-y-3">
          <div>
            <label class="block text-xs text-stone-400 mb-1.5">${t('settingsServiceUrl')}</label>
            <input id="settings-service-url" type="text" value="${state.serviceUrl}" placeholder="${t('settingsServiceUrlPlaceholder')}" class="w-full px-3 py-2 bg-white border border-stone-200 rounded-lg text-stone-900 text-sm focus:border-primary-600 focus:outline-none">
          </div>
          <div>
            <label class="block text-xs text-stone-400 mb-1.5">${t('settingsServiceTimeout')}</label>
            <input id="settings-timeout" type="number" min="10" max="600" value="${state.serviceTimeout}" class="w-full px-3 py-2 bg-white border border-stone-200 rounded-lg text-stone-900 text-sm focus:border-primary-600 focus:outline-none">
          </div>
          <div class="flex gap-2 pt-2">
            <button onclick="saveSettings()" class="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm rounded-lg transition">${t('settingsSave')}</button>
            <button onclick="resetSettings()" class="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-600 text-sm rounded-lg transition">${t('settingsReset')}</button>
          </div>
        </div>
      </div>

      <!-- About -->
      <div class="bg-white/80 rounded-xl border border-stone-200 p-5">
        <h3 class="text-sm font-semibold mb-3">${t('settingsAbout')}</h3>
        <div class="space-y-2 text-sm">
          <div class="flex justify-between"><span class="text-stone-400">${t('settingsVersion')}</span><span>${version.version}</span></div>
          <div class="flex justify-between"><span class="text-stone-400">${t('settingsPlatform')}</span><span>${version.platform}</span></div>
          <div class="flex justify-between"><span class="text-stone-400">${t('settingsArchitecture')}</span><span>${version.arch}</span></div>
          <div class="pt-2 border-t border-stone-200 mt-2">
            <a href="${t('openSourceUrl')}" target="_blank" class="text-primary-600 hover:text-primary-700 text-xs">${t('openSourceUrl')}</a>
          </div>
        </div>
      </div>
    </div>
  `
}

function renderServiceDetectionResult(d) {
  return `
    <div class="space-y-2 text-sm">
      <!-- Python -->
      <div class="flex items-start gap-2">
        ${d.python ? `
          <svg class="w-4 h-4 text-green-500 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path></svg>
          <div class="flex-1 min-w-0">
            <div class="text-stone-600">${t('pythonFound')}</div>
            ${d.pythonVersion ? `<div class="text-xs text-stone-400 mt-0.5">${t('pythonVersionLabel')}: ${escapeHtml(d.pythonVersion)}</div>` : ''}
            <div class="text-xs text-stone-400 mt-0.5 truncate">${t('pythonPathLabel')}: ${escapeHtml(d.venvPython || d.python)}</div>
          </div>
        ` : `
          <svg class="w-4 h-4 text-amber-500 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"></path></svg>
          <div class="flex-1 min-w-0">
            <div class="text-amber-300">${t('pythonNotFound')}</div>
            <a href="${t('pythonInstallUrl')}" target="_blank" class="text-xs text-primary-600 hover:text-primary-700 mt-0.5 inline-block">${t('pythonInstallUrl')}</a>
          </div>
        `}
      </div>

      <!-- Voice service -->
      <div class="flex items-start gap-2">
        ${d.voiceServicePath ? `
          <svg class="w-4 h-4 text-green-500 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path></svg>
          <div class="flex-1 min-w-0">
            <div class="text-stone-600">${t('voiceServiceFound')}</div>
            <div class="text-xs text-stone-400 mt-0.5 flex items-center gap-2">
              <span class="truncate">${t('voiceServicePathLabel')}: ${escapeHtml(d.voiceServicePath)}</span>
              <button onclick="browseVoiceServiceDir()" class="text-primary-600 hover:text-primary-700 shrink-0">${t('voiceServiceSelectDir')}</button>
            </div>
            <div class="flex flex-wrap gap-2 mt-2 text-xs">
              <span class="px-2 py-0.5 rounded ${d.hasVenv ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}">venv: ${d.hasVenv ? '✓' : '✗'}</span>
              <span class="px-2 py-0.5 rounded ${d.hasMainPy ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}">main.py: ${d.hasMainPy ? '✓' : '✗'}</span>
              <span class="px-2 py-0.5 rounded ${d.hasModels ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}">${d.hasModels ? t('modelsReady') : t('modelsNotReady')}</span>
            </div>
          </div>
        ` : `
          <svg class="w-4 h-4 text-amber-500 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"></path></svg>
          <div class="flex-1 min-w-0">
            <div class="text-amber-300">${t('voiceServiceNotFound')}</div>
            <div class="flex items-center gap-2 mt-1">
              <button onclick="browseVoiceServiceDir()" class="text-xs px-2 py-1 bg-stone-100 hover:bg-stone-200 text-stone-600 rounded">${t('voiceServiceSelectDir')}</button>
              <a href="${t('voiceServiceRepoUrl')}" target="_blank" class="text-xs text-primary-600 hover:text-primary-700">${t('voiceServiceDownload')}</a>
            </div>
          </div>
        `}
      </div>
    </div>
  `
}

// ════════════════════════════════════════════════════════════
// 模型管理（v1.0.4）
// ════════════════════════════════════════════════════════════
function renderModelManager() {
  const m = state.model
  const status = m.status
  const dl = m.downloadState
  const ready = status?.ready
  const partial = status && !status.ready && status.existing > 0

  let statusBadge
  if (ready) {
    statusBadge = `<span class="px-2 py-0.5 rounded bg-green-50 text-green-700 text-xs">${t('modelReady')}</span>`
  } else if (partial) {
    statusBadge = `<span class="px-2 py-0.5 rounded bg-amber-50 text-amber-700 text-xs">${t('modelPartial')} (${status.existing}/${status.total})</span>`
  } else {
    statusBadge = `<span class="px-2 py-0.5 rounded bg-red-50 text-red-700 text-xs">${t('modelNotReady')}</span>`
  }

  const totalSize = dl.totalBytes || 0
  const downloadedSize = dl.bytesDownloaded || 0
  const percent = dl.percent || 0

  return `
    <div class="bg-white/80 rounded-xl border border-stone-200 p-5 mb-4">
      <div class="flex items-start justify-between mb-3">
        <div>
          <h3 class="text-sm font-semibold">${t('modelManager')}</h3>
          <p class="text-xs text-stone-400 mt-1">${t('modelManagerDesc')}</p>
        </div>
        ${statusBadge}
      </div>

      <!-- 下载进度 -->
      ${dl.isDownloading ? `
        <div class="mt-3 space-y-2">
          <div class="flex items-center justify-between text-xs">
            <span class="text-stone-500">
              ${t('modelCurrentFile')}: <span class="text-stone-600 font-mono">${escapeHtml(dl.currentFile)}</span>
              <span class="text-stone-400 ml-2">(${dl.currentIndex + 1}/${dl.totalFiles})</span>
            </span>
            <span class="text-stone-500">${percent}%</span>
          </div>
          <div class="relative h-2 bg-stone-100 rounded-full overflow-hidden">
            <div class="absolute inset-y-0 left-0 bg-primary-600 transition-all" style="width: ${percent}%"></div>
          </div>
          <div class="flex items-center justify-between text-xs text-stone-400">
            <span>${formatBytes(downloadedSize)} / ${formatBytes(totalSize)}</span>
            <span>${formatBytes(dl.speed)}/s</span>
          </div>
          <button onclick="abortModelDownload()" class="mt-2 px-3 py-1.5 text-xs bg-red-600 hover:bg-red-500 text-white rounded-md transition">
            ${t('modelAbort')}
          </button>
        </div>
      ` : `
        <!-- 非下载状态：显示状态信息和操作按钮 -->
        <div class="mt-3 space-y-3">
          ${status ? `
            <div class="text-xs text-stone-400 flex items-center gap-4">
              <span>${t('modelFiles')}: <span class="text-stone-600">${status.existing}/${status.total}</span></span>
              <span>${t('modelSize')}: <span class="text-stone-600">~3.6 GB</span></span>
            </div>
          ` : ''}
          ${dl.error ? `
            <div class="text-xs text-red-400">${t('modelDownloadFailed')}: ${escapeHtml(dl.error)}</div>
          ` : ''}
          <div class="flex items-center gap-2">
            ${ready ? `
              <button onclick="downloadModelAction()" class="px-3 py-1.5 text-xs bg-stone-100 hover:bg-stone-200 text-stone-600 rounded-md transition">
                ${t('modelRedownload')}
              </button>
            ` : `
              <button onclick="downloadModelAction()" class="px-3 py-1.5 text-xs bg-primary-600 hover:bg-primary-700 text-white rounded-md transition flex items-center gap-1.5">
                <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M5 20h14v-2H5v2zM19 9h-4V3H9v6H5l7 7 7-7z"></path></svg>
                ${t('modelDownload')}
              </button>
            `}
            <button onclick="openModelDir()" class="px-3 py-1.5 text-xs bg-stone-100 hover:bg-stone-200 text-stone-600 rounded-md transition">
              ${t('modelOpenDir')}
            </button>
          </div>
        </div>
      `}
    </div>
  `
}

// ════════════════════════════════════════════════════════════
// v1.0.79: Python 运行环境管理器
// ════════════════════════════════════════════════════════════
function renderRuntimeManager() {
  if (!window.podcastai?.runtime) return ''
  const dl = state.runtime.downloadState
  const installed = !!(dl.installed || state.runtime.installed)
  const isBusy = dl.isDownloading

  const stageBadge = dl.isDownloading ? `
    <span class="text-xs text-stone-400 font-medium ml-2">
      ${dl.stage === 'extract' ? t('runtimeExtracting') : dl.stage === 'verify' ? t('runtimeVerifying') : t('runtimeDownloading')}
    </span>
  ` : ''

  const statusBadge = installed
    ? `<span class="px-2 py-0.5 rounded bg-green-50 text-green-700 text-xs">${t('runtimeReady')}</span>`
    : `<span class="px-2 py-0.5 rounded bg-red-50 text-red-700 text-xs">${t('runtimeNotReady')}</span>`

  const totalSize = dl.totalBytes || 0
  const downloadedSize = dl.bytesDownloaded || 0
  const percent = dl.percent || 0

  return `
    <div class="bg-white/80 rounded-xl border border-stone-200 p-5 mb-4">
      <div class="flex items-start justify-between mb-3">
        <div>
          <h3 class="text-sm font-semibold">${t('runtimeManager')}${stageBadge}</h3>
          <p class="text-xs text-stone-400 mt-1">${t('runtimeManagerDesc')}</p>
        </div>
        ${statusBadge}
      </div>

      ${dl.isDownloading ? `
        <div class="mt-3 space-y-2">
          <div class="flex items-center justify-between text-xs">
            <span class="text-stone-500">${percent}%</span>
            <span class="text-stone-400">${dl.stage === 'download' ? `${formatBytes(downloadedSize)} / ${formatBytes(totalSize)}` : ''}</span>
          </div>
          <div class="relative h-2 bg-stone-100 rounded-full overflow-hidden">
            <div class="absolute inset-y-0 left-0 bg-primary-600 transition-all" style="width: ${percent}%"></div>
          </div>
          <div class="flex items-center justify-between text-xs text-stone-400">
            <span>${dl.stage === 'download' ? `${formatBytes(downloadedSize)} / ${formatBytes(totalSize)}` : t(dl.stage === 'extract' ? 'runtimeExtracting' : 'runtimeVerifying')}</span>
            <span>${dl.stage === 'download' ? `${formatBytes(dl.speed)}/s` : ''}</span>
          </div>
          <button onclick="abortRuntimeDownload()" class="mt-2 px-3 py-1.5 text-xs bg-red-600 hover:bg-red-500 text-white rounded-md transition">
            ${t('runtimeAbort')}
          </button>
        </div>
      ` : `
        <div class="mt-3 space-y-3">
          ${dl.error ? `
            <div class="text-xs text-red-400">${t('runtimeDownloadFailed')}: ${escapeHtml(dl.error)}</div>
          ` : ''}
          <div class="flex items-center gap-2">
            ${installed ? `
              <button onclick="downloadRuntimeAction()" class="px-3 py-1.5 text-xs bg-stone-100 hover:bg-stone-200 text-stone-600 rounded-md transition">
                ${t('runtimeRedownload')}
              </button>
            ` : `
              <button onclick="downloadRuntimeAction()" class="px-3 py-1.5 text-xs bg-primary-600 hover:bg-primary-700 text-white rounded-md transition flex items-center gap-1.5">
                <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M5 20h14v-2H5v2zM19 9h-4V3H9v6H5l7 7 7-7z"></path></svg>
                ${t('runtimeDownload')}
              </button>
            `}
            <button onclick="openRuntimeDir()" class="px-3 py-1.5 text-xs bg-stone-100 hover:bg-stone-200 text-stone-600 rounded-md transition">
              ${t('runtimeOpenDir')}
            </button>
          </div>
        </div>
      `}
    </div>
  `
}

// ════════════════════════════════════════════════════════════
// 事件处理
// ════════════════════════════════════════════════════════════
function escapeHtml(str) {
  if (str == null) return ''
  return String(str).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]))
}

window.switchView = function(view) {
  state.activeView = view
  if (view === 'clone') fetchClones().then(render)
  else render()
}

window.handleCloneButtonClick = function() {
  if (state.isCloning) return
  // 修复：state.model.ready / state.model.isDownloading 不存在
  // 实际数据结构：state.model.status.ready / state.model.downloadState.isDownloading
  const modelReady = !!(state.model && state.model.status && state.model.status.ready)
  const modelDownloading = !!(state.model && state.model.downloadState && state.model.downloadState.isDownloading)

  // 服务未就绪时提示用户等待（不静默失败）
  if (state.serviceStatus === 'offline') {
    const sm = state.serviceManager
    if (sm.processRunning) {
      toast(t('serviceAutoStarting') || '语音服务正在启动中，请稍候...', 'info')
    } else {
      toast(t('errServiceUnavailable'), 'error')
    }
    return
  }

  if (modelReady && !modelDownloading) {
    createCloneAction()
  } else if (!modelDownloading) {
    // 跳转到设置页面下载模型
    switchView('settings')
  }
}

window.setTheme = function(theme) {
  state.theme = theme === 'dark' ? 'dark' : 'light'
  localStorage.setItem('podcastai-theme', state.theme)
  applyTheme()
  render()
}

function applyTheme() {
  if (state.theme === 'dark') {
    document.documentElement.classList.add('dark')
  } else {
    document.documentElement.classList.remove('dark')
  }
}

window.setLocale = function(locale) {
  if (!SUPPORTED_LOCALE_CODES.includes(locale)) return
  state.locale = locale
  localStorage.setItem('podcastai-locale', locale)
  document.documentElement.lang = localeHtmlLang(locale)
  render()
}

// v1.0.38: 桌面客户端退出登录
window.desktopSignOut = async function() {
  try {
    if (window.podcastai?.auth?.signOut) {
      await window.podcastai.auth.signOut()
    }
  } catch (e) {
    console.error('Sign out failed:', e)
  }
  state.auth = { isAuthenticated: false, token: null, email: null, name: null, userId: null }
  render()
  toast(state.locale === 'zh' ? '已退出登录' : 'Signed out', 'info')
}

window.setInputMethod = function(method) {
  state.inputMethod = method
  render()
}

window.setPodcastType = function(type) {
  state.podcastType = type
  render()
}

window.handleFileUpload = async function(file) {
  if (!file) return
  if (file.size > 50 * 1024 * 1024) {
    toast(t('fileToLarge'), 'error')
    return
  }
  state.uploadedFile = file
  try {
    state.uploadedFileContent = await readFileContent(file)
  } catch (e) {
    state.uploadedFileContent = ''
  }
  render()
}

window.handleCloneAudioUpload = function(file) {
  if (!file) return
  if (file.size > 50 * 1024 * 1024) {
    toast(t('fileToLarge'), 'error')
    return
  }
  state.cloneAudioFile = file
  render()
}

window.generatePodcast = async function() {
  if (state.isGenerating) return

  // 验证输入
  let content = ''
  if (state.inputMethod === 'url') {
    if (!state.urlInput || !state.urlInput.trim()) {
      toast(t('errInvalidUrl'), 'error')
      return
    }
  } else if (state.inputMethod === 'text') {
    if (!state.textInput || !state.textInput.trim()) {
      toast(t('errEmptyText'), 'error')
      return
    }
    content = state.textInput
  } else if (state.inputMethod === 'file') {
    if (!state.uploadedFile) {
      toast(t('errNoFile'), 'error')
      return
    }
    content = state.uploadedFileContent
  }

  // v1.0.25: 改进服务状态检查
  // 服务可能正在后台启动中（main.ts 的 startVoiceService 是异步的）
  // 不要直接 return，而是先尝试重新检测一次
  if (state.serviceStatus === 'offline' || state.serviceStatus === 'unknown') {
    console.log('[Podcast] Service status is', state.serviceStatus, ', re-checking...')
    toast('正在检测语音服务状态，请稍候...', 'info')
    await checkServiceHealth()
    if (state.serviceStatus === 'offline') {
      toast('语音服务未启动，正在后台启动中，请等待 1-2 分钟后重试', 'error')
      return
    }
    if (state.serviceStatus === 'unknown') {
      toast('语音服务状态未知，请稍后重试', 'error')
      return
    }
  }

  state.isGenerating = true
  state.progress = { stage: 'script', current: 0, total: 0 }
  render()
  toast('开始生成播客...', 'info')

  try {
    // 1. 获取内容
    if (state.inputMethod === 'url') {
      state.progress.stage = 'script'
      render()
      toast('正在抓取链接内容...', 'info')
      content = await fetchUrlContent(state.urlInput)
      if (!content || content.trim().length < 10) {
        // v1.0.21: URL 抓取失败用明确的错误信息，而不是误导为"脚本生成失败"
        throw new Error('URL 内容抓取失败：无法从该链接提取有效正文')
      }
      console.log('[Podcast] URL content fetched:', content.length, 'chars')
    }

    // 2. 生成脚本
    // v1.0.24: 完全放弃在线 API（需要 session token 认证，桌面客户端无法使用）
    // 直接使用本地算法生成播客脚本
    state.progress = { stage: 'script', current: 0, total: 0 }
    render()
    toast('正在生成播客脚本...', 'info')
    let script = ''
    script = generatePodcastScriptLocal(content, state.podcastType)
    console.log('[Podcast] Script generated via local algorithm:', script.length, 'chars')

    // v1.0.24: 合成前校验脚本非空，且必须包含有效对话内容
    if (!script || script.trim().length < 20) {
      throw new Error('脚本内容为空或太短，无法生成播客音频（请检查输入内容是否有效）')
    }

    state.scriptText = script
    state.synthError = null // v1.0.26: 清除之前的错误
    render()

    // 3. 合成音频
    toast('开始合成音频（可能需要几分钟）...', 'info')
    await synthesizeAudioFromScript(script)
  } catch (err) {
    console.error('Generate podcast error:', err)
    const errMsg = err.message || t('errSynthFailed') || '生成失败'
    toast(errMsg, 'error')
    // v1.0.26: 将错误写入 state.synthError，在脚本下方持久显示
    state.synthError = errMsg
  } finally {
    state.isGenerating = false
    render()
  }
}

window.synthesizeOnly = async function() {
  if (!state.scriptText) {
    toast(t('errNoScript'), 'error')
    return
  }
  // v1.0.25: 改进服务状态检查（与 generatePodcast 一致）
  if (state.serviceStatus === 'offline' || state.serviceStatus === 'unknown') {
    toast('正在检测语音服务状态...', 'info')
    await checkServiceHealth()
    if (state.serviceStatus !== 'online' && state.serviceStatus !== 'busy') {
      toast('语音服务未启动，请等待服务启动后重试', 'error')
      return
    }
  }
  state.isGenerating = true
  state.progress = { stage: 'synth', current: 0, total: 0 }
  state.synthFinalizing = false
  state.synthError = null
  render()
  try {
    toast('开始合成音频...', 'info')
    await synthesizeAudioFromScript(state.scriptText)
  } catch (err) {
    console.error('[Podcast] Synthesize only error:', err)
    const errMsg = err.message || t('errSynthFailed') || '合成失败'
    toast(errMsg, 'error')
    state.synthError = errMsg
  } finally {
    state.isGenerating = false
    state.synthFinalizing = false
    render()
  }
}

async function synthesizeAudioFromScript(script) {
  // v1.0.24: 增强错误处理，每个失败点都有明确提示
  if (!script || script.trim().length < 10) {
    throw new Error('脚本内容为空，无法合成音频')
  }

  // v1.0.24: 检查 voice-service 是否在线
  if (state.serviceStatus === 'offline' || !state.serviceUrl) {
    throw new Error('语音服务未启动，无法合成音频（请在设置中启动语音服务）')
  }

  // 解析 clone IDs
  const cloneIds = []
  if (state.voice1 && state.voice1.startsWith('clone-')) {
    cloneIds.push(state.voice1.replace('clone-', ''))
  }
  if (state.podcastType === 'dual' && state.voice2 && state.voice2.startsWith('clone-')) {
    cloneIds.push(state.voice2.replace('clone-', ''))
  }

  state.progress = { stage: 'synth', current: 0, total: 0 }
  state.synthFinalizing = false
  render()

  console.log('[Podcast] Starting synthesis, script length:', script.length, 'cloneIds:', cloneIds)

  // v1.0.28: 合成重试机制
  // 后端 Python 进程可能因 OOM/segfault 崩溃，导致 "BodyStreamBuffer was aborted"
  // main.ts 会自动重启服务，这里在检测到崩溃错误时等待服务恢复后重试
  const MAX_SYNTH_RETRIES = 2
  let audioResult
  let lastSynthError = null

  for (let attempt = 0; attempt <= MAX_SYNTH_RETRIES; attempt++) {
    try {
      if (attempt > 0) {
        console.log(`[Podcast] Retrying synthesis (attempt ${attempt + 1}/${MAX_SYNTH_RETRIES + 1})...`)
        toast(`服务异常，正在等待恢复后重试 (${attempt + 1}/${MAX_SYNTH_RETRIES + 1})...`, 'info')
        // 等待服务自动重启（main.ts 的 auto-restart 会在 2 秒后启动）
        await new Promise(r => setTimeout(r, 5000))
        // 轮询等待服务恢复（最多等 60 秒）
        let waitCount = 0
        while (waitCount < 30) {
          await checkServiceHealth()
          if (state.serviceStatus === 'online' || state.serviceStatus === 'busy') {
            break
          }
          await new Promise(r => setTimeout(r, 2000))
          waitCount++
        }
        if (state.serviceStatus !== 'online' && state.serviceStatus !== 'busy') {
          throw new Error('语音服务未能自动恢复，请重启应用后重试')
        }
        console.log('[Podcast] Service recovered, retrying synthesis')
        // 重置进度状态
        state.progress = { stage: 'synth', current: 0, total: 0 }
        state.synthFinalizing = false
        render()
      }

      audioResult = await synthesizePodcast(
        script,
        cloneIds,
        state.podcastType,
        state.voice1,
        state.voice2,
        (p) => {
          if (p.stage === 'finalizing') {
            state.synthFinalizing = true
          } else {
            state.synthFinalizing = false
            state.progress = { stage: 'synth', current: p.current, total: p.total }
          }
          render()
        }
      )
      // 合成成功，跳出重试循环
      break
    } catch (synthErr) {
      lastSynthError = synthErr
      console.error(`[Podcast] Synthesis attempt ${attempt + 1} failed:`, synthErr)
      const errMsg = (synthErr.message || '').toLowerCase()
      // 判断是否为可重试的错误（进程崩溃/网络中断类）
      const isRetryable = errMsg.includes('bodystreambuffer') ||
                         errMsg.includes('aborted') ||
                         errMsg.includes('failed to fetch') ||
                         errMsg.includes('network') ||
                         errMsg.includes('fetch failed') ||
                         errMsg.includes('连接超时') ||
                         errMsg.includes('连接中断') ||
                         errMsg.includes('broken pipe') ||
                         errMsg.includes('流结束')
      if (!isRetryable || attempt === MAX_SYNTH_RETRIES) {
        throw new Error(`音频合成失败: ${synthErr.message || synthErr}`)
      }
      // 可重试，继续循环
    }
  }

  if (!audioResult || !(audioResult instanceof ArrayBuffer) || audioResult.byteLength === 0) {
    console.error('[Podcast] No audio result returned:', audioResult)
    throw new Error('音频合成返回空结果，请检查语音服务是否正常运行')
  }

  // v1.0.20: 回退到 ArrayBuffer + blob URL 方案
  // HTTP URL 方案在 Electron <audio> 中时长为 0，blob URL 更可靠
  state.audioBuffer = audioResult
  const blob = new Blob([audioResult], { type: 'audio/wav' })
  if (state.audioUrl && state.audioUrl.startsWith('blob:')) {
    URL.revokeObjectURL(state.audioUrl)
  }
  state.audioUrl = URL.createObjectURL(blob)
  console.log('[Podcast] Blob URL created:', state.audioUrl, 'size:', audioResult.byteLength)
  state.synthError = null // v1.0.26: 合成成功，清除错误
  toast('音频合成完成！', 'success')
  // v1.0.25: 显式触发 render，确保播放器立即显示
  render()

  // 保存到历史记录
  const historyItem = {
    id: Date.now().toString(),
    title: state.urlInput || state.uploadedFile?.name || (state.locale === 'zh' ? '文本播客' : 'Text Podcast'),
    script,
    audioUrl: state.audioUrl,
    duration: Math.floor(script.length / 4),
    createdAt: Date.now(),
  }
  state.history.unshift(historyItem)
  if (state.history.length > 50) state.history = state.history.slice(0, 50)
  localStorage.setItem('podcastai-history', JSON.stringify(state.history))

  toast(t('synthesisComplete'), 'success')
}

window.createCloneAction = async function() {
  if (state.isCloning) return
  if (!state.cloneName.trim()) {
    toast(t('errNoCloneName'), 'error')
    return
  }
  if (!state.cloneAudioFile) {
    toast(t('errNoCloneAudio'), 'error')
    return
  }
  if (state.serviceStatus === 'offline') {
    toast(t('errServiceUnavailable'), 'error')
    return
  }

  state.isCloning = true
  render()

  try {
    const formData = new FormData()
    formData.append('name', state.cloneName)
    formData.append('gender', state.cloneGender || 'female')
    formData.append('description', state.cloneDescription)
    formData.append('prompt_text', state.clonePromptText)
    formData.append('audio', state.cloneAudioFile)

    await createClone(formData)
    toast(t('cloneSuccess'), 'success')

    // 重置表单
    state.cloneName = ''
    state.cloneGender = ''
    state.cloneDescription = ''
    state.clonePromptText = ''
    state.cloneAudioFile = null

    // 刷新克隆列表
    await fetchClones()
  } catch (err) {
    console.error('Clone error:', err)
    toast(err.message || t('errCloneFailed'), 'error')
  } finally {
    state.isCloning = false
    render()
  }
}

window.previewClone = async function(cloneId) {
  if (state.previewPlayingId === cloneId) {
    // 停止播放
    if (state.previewAudio) {
      state.previewAudio.pause()
      state.previewAudio = null
    }
    state.previewPlayingId = null
    render()
    return
  }

  // v1.0.10: 克隆完成后后台已在生成预览，这里轮询直到克隆声音就绪
  // 不再返回原声，确保用户听到的是克隆后的声音
  state.previewLoadingId = cloneId
  render()

  const maxAttempts = 90  // v1.0.14: 90 次 × 1 秒 = 90 秒（预览约 13 秒生成完毕）
  const waitMs = (ms) => new Promise(r => setTimeout(r, ms))

  try {
    let res = null
    for (let i = 0; i < maxAttempts; i++) {
      res = await fetch(`${state.serviceUrl}/preview/${cloneId}`)
      if (res.status === 200) {
        // 克隆声音就绪
        break
      }
      if (res.status === 202) {
        // v1.0.11: 解析响应体，检查是否实际为 failed 状态
        try {
          const body = await res.json()
          if (body && body.status === 'failed') {
            throw new Error(body.message || 'Preview generation failed')
          }
        } catch (parseErr) {
          // JSON 解析失败说明确实是 generating，继续等待
        }
        // v1.0.14: 轮询间隔从 2秒 → 1秒（预览约 13 秒，1 秒粒度足够）
        await waitMs(1000)
        continue
      }
      // v1.0.11: 500 状态码（任务失败）直接报错，不再死循环
      if (res.status === 500) {
        let errMsg = 'Preview generation failed'
        try {
          const body = await res.json()
          if (body && body.message) errMsg = body.message
        } catch {}
        throw new Error(errMsg)
      }
      // 其他错误状态
      throw new Error(`HTTP ${res.status}`)
    }

    if (!res || res.status !== 200) {
      throw new Error('Preview generation timeout')
    }

    state.previewLoadingId = null
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)

    if (state.previewAudio) {
      state.previewAudio.pause()
    }
    state.previewAudio = new Audio(url)
    state.previewAudio.onended = () => {
      state.previewPlayingId = null
      URL.revokeObjectURL(url)
      render()
    }
    // v1.0.39: 添加 onerror 处理，捕获音频加载/播放失败
    state.previewAudio.onerror = (e) => {
      console.error('Preview audio error:', e)
      state.previewLoadingId = null
      state.previewPlayingId = null
      URL.revokeObjectURL(url)
      toast(state.locale === 'zh' ? '音频播放失败，请重试' : 'Audio playback failed, please retry', 'error')
      render()
    }
    // v1.0.39: 捕获 play() Promise rejection（如自动播放策略阻止）
    state.previewAudio.play().catch((playErr) => {
      console.error('Preview play() rejected:', playErr)
      state.previewLoadingId = null
      state.previewPlayingId = null
      URL.revokeObjectURL(url)
      toast(state.locale === 'zh' ? '播放失败：' + (playErr.message || '未知错误') : 'Playback failed: ' + (playErr.message || 'unknown error'), 'error')
      render()
    })
    state.previewPlayingId = cloneId
    render()
  } catch (err) {
    state.previewLoadingId = null
    toast(err.message || t('errNetwork'), 'error')
    render()
  }
}

window.deleteClone = async function(cloneId) {
  if (!confirm(t('cloneDeleteConfirm'))) return
  try {
    await fetch(`${state.serviceUrl}/clones/${cloneId}`, { method: 'DELETE' })
    await fetchClones()
    toast(t('deleteSuccess'), 'success')
  } catch (err) {
    toast(err.message || t('errNetwork'), 'error')
  }
}

// v1.0.10: 播客页面声音试听（克隆声音支持轮询等待生成）
window.previewPodcastVoice = async function(target) {
  // 正在播放则停止
  if (state.podcastVoicePlaying === target) {
    if (state.podcastVoiceAudio) {
      state.podcastVoiceAudio.pause()
      state.podcastVoiceAudio = null
    }
    state.podcastVoicePlaying = null
    render()
    return
  }

  const voiceId = state[target]
  if (!voiceId) return

  state.podcastVoiceLoading = target
  render()

  const waitMs = (ms) => new Promise(r => setTimeout(r, ms))

  try {
    let url
    if (voiceId.startsWith('clone-')) {
      // 克隆声音 — 轮询 /preview/{clone_id} 直到克隆声音就绪
      const cloneId = voiceId.replace('clone-', '')
      const maxAttempts = 90
      let res = null
      for (let i = 0; i < maxAttempts; i++) {
        res = await fetch(`${state.serviceUrl}/preview/${cloneId}`)
        if (res.status === 200) break
        if (res.status === 202) {
          // v1.0.11: 解析响应体，检查是否实际为 failed 状态
          try {
            const body = await res.json()
            if (body && body.status === 'failed') {
              throw new Error(body.message || 'Preview generation failed')
            }
          } catch (parseErr) {
            // JSON 解析失败说明确实是 generating
          }
          // v1.0.14: 轮询间隔从 2秒 → 1秒
          await waitMs(1000)
          continue
        }
        // v1.0.11: 500 状态码（任务失败）直接报错
        if (res.status === 500) {
          let errMsg = 'Preview generation failed'
          try {
            const body = await res.json()
            if (body && body.message) errMsg = body.message
          } catch {}
          throw new Error(errMsg)
        }
        throw new Error(`HTTP ${res.status}`)
      }
      if (!res || res.status !== 200) throw new Error('Preview generation timeout')
      const blob = await res.blob()
      url = URL.createObjectURL(blob)
    } else {
      // 系统声音 — 调用 /system-voice-preview/{voice_id}
      const res = await fetch(`${state.serviceUrl}/system-voice-preview/${voiceId}`)
      if (res.status !== 200) throw new Error(`HTTP ${res.status}`)
      const blob = await res.blob()
      url = URL.createObjectURL(blob)
    }

    state.podcastVoiceLoading = null
    if (state.podcastVoiceAudio) {
      state.podcastVoiceAudio.pause()
    }
    state.podcastVoiceAudio = new Audio(url)
    state.podcastVoiceAudio.onended = () => {
      state.podcastVoicePlaying = null
      URL.revokeObjectURL(url)
      render()
    }
    state.podcastVoiceAudio.play()
    state.podcastVoicePlaying = target
    render()
  } catch (err) {
    state.podcastVoiceLoading = null
    toast(err.message || t('errNetwork'), 'error')
    render()
  }
}

window.playHistoryAudio = function(id) {
  const item = state.history.find(h => h.id === id)
  if (!item || !item.audioUrl) return
  const audio = document.getElementById('hidden-audio')
  audio.src = item.audioUrl
  audio.play()
}

window.deleteHistory = function(id) {
  if (!confirm(t('historyDeleteConfirm'))) return
  state.history = state.history.filter(h => h.id !== id)
  localStorage.setItem('podcastai-history', JSON.stringify(state.history))
  toast(t('deleteSuccess'), 'success')
  render()
}

window.clearAllHistory = function() {
  if (!confirm(t('historyClearAllConfirm'))) return
  state.history = []
  localStorage.setItem('podcastai-history', JSON.stringify([]))
  toast(t('clearSuccess'), 'success')
  render()
}

window.saveSettings = function() {
  const url = document.getElementById('settings-service-url').value.trim()
  const timeout = parseInt(document.getElementById('settings-timeout').value, 10)
  if (url) {
    state.serviceUrl = url
    localStorage.setItem('podcastai-service-url', url)
  }
  if (timeout > 0) {
    state.serviceTimeout = timeout
    localStorage.setItem('podcastai-timeout', String(timeout))
  }
  toast(t('settingsSaved'), 'success')
  // 重新检测服务状态
  checkServiceHealth().then(render)
}

window.resetSettings = function() {
  state.serviceUrl = 'http://localhost:8907'
  state.serviceTimeout = 60
  localStorage.removeItem('podcastai-service-url')
  localStorage.removeItem('podcastai-timeout')
  toast(t('settingsSaved'), 'success')
  checkServiceHealth().then(render)
}

// ════════════════════════════════════════════════════════════
// 服务管理器事件
// ════════════════════════════════════════════════════════════
window.detectServiceEnvironment = async function() {
  if (!window.podcastai?.service) return
  state.serviceManager.detecting = true
  render()
  try {
    const result = await window.podcastai.service.detect()
    state.serviceManager.detection = result
    // 保存检测到的路径到设置
    if (result.voiceServicePath) {
      const settings = await window.podcastai.settings.get()
      await window.podcastai.settings.set({
        ...settings,
        voiceServicePath: result.voiceServicePath,
      })
    }
    // 同步进程状态
    const status = await window.podcastai.service.status()
    state.serviceManager.processRunning = status.running
    state.serviceManager.processPid = status.pid
  } catch (err) {
    console.error('Detection failed:', err)
    toast(err.message || t('serviceCheckFailed'), 'error')
  } finally {
    state.serviceManager.detecting = false
    render()
  }
}

window.startServiceAction = async function() {
  if (!window.podcastai?.service) {
    toast(t('errServiceUnavailable'), 'error')
    return
  }
  if (state.serviceManager.isStarting) return

  state.serviceManager.isStarting = true
  render()

  try {
    const result = await window.podcastai.service.start()
    if (result.success) {
      state.serviceManager.processRunning = true
      state.serviceManager.processPid = result.pid || null
      toast(t('serviceStarted'), 'success')
      // 轮询 HTTP 端点直到服务就绪（最多 30 秒）
      let attempts = 0
      const poll = async () => {
        attempts++
        const ok = await checkServiceHealth()
        if (ok) {
          toast(t('serviceRunning'), 'success')
          await fetchClones()
          render()
        } else if (attempts < 30) {
          setTimeout(poll, 1000)
        } else {
          toast(t('portConflict'), 'warning')
          render()
        }
      }
      setTimeout(poll, 2000)
    } else {
      toast(result.error || t('serviceStartFailed'), 'error')
    }
  } catch (err) {
    toast(err.message || t('serviceStartFailed'), 'error')
  } finally {
    state.serviceManager.isStarting = false
    render()
  }
}

window.stopServiceAction = async function() {
  if (!window.podcastai?.service) return
  if (state.serviceManager.isStopping) return

  state.serviceManager.isStopping = true
  render()

  try {
    const result = await window.podcastai.service.stop()
    if (result.success) {
      state.serviceManager.processRunning = false
      state.serviceManager.processPid = null
      state.serviceStatus = 'offline'
      toast(t('serviceStopped'), 'success')
    } else {
      toast(result.error || 'Stop failed', 'error')
    }
  } catch (err) {
    toast(err.message || 'Stop failed', 'error')
  } finally {
    state.serviceManager.isStopping = false
    render()
  }
}

window.browseVoiceServiceDir = async function() {
  if (!window.podcastai?.dialog) return
  const dir = await window.podcastai.dialog.openDirectory()
  if (!dir) return

  // 保存到设置
  const settings = await window.podcastai.settings.get()
  await window.podcastai.settings.set({
    ...settings,
    voiceServicePath: dir,
  })

  // 重新检测
  await window.detectServiceEnvironment()
}

window.toggleAutoStart = async function(checked) {
  state.serviceManager.autoStart = checked
  if (window.podcastai?.settings) {
    const settings = await window.podcastai.settings.get()
    await window.podcastai.settings.set({
      ...settings,
      autoStartService: checked,
    })
  }
}

window.clearServiceLogs = async function() {
  state.serviceManager.logs = []
  if (window.podcastai?.service) {
    await window.podcastai.service.clearLogs()
  }
  render()
}

// ════════════════════════════════════════════════════════════
// 模型管理事件（v1.0.4）
// ════════════════════════════════════════════════════════════
window.downloadModelAction = async function() {
  if (!window.podcastai?.model) return
  if (state.model.downloadState.isDownloading) return
  state.model.downloadState.error = null
  state.model.downloadState.isDownloading = true
  render()
  try {
    const result = await window.podcastai.model.download()
    if (result.success) {
      toast(t('modelDownloadComplete'), 'success')
      // 刷新模型状态
      state.model.status = await window.podcastai.model.status()
    } else {
      if (result.error === 'Aborted') {
        toast(t('modelDownloadAborted'), 'warning')
      } else {
        toast(result.error || t('modelDownloadFailed'), 'error')
      }
    }
  } catch (err) {
    toast(err.message || t('modelDownloadFailed'), 'error')
  } finally {
    state.model.downloadState = await window.podcastai.model.getDownloadState()
    state.model.status = await window.podcastai.model.status()
    render()
  }
}

window.abortModelDownload = async function() {
  if (!window.podcastai?.model) return
  await window.podcastai.model.abortDownload()
  // 注意：实际中止是异步的，会在 onDownloadProgress 中更新 UI
}

window.openModelDir = async function() {
  if (!window.podcastai?.model) return
  await window.podcastai.model.openDir()
}

// ════════════════════════════════════════════════════════════
// v1.0.79: Python 运行环境操作
// ════════════════════════════════════════════════════════════
window.downloadRuntimeAction = async function() {
  if (!window.podcastai?.runtime) return
  if (state.runtime.downloadState.isDownloading) return
  state.runtime.downloadState.error = null
  render()
  try {
    const result = await window.podcastai.runtime.download()
    if (result.success) {
      toast(t('runtimeDownloadComplete'), 'success')
      state.runtime.installed = true
    } else {
      if (result.error === 'Aborted') {
        toast(t('runtimeDownloadAborted'), 'warning')
      } else {
        toast(result.error || t('runtimeDownloadFailed'), 'error')
      }
    }
  } catch (err) {
    toast(err.message || t('runtimeDownloadFailed'), 'error')
  } finally {
    state.runtime.downloadState = await window.podcastai.runtime.getDownloadState()
    state.runtime.installed = !!state.runtime.downloadState.installed
    render()
  }
}

window.abortRuntimeDownload = async function() {
  if (!window.podcastai?.runtime) return
  await window.podcastai.runtime.abortDownload()
}

window.openRuntimeDir = async function() {
  if (!window.podcastai?.runtime) return
  await window.podcastai.runtime.openDir()
}

async function refreshRuntimeStatus() {
  if (!window.podcastai?.runtime) return
  try {
    state.runtime.downloadState = await window.podcastai.runtime.getDownloadState()
    state.runtime.installed = !!state.runtime.downloadState.installed
    render()
  } catch (err) {
    console.error('Failed to refresh runtime status:', err)
  }
}

async function refreshModelStatus() {
  if (!window.podcastai?.model) return
  try {
    state.model.status = await window.podcastai.model.status()
    state.model.downloadState = await window.podcastai.model.getDownloadState()
    render()
  } catch (err) {
    console.error('Failed to refresh model status:', err)
  }
}

// ════════════════════════════════════════════════════════════
// v1.0.31: 认证系统
// 强制登录：无 token 时显示登录覆盖层，阻止访问主应用
// ════════════════════════════════════════════════════════════

/**
 * 显示登录覆盖层
 */
function showAuthOverlay() {
  const overlay = document.getElementById('auth-overlay')
  if (overlay) overlay.classList.remove('hidden')
}

/**
 * 隐藏登录覆盖层（认证成功后调用）
 */
function hideAuthOverlay() {
  const overlay = document.getElementById('auth-overlay')
  if (overlay) overlay.classList.add('hidden')
}

/**
 * 显示认证状态信息
 */
function setAuthStatus(message, type = 'info') {
  const el = document.getElementById('auth-status')
  if (!el) return
  el.textContent = message
  el.className = `auth-status visible ${type}`
}

/**
 * 清除认证状态信息
 */
function clearAuthStatus() {
  const el = document.getElementById('auth-status')
  if (!el) return
  el.textContent = ''
  el.className = 'auth-status'
}

/**
 * 更新登录按钮状态
 */
function setAuthButtonState(options = {}) {
  const btn = document.getElementById('auth-login-btn')
  const btnText = document.getElementById('auth-login-btn-text')
  const subtitle = document.getElementById('auth-subtitle')
  const userInfo = document.getElementById('auth-user-info')
  const userEmail = document.getElementById('auth-user-email')
  const signoutBtn = document.getElementById('auth-signout-btn')

  if (!btn) return

  if (options.loading) {
    btn.disabled = true
    if (btnText) btnText.innerHTML = `<span class="auth-spinner"></span>等待网页登录...`
    if (subtitle) subtitle.textContent = '请在浏览器中完成登录，完成后将自动返回'
  } else {
    btn.disabled = false
    if (btnText) btnText.textContent = '打开网页登录'
    if (subtitle) subtitle.textContent = '登录后开始创建精彩播客'
  }

  // 已登录用户显示信息
  if (state.auth.isAuthenticated && state.auth.email) {
    if (userInfo) userInfo.style.display = 'block'
    if (userEmail) userEmail.textContent = state.auth.email
    if (btnText) btnText.textContent = '切换账号'
    if (subtitle) subtitle.textContent = '已登录，正在进入应用...'
  } else {
    if (userInfo) userInfo.style.display = 'none'
  }

  // 退出登录按钮
  if (signoutBtn) {
    signoutBtn.onclick = async () => {
      if (window.podcastai?.auth?.signOut) {
        await window.podcastai.auth.signOut()
      }
      state.auth = { isAuthenticated: false, token: null, email: null, name: null, userId: null }
      setAuthButtonState({})
      setAuthStatus('已退出登录，请重新登录', 'info')
    }
  }
}

/**
 * 初始化认证状态
 * - 检查是否有持久化的 token
 * - 注册登录成功/退出登录事件监听
 * - 绑定登录按钮点击事件
 */
async function initAuth() {
  // 注册事件监听
  if (window.podcastai?.auth?.onLoginSuccess) {
    window.podcastai.auth.onLoginSuccess((info) => {
      state.auth = {
        isAuthenticated: true,
        token: info.token,
        email: info.email || null,
        name: info.name || null,
        userId: info.userId || null,
      }
      setAuthStatus('登录成功！正在进入应用...', 'success')
      setAuthButtonState({ loading: false })
      // 短暂延迟后隐藏覆盖层
      setTimeout(() => {
        hideAuthOverlay()
        clearAuthStatus()
      }, 800)
    })
  }

  if (window.podcastai?.auth?.onLogout) {
    window.podcastai.auth.onLogout(() => {
      state.auth = { isAuthenticated: false, token: null, email: null, name: null, userId: null }
      showAuthOverlay()
      setAuthButtonState({})
      setAuthStatus('已退出登录', 'info')
    })
  }

  // v1.0.78: 网页端发起的反向认证请求（podcastai://auth）且桌面端未登录
  // 提示用户先完成桌面端登录，登录成功后 token 会自动回传给网页端
  if (window.podcastai?.auth?.onWebAuthRequested) {
    window.podcastai.auth.onWebAuthRequested(() => {
      showAuthOverlay()
      setAuthButtonState({})
      setAuthStatus('网页端请求桌面客户端认证，请点击"打开网页登录"完成登录，登录后将自动返回网页端', 'info')
    })
  }

  // 绑定登录按钮
  const loginBtn = document.getElementById('auth-login-btn')
  if (loginBtn) {
    loginBtn.onclick = async () => {
      clearAuthStatus()
      setAuthButtonState({ loading: true })
      if (window.podcastai?.auth?.openWebLogin) {
        const result = await window.podcastai.auth.openWebLogin()
        if (!result?.success) {
          setAuthStatus('打开网页失败：' + (result?.error || '未知错误'), 'error')
          setAuthButtonState({ loading: false })
        } else {
          setAuthStatus('已打开浏览器，请在网页中完成登录', 'info')
        }
      } else {
        setAuthStatus('认证系统未就绪，请重启应用', 'error')
        setAuthButtonState({ loading: false })
      }
    }
  }

  // 检查持久化的 token
  try {
    if (window.podcastai?.auth?.getState) {
      const authState = await window.podcastai.auth.getState()
      if (authState?.token) {
        state.auth = {
          isAuthenticated: true,
          token: authState.token,
          email: authState.email || null,
          name: authState.name || null,
          userId: authState.userId || null,
        }
        // 已登录，直接隐藏覆盖层
        hideAuthOverlay()
        return
      }
    }
  } catch (err) {
    console.warn('[AUTH] Failed to check auth state:', err)
  }

  // 未登录，显示覆盖层
  showAuthOverlay()
  setAuthButtonState({})
}

// ════════════════════════════════════════════════════════════
// 初始化
// ════════════════════════════════════════════════════════════
async function init() {
  document.documentElement.lang = localeHtmlLang(state.locale)

  // v1.0.75: 启动即应用主题，避免闪烁
  applyTheme()

  // v1.0.31: 启动时先校验登录状态
  await initAuth()

  render()

  // 加载客户端版本信息
  try {
    if (window.podcastai?.getVersion) {
      state.appVersion = await window.podcastai.getVersion()
      render()
    }
  } catch {
    // ignore
  }

  // 加载设置 + 服务管理器初始化
  if (window.podcastai?.service) {
    // 订阅实时日志
    window.podcastai.service.onLog((line) => {
      state.serviceManager.logs.push(line)
      if (state.serviceManager.logs.length > 200) state.serviceManager.logs.shift()
      // 只在设置页可见时更新日志面板
      const logsEl = document.getElementById('service-logs')
      if (logsEl) {
        const div = document.createElement('div')
        div.className = 'text-stone-500 whitespace-pre-wrap'
        div.textContent = line
        logsEl.appendChild(div)
        // 限制 DOM 节点数量
        while (logsEl.children.length > 200) {
          logsEl.removeChild(logsEl.firstChild)
        }
        logsEl.scrollTop = logsEl.scrollHeight
      }
    })

    // 加载持久化设置
    try {
      const settings = await window.podcastai.settings.get()
      state.serviceManager.autoStart = !!settings.autoStartService
      state.serviceManager.settingsLoaded = true
    } catch {
      // ignore
    }

    // 检测环境（v1.0.4 兼容：返回内置运行时状态）
    await window.detectServiceEnvironment()

    // 查询进程状态
    try {
      const status = await window.podcastai.service.status()
      state.serviceManager.processRunning = status.running
      state.serviceManager.processPid = status.pid
    } catch {
      // ignore
    }
  }

  // 模型管理初始化（v1.0.4）
  if (window.podcastai?.model) {
    // 订阅下载进度
    window.podcastai.model.onDownloadProgress((progress) => {
      state.model.downloadState = progress
      // 只在设置页或克隆页可见时更新 UI（避免频繁全量 render）
      const modelSection = document.getElementById('model-download-section')
      if (modelSection || state.activeView === 'settings' || state.activeView === 'clone') {
        render()
      }
    })
    // 初始查询模型状态
    await refreshModelStatus()
  }

  // 运行时管理初始化（v1.0.79）
  if (window.podcastai?.runtime) {
    // 订阅下载进度
    window.podcastai.runtime.onDownloadProgress((progress) => {
      state.runtime.downloadState = progress
      state.runtime.installed = !!progress.installed
      if (state.activeView === 'settings') {
        render()
      }
    })
    // 初始查询运行时状态
    await refreshRuntimeStatus()
  }

  // 检查服务状态
  await checkServiceHealth()
  // 加载克隆列表
  if (state.serviceStatus !== 'offline') {
    await fetchClones()
  }
  // 定期检查服务状态（缩短到 10 秒，更快感知服务就绪）
  setInterval(async () => {
    const prev = state.serviceStatus
    await checkServiceHealth()
    if (prev !== state.serviceStatus) {
      if (state.serviceStatus !== 'offline' && prev === 'offline') {
        await fetchClones()
      }
      render()
    }
  }, 10000)

  // 监听主进程的服务状态变化事件（自动启动完成后触发）
  if (window.podcastai?.service?.onStateChanged) {
    window.podcastai.service.onStateChanged(async (info) => {
      // 刷新进程状态（处理 init() 在服务启动前运行的竞态）
      try {
        const status = await window.podcastai.service.status()
        state.serviceManager.processRunning = status.running
        state.serviceManager.processPid = status.pid
      } catch {}
      // 主进程通知服务已就绪（或超时失败），立即刷新状态
      await checkServiceHealth()
      if (state.serviceStatus !== 'offline') {
        await fetchClones()
      }
      // 如果主进程说还没就绪，但进程在运行，启动轮询
      if (!info.ready && state.serviceManager.processRunning && state.serviceStatus === 'offline') {
        startServiceReadinessPolling()
      }
      render()
    })
  }

  // v1.0.5: 如果服务进程在运行但 HTTP 还未就绪，启动长时间轮询
  // CosyVoice2 首次加载可能需要 60-120 秒（3.7GB 模型 + PyTorch 初始化）
  if (state.serviceManager.processRunning && state.serviceStatus === 'offline') {
    startServiceReadinessPolling()
  }
}

// 全局轮询控制器，避免多个轮询同时运行
let _readinessPollingActive = false
function startServiceReadinessPolling() {
  if (_readinessPollingActive) return
  _readinessPollingActive = true

  const poll = async (attempts) => {
    // 最多轮询 90 次 × 2 秒 = 180 秒
    if (attempts >= 90) {
      _readinessPollingActive = false
      render()
      return
    }
    const ok = await checkServiceHealth()
    if (ok) {
      await fetchClones()
      _readinessPollingActive = false
      render()
    } else {
      // 每次轮询都触发 render，让 banner 显示实时状态
      render()
      setTimeout(() => poll(attempts + 1), 2000)
    }
  }
  setTimeout(() => poll(0), 2000)
}

init()
