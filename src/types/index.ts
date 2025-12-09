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
  size: string
  quality: string
  background: string
  outputFormat: string
  outputCompression: number
  n: number
  moderation: string
  referenceImages: File[]
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
