// Provider preset types
export interface ProviderPreset {
  id: string
  name: string
  baseUrl: string
  apiKey: string
  createdAt: number
}

// Prompt template types
export interface PromptTemplate {
  id: string
  name: string
  type: 'video' | 'image' | 'audio' | 'both'
  prompt: string
  createdAt: number
}

// API Response types
export interface ApiError {
  code?: string
  message: string
}

export interface VideoTask {
  id: string
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'
  progress?: number
  error?: ApiError
}

export interface ImageResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        inlineData?: {
          data: string
          mimeType: string
        }
        text?: string
      }>
    }
  }>
}

// Form types
export interface VideoFormData {
  prompt: string
  model: string
  customModel: string
  seconds: string
  customSeconds: string
  size: string
  customSize: string
  referenceImage: File | null
}

// Base image form data
interface BaseImageFormData {
  prompt: string
  model: string
  customModel: string
}

// Gemini AI Studio format
export interface GeminiAIStudioFormData extends BaseImageFormData {
  format: 'gemini-ai-studio'
  imageSize: string
  aspectRatio: string
  googleSearch: boolean
  temperature: number
  topP: number
  maxOutputTokens: number
  stopSequences: string[]
  referenceImages: File[]
}

// Gemini Vertex format
export interface GeminiVertexFormData extends BaseImageFormData {
  format: 'gemini-vertex'
  imageSize: string
  aspectRatio: string
  outputMimeType: string
  personGeneration: string
  temperature: number
  topP: number
  maxOutputTokens: number
  referenceImages: File[]
}

// GPT Image / DALL-E format
export interface GPTImageFormData extends BaseImageFormData {
  format: 'gpt-image'
  mode: 'generate' | 'edit'
  apiMode?: 'image-api' | 'responses-api'
  responsesModel?: string
  responsesTurnCount?: number
  responsesContinued?: boolean
  editInputSource: 'upload' | 'url'
  size: string
  sizePreset: string
  customSize: string
  quality: string
  background: string
  outputFormat: string
  outputCompression: number
  n: number
  moderation: string
  referenceImages: File[]
  referenceImageUrls: string[]
  maskUrl: string
}

// Flux format
export interface FluxFormData extends BaseImageFormData {
  format: 'flux'
  inputImageUrl: string
  aspectRatio: string
  outputFormat: string
  seed: number | null
  safetyTolerance: number
  promptUpsampling: boolean
}

// Union type for all image form data
export type ImageFormData =
  | GeminiAIStudioFormData
  | GeminiVertexFormData
  | GPTImageFormData
  | FluxFormData

// Legacy image form data for backwards compatibility
export interface LegacyImageFormData {
  prompt: string
  model: string
  customModel: string
  format: 'ai-studio' | 'vertex'
  imageSize: string
  aspectRatio: string
  outputMimeType: string
  personGeneration: string
  temperature: number
  topP: number
  maxOutputTokens: number
  referenceImages: File[]
}

// History types
export interface HistoryItem {
  id: string
  type: 'video' | 'image' | 'audio'
  createdAt: number
  status: 'completed' | 'failed'
  params: VideoFormData | ImageFormData | AudioFormData
  result?: {
    taskId?: string
    blobUrl?: string
    thumbnail?: string
    text?: string
    duration?: number
    language?: string
  }
  error?: string
}

// Model options
export interface ModelOption {
  label: string
  value: string
  nickname?: string
}

export interface SizeOption {
  label: string
  value: string
  models?: string[]
}

export interface AspectRatioOption {
  label: string
  value: string
  icon?: string
}

// Audio transcription types
export interface AudioFormData {
  model: string
  customModel: string
  language: string
  responseFormat: string
  temperature: number
  timestampGranularities: string[]
  prompt: string
}

export interface AudioTranscriptionResponse {
  text: string
  task?: string
  language?: string
  duration?: number
  segments?: AudioSegment[]
  words?: AudioWord[]
}

export interface AudioSegment {
  id: number
  seek: number
  start: number
  end: number
  text: string
  tokens?: number[]
  temperature?: number
  avg_logprob?: number
  compression_ratio?: number
  no_speech_prob?: number
  // Diarization fields
  speaker?: string
}

export interface AudioWord {
  word: string
  start: number
  end: number
}

export interface AudioVerboseResponse extends AudioTranscriptionResponse {
  segments: AudioSegment[]
}

// TTS (Text-to-Speech) types
export interface TTSFormData {
  model: string
  customModel: string
  voice: string
  input: string
  instructions: string
  responseFormat: string
  speed: number
}

export type TTSVoice =
  | 'alloy'
  | 'ash'
  | 'ballad'
  | 'coral'
  | 'echo'
  | 'fable'
  | 'nova'
  | 'onyx'
  | 'sage'
  | 'shimmer'

export type TTSResponseFormat = 'mp3' | 'opus' | 'aac' | 'flac' | 'wav' | 'pcm'

// Moderation types
export interface ModerationFormData {
  model: string
  input: string
  imageUrl: string
  inputMode: 'text' | 'multimodal'
}

export interface ModerationResponse {
  id: string
  model: string
  results: ModerationResult[]
}

export interface ModerationResult {
  flagged: boolean
  categories: Record<string, boolean>
  category_scores: Record<string, number>
  category_applied_input_types?: Record<string, string[]>
}

export type ModerationCategory =
  | 'harassment'
  | 'harassment/threatening'
  | 'hate'
  | 'hate/threatening'
  | 'illicit'
  | 'illicit/violent'
  | 'self-harm'
  | 'self-harm/intent'
  | 'self-harm/instructions'
  | 'sexual'
  | 'sexual/minors'
  | 'violence'
  | 'violence/graphic'

// Realtime API types
export interface RealtimeFormData {
  model: string
  customModel: string
  voice: string
  instructions: string
  temperature: number
  maxTokens: number
  vadEnabled: boolean
  vadThreshold: number
  vadSilenceDuration: number
  language: string
}

export type RealtimeVoice =
  | 'alloy'
  | 'ash'
  | 'ballad'
  | 'coral'
  | 'echo'
  | 'sage'
  | 'shimmer'
  | 'verse'

export interface RealtimeSessionConfig {
  model: string
  voice: RealtimeVoice
  instructions?: string
  input_audio_format: 'pcm16' | 'g711_ulaw' | 'g711_alaw'
  output_audio_format: 'pcm16' | 'g711_ulaw' | 'g711_alaw'
  input_audio_transcription?: {
    model: string
  }
  turn_detection?: {
    type: 'server_vad'
    threshold?: number
    prefix_padding_ms?: number
    silence_duration_ms?: number
  } | null
  tools?: RealtimeTool[]
  tool_choice?: 'auto' | 'none' | 'required'
  temperature?: number
  max_response_output_tokens?: number | 'inf'
}

export interface RealtimeTool {
  type: 'function'
  name: string
  description: string
  parameters: Record<string, unknown>
}

export interface RealtimeServerEvent {
  type: string
  event_id?: string
  [key: string]: unknown
}

export interface RealtimeClientEvent {
  type: string
  event_id?: string
  [key: string]: unknown
}

// Conversation types
export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
}

// Subtitle types (for realtime transcription)
export interface SubtitleItem {
  text: string
  translated?: string
  timestamp: Date
  isFinal: boolean
  isTranslating?: boolean
}

// Common status types
export type TaskStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting'

// Utility types
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>

export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>
