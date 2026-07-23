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
    modelManagerDesc: 'CosyVoice2 声音克隆模型（约 3.6GB，首次使用需下载）',
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
    modelManagerDesc: 'CosyVoice2 voice cloning model (~3.6GB, downloads on first use)',
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
    serviceAutoStarting: 'Voice service is starting...',
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
// 应用状态
// ════════════════════════════════════════════════════════════
const state = {
  locale: localStorage.getItem('podcastai-locale') || 'zh',
  serviceUrl: localStorage.getItem('podcastai-service-url') || 'http://localhost:8907',
  serviceTimeout: parseInt(localStorage.getItem('podcastai-timeout') || '60', 10),
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
  scriptText: '',
  audioUrl: null,
  audioBlob: null,
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
  // 客户端版本信息（init 时异步加载）
  appVersion: { version: '1.0.4', platform: 'unknown', arch: 'unknown' },
}

// ════════════════════════════════════════════════════════════
// 工具函数
// ════════════════════════════════════════════════════════════
function t(key, params = {}) {
  let str = (I18N[state.locale] && I18N[state.locale][key]) || I18N.zh[key] || key
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
  return d.toLocaleDateString(state.locale === 'zh' ? 'zh-CN' : 'en-US')
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
  setTimeout(() => {
    el.style.opacity = '0'
    el.style.transition = 'opacity 0.3s'
    setTimeout(() => el.remove(), 300)
  }, 3500)
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

  const res = await fetch(`${state.serviceUrl}/synthesize-podcast`, {
    method: 'POST',
    body: formData,
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(errText || `HTTP ${res.status}`)
  }

  // 检查响应类型：SSE 流（text/event-stream）或直接音频
  const contentType = res.headers.get('content-type') || ''

  if (contentType.includes('text/event-stream') || contentType.includes('application/x-ndjson')) {
    // 流式响应：解析进度事件 + 最终音频
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    const audioChunks = []

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      // 处理 SSE 事件（以 \n\n 分隔）
      const events = buffer.split('\n\n')
      buffer = events.pop() || ''

      for (const evt of events) {
        if (!evt.trim()) continue
        // 解析 data: JSON 行
        const lines = evt.split('\n').filter(l => l.startsWith('data:'))
        if (lines.length === 0) continue
        try {
          const data = JSON.parse(lines[0].slice(5).trim())
          if (data.type === 'segment_start' && onProgress) {
            onProgress({ stage: 'synth', current: data.segment_index + 1, total: data.total_segments })
          } else if (data.type === 'audio' && data.url) {
            // 下载音频分段
            const audioRes = await fetch(`${state.serviceUrl}${data.url}`)
            if (audioRes.ok) {
              const chunk = await audioRes.arrayBuffer()
              audioChunks.push(chunk)
            }
          } else if (data.type === 'complete' && data.audio_url) {
            // 完整音频
            const audioRes = await fetch(`${state.serviceUrl}${data.audio_url}`)
            if (audioRes.ok) {
              return await audioRes.arrayBuffer()
            }
          } else if (data.type === 'error') {
            throw new Error(data.message || data.error || 'Synthesis failed')
          }
        } catch (e) {
          console.warn('Failed to parse SSE event:', e)
        }
      }
    }

    // 如果是分块音频，合并
    if (audioChunks.length > 0) {
      return audioChunks[0] // 简化：返回第一个分块（实际应合并 wav）
    }
    return null
  } else if (contentType.includes('audio/')) {
    // 直接返回音频
    return await res.arrayBuffer()
  } else {
    // JSON 响应（可能是错误或降级）
    const data = await res.json().catch(() => ({}))
    if (data.error) throw new Error(data.error)
    if (data.audioUrl) {
      const audioRes = await fetch(`${state.serviceUrl}${data.audioUrl}`)
      return await audioRes.arrayBuffer()
    }
    throw new Error('Unexpected response format')
  }
}

// 通过在线 API 生成播客脚本（需要 LLM）
async function generatePodcastScriptOnline(content, podcastType) {
  // 使用在线 web 端的 /api/podcast/generate 接口
  const onlineApiUrl = 'https://podcastai-plum.vercel.app/api/podcast/generate'
  const res = await fetch(onlineApiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content,
      podcastType,
      source: 'desktop',
    }),
  })
  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`${t('errScriptFailed')}: ${errText}`)
  }
  const data = await res.json()
  return data.script || data.content || ''
}

