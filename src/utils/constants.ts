/**
 * 全局常量配置
 */

/**
 * 响应式设计断点
 */
export const BREAKPOINTS = {
  /** 移动端 */
  mobile: 640,
  /** 平板 */
  tablet: 768,
  /** 小桌面 */
  desktop: 1024,
  /** 大桌面 */
  wide: 1280,
  /** 超宽屏 */
  ultraWide: 1536
} as const

/**
 * 媒体查询字符串
 */
export const MEDIA_QUERIES = {
  mobile: `(max-width: ${BREAKPOINTS.mobile}px)`,
  tablet: `(max-width: ${BREAKPOINTS.tablet}px)`,
  desktop: `(max-width: ${BREAKPOINTS.desktop}px)`,
  wide: `(max-width: ${BREAKPOINTS.wide}px)`,
  ultraWide: `(max-width: ${BREAKPOINTS.ultraWide}px)`
} as const

/**
 * API 相关常量
 */
export const API = {
  /** 默认请求超时（毫秒） */
  DEFAULT_TIMEOUT: 30000,
  /** 文件上传超时（毫秒） */
  UPLOAD_TIMEOUT: 120000,
  /** 轮询间隔（毫秒） */
  POLL_INTERVAL: 3000,
  /** 最大轮询次数 */
  MAX_POLL_COUNT: 300,
  /** 重试次数 */
  MAX_RETRIES: 3,
  /** 重试延迟（毫秒） */
  RETRY_DELAY: 1000
} as const

/**
 * 文件大小限制
 */
export const FILE_LIMITS = {
  /** 图片最大大小（字节）50MB */
  MAX_IMAGE_SIZE: 50 * 1024 * 1024,
  /** 音频最大大小（字节）500MB */
  MAX_AUDIO_SIZE: 500 * 1024 * 1024,
  /** 视频最大大小（字节）1GB */
  MAX_VIDEO_SIZE: 1024 * 1024 * 1024
} as const

/**
 * localStorage 键名
 */
export const STORAGE_KEYS = {
  IMAGE_SETTINGS: 'image-form-settings',
  AUDIO_SETTINGS: 'audio-form-settings',
  VIDEO_SETTINGS: 'video-form-settings',
  TTS_SETTINGS: 'tts-form-settings',
  MODERATION_SETTINGS: 'moderation-form-settings',
  REALTIME_SETTINGS: 'realtime-form-settings',
  CONFIG: 'config-store',
  HISTORY: 'history-store'
} as const

/**
 * 动画时长
 */
export const ANIMATION = {
  /** 快速过渡 */
  FAST: 150,
  /** 正常过渡 */
  NORMAL: 300,
  /** 慢速过渡 */
  SLOW: 500
} as const

/**
 * 消息显示时长
 */
export const MESSAGE_DURATION = {
  /** 短消息 */
  SHORT: 2000,
  /** 正常消息 */
  NORMAL: 3000,
  /** 长消息 */
  LONG: 5000
} as const

/**
 * 分页配置
 */
export const PAGINATION = {
  /** 默认每页数量 */
  DEFAULT_PAGE_SIZE: 20,
  /** 历史记录最大数量 */
  MAX_HISTORY_ITEMS: 100
} as const
