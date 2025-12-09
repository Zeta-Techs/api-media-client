/**
 * 模型配置
 * 集中管理所有 API 模型的配置信息
 */

export interface ModelOption {
  label: string
  value: string
  description?: string
}

export interface SizeOption {
  label: string
  value: string
}

// ==================== 图片生成模型 ====================

/**
 * GPT Image 模型
 */
export const GPT_IMAGE_MODELS: ModelOption[] = [
  { label: 'gpt-image-1', value: 'gpt-image-1', description: 'image.models.gptImage1Desc' },
  { label: 'dall-e-3', value: 'dall-e-3', description: 'image.models.dalle3Desc' },
  { label: 'dall-e-2', value: 'dall-e-2', description: 'image.models.dalle2Desc' }
]

/**
 * GPT Image 尺寸选项
 */
export const GPT_IMAGE_SIZES: Record<string, SizeOption[]> = {
  'gpt-image-1': [
    { label: '1024×1024', value: '1024x1024' },
    { label: '1536×1024 (横向)', value: '1536x1024' },
    { label: '1024×1536 (纵向)', value: '1024x1536' },
    { label: 'Auto', value: 'auto' }
  ],
  'dall-e-3': [
    { label: '1024×1024', value: '1024x1024' },
    { label: '1792×1024 (横向)', value: '1792x1024' },
    { label: '1024×1792 (纵向)', value: '1024x1792' }
  ],
  'dall-e-2': [
    { label: '256×256', value: '256x256' },
    { label: '512×512', value: '512x512' },
    { label: '1024×1024', value: '1024x1024' }
  ]
}

/**
 * GPT Image 质量选项
 */
export const GPT_IMAGE_QUALITIES: ModelOption[] = [
  { label: 'Auto', value: 'auto' },
  { label: 'High', value: 'high' },
  { label: 'Medium', value: 'medium' },
  { label: 'Low', value: 'low' }
]

/**
 * Gemini Image 模型
 */
export const GEMINI_IMAGE_MODELS: ModelOption[] = [
  { label: 'gemini-3-pro-image-preview-flatfee', value: 'gemini-3-pro-image-preview-flatfee' },
  { label: 'gemini-2.5-flash-image', value: 'gemini-2.5-flash-image' },
  { label: 'gemini-2.0-flash-exp-image-generation', value: 'gemini-2.0-flash-exp-image-generation' }
]

/**
 * Flux 模型
 */
export const FLUX_MODELS: ModelOption[] = [
  { label: 'flux-kontext-pro', value: 'flux-kontext-pro' },
  { label: 'flux-kontext-max', value: 'flux-kontext-max' }
]

// ==================== 视频生成模型 ====================

/**
 * Sora 视频模型
 */
export const SORA_MODELS: ModelOption[] = [
  { label: 'sora-2', value: 'sora-2' },
  { label: 'sora-2-pro', value: 'sora-2-pro' }
]

/**
 * Sora 视频尺寸
 */
export const SORA_SIZES: Record<string, SizeOption[]> = {
  'sora-2': [
    { label: 'Portrait: 720×1280', value: '720x1280' },
    { label: 'Landscape: 1280×720', value: '1280x720' }
  ],
  'sora-2-pro': [
    { label: 'Portrait: 720×1280', value: '720x1280' },
    { label: 'Landscape: 1280×720', value: '1280x720' },
    { label: 'Portrait: 1024×1792', value: '1024x1792' },
    { label: 'Landscape: 1792×1024', value: '1792x1024' }
  ]
}

/**
 * 视频时长选项
 */
export const VIDEO_DURATION_OPTIONS: ModelOption[] = [
  { label: '4s', value: '4' },
  { label: '8s', value: '8' },
  { label: '12s', value: '12' }
]

// ==================== 音频模型 ====================

/**
 * 音频转录模型
 */
export const TRANSCRIPTION_MODELS: ModelOption[] = [
  { label: 'whisper-1', value: 'whisper-1', description: 'audio.models.whisper1Desc' },
  { label: 'gpt-4o-transcribe', value: 'gpt-4o-transcribe', description: 'audio.models.gpt4oTranscribeDesc' },
  { label: 'gpt-4o-mini-transcribe', value: 'gpt-4o-mini-transcribe', description: 'audio.models.gpt4oMiniTranscribeDesc' }
]

/**
 * 转录输出格式
 */
export const TRANSCRIPTION_FORMATS: ModelOption[] = [
  { label: 'JSON (详细)', value: 'verbose_json' },
  { label: 'JSON', value: 'json' },
  { label: 'Text', value: 'text' },
  { label: 'SRT', value: 'srt' },
  { label: 'VTT', value: 'vtt' }
]