// 从 URL 提取内容
async function fetchUrlContent(url) {
  const onlineApiUrl = 'https://podcastai-plum.vercel.app/api/podcast/extract-url'
  try {
    const res = await fetch(onlineApiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    })
    if (res.ok) {
      const data = await res.json()
      return data.content || data.text || ''
    }
  } catch (e) {
    console.warn('Online URL extract failed, trying direct fetch:', e)
  }
  // 降级：直接抓取
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' },
    signal: AbortSignal.timeout(15000),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const html = await res.text()
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
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
function render() {
  const app = document.getElementById('app')
  app.innerHTML = `
    <!-- Sidebar -->
    <aside class="w-64 flex-shrink-0 bg-white border-r border-stone-200 flex flex-col app-drag">
      <div class="p-5 border-b border-stone-200">
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
        <div class="flex gap-1 bg-stone-100 rounded-lg p-1">
          <button onclick="setLocale('zh')" class="flex-1 py-1.5 text-xs rounded-md transition ${state.locale === 'zh' ? 'bg-primary-600 text-white' : 'text-stone-500 hover:text-primary-700'}">${t('chinese')}</button>
          <button onclick="setLocale('en')" class="flex-1 py-1.5 text-xs rounded-md transition ${state.locale === 'en' ? 'bg-primary-600 text-white' : 'text-stone-500 hover:text-primary-700'}">${t('english')}</button>
        </div>
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
          <button onclick="startServiceAction()" disabled="${sm.isStarting}" class="px-3 py-1.5 text-xs bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white rounded-md transition flex items-center gap-1.5">
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
      <button onclick="generatePodcast()" disabled="${state.isGenerating}" class="w-full py-3.5 rounded-xl bg-gradient-to-r from-primary-600 to-purple-600 hover:from-primary-500 hover:to-purple-500 text-white font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
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

  return `
    <select onchange="state.${target} = this.value" class="w-full px-3 py-2 bg-white border border-stone-200 rounded-lg text-stone-900 text-sm focus:border-primary-600 focus:outline-none">
      <optgroup label="${t('systemVoice')}">
        ${systemVoices.map(v => `<option value="${v.id}" ${currentValue === v.id ? 'selected' : ''}>${voiceName(v)}</option>`).join('')}
      </optgroup>
      ${cloneVoices.length > 0 ? `
        <optgroup label="${t('cloneVoice')}">
          ${cloneVoices.map(c => `<option value="clone-${c.id}" ${currentValue === `clone-${c.id}` ? 'selected' : ''}>${escapeHtml(c.name)} (${c.gender === 'male' ? t('cloneGenderMale') : t('cloneGenderFemale')})</option>`).join('')}
        </optgroup>
      ` : ''}
    </select>
  `
}

function renderProgress() {
  const { stage, current, total } = state.progress
  const percent = total > 0 ? Math.round((current / total) * 100) : 0
  const stageText = stage === 'script' ? t('scriptGenerating') : (stage === 'synth' ? t('segmentProgress', { current, total }) : t('audioSynthesizing'))

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
        <a href="${state.audioUrl}" download="podcast-${Date.now()}.wav" class="text-xs text-primary-600 hover:text-primary-700 flex items-center gap-1">
          <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path d="M4 16v1a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
          ${t('download')}
        </a>
      </div>
      <audio controls src="${state.audioUrl}" class="w-full"></audio>
    </div>
  `
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

          <button onclick="${state.isCloning ? '' : (canClone ? 'createCloneAction()' : 'switchView(\\'settings\\')')}"
                  disabled="${state.isCloning}"
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
  return `
    <div class="flex items-center justify-between p-3 bg-white rounded-lg border border-stone-200 hover:border-stone-300 transition">
      <div class="flex-1 min-w-0">
        <div class="text-sm font-medium truncate">${escapeHtml(clone.name)}</div>
        <div class="text-xs text-stone-400 mt-0.5">
          ${clone.gender === 'male' ? t('cloneGenderMale') : t('cloneGenderFemale')} · ${formatDate((clone.created_at || 0) * 1000)}
        </div>
      </div>
      <div class="flex items-center gap-1">
        <button onclick="previewClone('${clone.id}')" class="p-2 text-stone-500 hover:text-primary-600 transition" title="${t('clonePreview')}">
          ${isPlaying ? `
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
        <div class="flex gap-2">
          <button onclick="setLocale('zh')" class="flex-1 py-2 text-sm rounded-lg border transition ${state.locale === 'zh' ? 'border-primary-600 bg-primary-50 text-primary-700' : 'border-stone-300 text-stone-500'}">${t('chinese')}</button>
          <button onclick="setLocale('en')" class="flex-1 py-2 text-sm rounded-lg border transition ${state.locale === 'en' ? 'border-primary-600 bg-primary-50 text-primary-700' : 'border-stone-300 text-stone-500'}">${t('english')}</button>
        </div>
      </div>

      <!-- Model Manager (v1.0.4) -->
      ${renderModelManager()}

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
                <button onclick="stopServiceAction()" disabled="${sm.isStopping}" class="px-4 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-sm rounded-lg transition flex items-center gap-2">
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
                <button onclick="startServiceAction()" disabled="${sm.isStarting || !d.python}" class="px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm rounded-lg transition flex items-center gap-2">
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

window.setLocale = function(locale) {
  state.locale = locale
  localStorage.setItem('podcastai-locale', locale)
  document.documentElement.lang = locale
  render()
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

  // 检查服务状态
  if (state.serviceStatus === 'offline') {
    toast(t('errServiceUnavailable'), 'error')
    return
  }

  state.isGenerating = true
  state.progress = { stage: 'script', current: 0, total: 0 }
  render()

  try {
    // 1. 获取内容
    if (state.inputMethod === 'url') {
      state.progress.stage = 'script'
      render()
      content = await fetchUrlContent(state.urlInput)
      if (!content) {
        throw new Error(t('errScriptFailed'))
      }
    }

    // 2. 生成脚本（通过在线 LLM API）
    state.progress = { stage: 'script', current: 0, total: 0 }
    render()
    let script = ''
    try {
      script = await generatePodcastScriptOnline(content, state.podcastType)
    } catch (e) {
      console.warn('Online script generation failed, using content directly:', e)
      // 降级：直接使用内容作为脚本
      script = content.slice(0, 10000)
    }

    state.scriptText = script
    render()

    // 3. 合成音频
    await synthesizeAudioFromScript(script)
  } catch (err) {
    console.error('Generate podcast error:', err)
    toast(err.message || t('errSynthFailed'), 'error')
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
  if (state.serviceStatus === 'offline') {
    toast(t('errServiceUnavailable'), 'error')
    return
  }
  state.isGenerating = true
  state.progress = { stage: 'synth', current: 0, total: 0 }
  render()
  try {
    await synthesizeAudioFromScript(state.scriptText)
  } catch (err) {
    toast(err.message || t('errSynthFailed'), 'error')
  } finally {
    state.isGenerating = false
    render()
  }
}

async function synthesizeAudioFromScript(script) {
  // 解析 clone IDs
  const cloneIds = []
  if (state.voice1 && state.voice1.startsWith('clone-')) {
    cloneIds.push(state.voice1.replace('clone-', ''))
  }
  if (state.podcastType === 'dual' && state.voice2 && state.voice2.startsWith('clone-')) {
    cloneIds.push(state.voice2.replace('clone-', ''))
  }

  state.progress = { stage: 'synth', current: 0, total: 0 }
  render()

  const audioBuffer = await synthesizePodcast(
    script,
    cloneIds,
    state.podcastType,
    state.voice1,
    state.voice2,
    (p) => {
      state.progress = { stage: 'synth', current: p.current, total: p.total }
      render()
    }
  )

  if (audioBuffer) {
    // 创建 blob URL
    const blob = new Blob([audioBuffer], { type: 'audio/wav' })
    if (state.audioUrl) URL.revokeObjectURL(state.audioUrl)
    state.audioUrl = URL.createObjectURL(blob)

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
  } else {
    throw new Error(t('errSynthFailed'))
  }
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

  try {
    const res = await fetch(`${state.serviceUrl}/preview/${cloneId}`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
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
    state.previewAudio.play()
    state.previewPlayingId = cloneId
    render()
  } catch (err) {
    toast(err.message || t('errNetwork'), 'error')
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
// 初始化
// ════════════════════════════════════════════════════════════
async function init() {
  document.documentElement.lang = state.locale
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

  // 检查服务状态
  await checkServiceHealth()
  // 加载克隆列表
  if (state.serviceStatus !== 'offline') {
    await fetchClones()
  }
  // 定期检查服务状态
  setInterval(async () => {
    const prev = state.serviceStatus
    await checkServiceHealth()
    if (prev !== state.serviceStatus) render()
  }, 30000)

  // v1.0.4: 如果服务进程在运行但 HTTP 还未就绪，启动轮询加速状态切换
  if (state.serviceManager.processRunning && state.serviceStatus === 'offline') {
    const poll = async (attempts) => {
      if (attempts >= 30) return
      const ok = await checkServiceHealth()
      if (ok) {
        await fetchClones()
        render()
      } else {
        setTimeout(() => poll(attempts + 1), 1500)
      }
    }
    setTimeout(() => poll(0), 1500)
  }
}

init()
