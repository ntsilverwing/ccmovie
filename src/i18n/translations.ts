export type Lang = 'en' | 'zh'

const translations = {
  en: {
    // App.tsx
    continueWithSaved: 'Continue with saved movie',
    deleteMovie: 'Delete {fileName}',
    back: 'Back',

    // PlaybackControls.tsx
    start: 'Start',
    reset: 'Reset',
    stop: 'Stop',
    pause: 'Pause',
    resume: 'Resume',
    dim: 'Dim',
    bright: 'Bright',
    contrast: 'Contrast',
    normal: 'Normal',
    fontSizeLabel: 'Aa',
    fullscreen: 'Fullscreen',
    exitFullscreen: 'Exit Fullscreen',
    wakeLockOn: 'Screen ON',

    // CuePreview.tsx
    importToGetStarted: 'Import an SRT file to get started',
    parsedWithWarnings: 'Parsed with {count} warnings',
    fileLabel: 'File:',
    encodingLabel: 'Encoding:',
    cuesLabel: 'Cues:',
    savedMovies: 'Saved Movies',

    // FilePicker.tsx
    dropSRT: 'Drop SRT file here or tap to browse',

    // fileImport.ts
    invalidType: 'Please select an SRT or TXT subtitle file.',
    fileTooLarge: 'File is too large. Maximum size is 5MB.',
    noCues: 'No subtitle cues found. The file may be corrupted or in an unsupported format.',
    persistenceError: 'Could not save subtitle to device: {message}',

    // RotateOverlay.tsx
    rotateToLandscape: 'Rotate to Landscape',

    // RegisterSW.tsx
    newVersion: 'New version available. Reload to update?',
    offlineReady: 'App ready for offline use',
  },
  zh: {
    // App.tsx
    continueWithSaved: '继续观看已保存影片',
    deleteMovie: '删除 {fileName}',
    back: '返回',

    // PlaybackControls.tsx
    start: '开始',
    reset: '重置',
    stop: '停止',
    pause: '暂停',
    resume: '继续',
    dim: '调暗',
    bright: '调亮',
    contrast: '高对比',
    normal: '正常',
    fontSizeLabel: '字',
    fullscreen: '全屏',
    exitFullscreen: '退出全屏',
    wakeLockOn: '屏幕常亮',

    // CuePreview.tsx
    importToGetStarted: '导入 SRT 文件开始使用',
    parsedWithWarnings: '解析完成，有 {count} 个警告',
    fileLabel: '文件：',
    encodingLabel: '编码：',
    cuesLabel: '字幕数：',
    savedMovies: '已保存影片',

    // FilePicker.tsx
    dropSRT: '拖放 SRT 文件到这里，或点击选择',

    // fileImport.ts
    invalidType: '请选择 SRT 或 TXT 字幕文件。',
    fileTooLarge: '文件过大，最大不超过 5MB。',
    noCues: '未找到字幕，文件可能损坏或格式不支持。',
    persistenceError: '无法保存字幕到设备：{message}',

    // RotateOverlay.tsx
    rotateToLandscape: '请旋转手机至横屏',

    // RegisterSW.tsx
    newVersion: '有新版本可用，是否重新加载？',
    offlineReady: '应用已准备好离线使用',
  },
} as const

export type TranslationKey = keyof typeof translations.en

export function t(lang: Lang, key: TranslationKey, params?: Record<string, string | number>): string {
  let text: string = translations[lang][key]
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replace(`{${k}}`, String(v))
    }
  }
  return text
}