/**
 * 时间戳粒度选项
 */
export const TIMESTAMP_GRANULARITIES: ModelOption[] = [
  { label: 'Word', value: 'word' },
  { label: 'Segment', value: 'segment' }
]

// ==================== TTS 模型 ====================

/**
 * TTS 模型
 */
export const TTS_MODELS: ModelOption[] = [
  { label: 'gpt-4o-mini-tts', value: 'gpt-4o-mini-tts', description: 'tts.models.gpt4oMiniTtsDesc' },
  { label: 'tts-1', value: 'tts-1', description: 'tts.models.tts1Desc' },
  { label: 'tts-1-hd', value: 'tts-1-hd', description: 'tts.models.tts1HdDesc' }
]

/**
 * TTS 语音选项
 */
export const TTS_VOICES: ModelOption[] = [
  { label: 'Alloy', value: 'alloy' },
  { label: 'Ash', value: 'ash' },
  { label: 'Ballad', value: 'ballad' },
  { label: 'Coral', value: 'coral' },
  { label: 'Echo', value: 'echo' },
  { label: 'Fable', value: 'fable' },
  { label: 'Nova', value: 'nova' },
  { label: 'Onyx', value: 'onyx' },
  { label: 'Sage', value: 'sage' },
  { label: 'Shimmer', value: 'shimmer' }
]

/**
 * TTS 输出格式
 */
export const TTS_FORMATS: ModelOption[] = [
  { label: 'MP3', value: 'mp3' },
  { label: 'Opus', value: 'opus' },
  { label: 'AAC', value: 'aac' },
  { label: 'FLAC', value: 'flac' },
  { label: 'WAV', value: 'wav' },
  { label: 'PCM', value: 'pcm' }
]

// ==================== 内容审核模型 ====================

/**
 * 内容审核模型
 */
export const MODERATION_MODELS: ModelOption[] = [
  { label: 'omni-moderation-latest', value: 'omni-moderation-latest', description: 'moderation.models.omniDesc' },
  { label: 'text-moderation-latest (Legacy)', value: 'text-moderation-latest', description: 'moderation.models.textDesc' }
]

// ==================== 实时模型 ====================

/**
 * 实时对话模型
 */
export const REALTIME_MODELS: ModelOption[] = [
  { label: 'gpt-realtime (Latest)', value: 'gpt-realtime', description: 'realtime.models.gptRealtimeDesc' },
  { label: 'gpt-realtime-mini', value: 'gpt-realtime-mini', description: 'realtime.models.gptRealtimeMiniDesc' },
  { label: 'gpt-4o-realtime-preview', value: 'gpt-4o-realtime-preview', description: 'realtime.models.gpt4oRealtimeDesc' },
  { label: 'gpt-4o-mini-realtime-preview', value: 'gpt-4o-mini-realtime-preview', description: 'realtime.models.gpt4oMiniRealtimeDesc' }
]

/**
 * 实时语音选项
 */
export const REALTIME_VOICES: ModelOption[] = [
  { label: 'Alloy', value: 'alloy' },
  { label: 'Ash', value: 'ash' },
  { label: 'Ballad', value: 'ballad' },
  { label: 'Coral', value: 'coral' },
  { label: 'Echo', value: 'echo' },
  { label: 'Sage', value: 'sage' },
  { label: 'Shimmer', value: 'shimmer' },
  { label: 'Verse', value: 'verse' }
]

// ==================== 语言选项 ====================

/**
 * 支持的语言
 */
export const SUPPORTED_LANGUAGES: ModelOption[] = [
  { label: 'Auto', value: 'auto' },
  { label: '简体中文 (Simplified)', value: 'zh-CN' },
  { label: '繁體中文 (Traditional)', value: 'zh-TW' },
  { label: 'English', value: 'en' },
  { label: '日本語', value: 'ja' },
  { label: '한국어', value: 'ko' },
  { label: 'Français', value: 'fr' },
  { label: 'Deutsch', value: 'de' },
  { label: 'Español', value: 'es' },
  { label: 'Italiano', value: 'it' },
  { label: 'Português', value: 'pt' },
  { label: 'Русский', value: 'ru' }
]

// ==================== 工具函数 ====================

/**
 * 获取自定义选项
 */
export function getCustomOption(t: (key: string) => string): ModelOption {
  return { label: t('common.custom'), value: 'custom' }
}

/**
 * 为模型列表添加自定义选项
 */
export function withCustomOption(models: ModelOption[], t: (key: string) => string): ModelOption[] {
  return [...models, getCustomOption(t)]
}
