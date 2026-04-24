<script setup lang="ts">
import { ref, computed, watch, onUnmounted, onMounted, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import {
  NCard, NForm, NFormItem, NInput, NSelect, NButton, NSpace,
  NInputNumber, NUpload, NAlert, NSpin, NTabs, NTabPane,
  NRadioGroup, NRadio, NSlider, NModal, NTag, NTooltip, NSwitch,
  type UploadFileInfo
} from 'naive-ui'
import { useConfigStore } from '@/stores/config'
import { useHistoryStore } from '@/stores/history'
import { message } from '@/composables/useNaiveMessage'
import { parseApiError } from '@/utils/api'
import type {
  GPTImageFormData,
  FluxFormData,
  GeminiAIStudioFormData,
  GeminiVertexFormData,
  HistoryItem
} from '@/types'
import { BatchModeSwitch, BatchImagePanel } from '@/components/batch'

const { t } = useI18n()
const router = useRouter()
const configStore = useConfigStore()
const historyStore = useHistoryStore()

// Navigate to settings page
function goToSettings() {
  router.push('/settings')
}

// Batch mode toggle
const isBatchMode = ref(false)

// Main tab: GPT-Image, Nano Banana (Gemini), Flux
const mainTab = ref<'nano-banana' | 'gpt-image' | 'flux'>('gpt-image')
// Sub-tab for Nano Banana (Gemini-Image)
const geminiSubTab = ref<'ai-studio' | 'vertex'>('ai-studio')

// Local storage keys
const DALLE_SETTINGS_KEY = 'dalle-form-settings'
const FLUX_SETTINGS_KEY = 'flux-form-settings'

type GPTEditInputSource = 'upload' | 'url' | 'file-id'
type GPTApiMode = 'image-api' | 'responses-api'

interface GPTModelCapabilities {
  description: string
  supportsEdit: boolean
  supportsQuality: boolean
  supportsBackground: boolean
  supportsTransparentBackground: boolean
  supportsCompression: boolean
  supportsModeration: boolean
  supportsMultiple: boolean
  supportsOutputFormat: boolean
  supportsFlexibleSize: boolean
  defaultSize: string
}

interface GPTCustomSizeDimensions {
  width: number
  height: number
}

interface GPTMaskCanvasDimensions {
  width: number
  height: number
}

interface GPTMaskPoint {
  x: number
  y: number
}

type GPTMaskTool = 'brush' | 'eraser' | 'pan'

interface GPTImageResponseItem {
  b64_json?: string
  url?: string
  revised_prompt?: string
  output_format?: string
}

interface GPTResponsesImageGenerationCall {
  type: string
  id?: string
  result?: string | string[]
  revised_prompt?: string
  output_format?: string
}

interface GPTResponsesInputImage {
  type: 'input_image'
  image_url?: string
  file_id?: string
  input_image_mask?: {
    image_url?: string
    file_id?: string
  }
}

interface GPTResponsesOutputTextItem {
  type?: string
  text?: string
  output_text?: string
  refusal?: string
  content?: Array<{
    type?: string
    text?: string
    output_text?: string
    refusal?: string
  }>
}

const GPT_IMAGE_2_MIN_PIXELS = 655360
const GPT_IMAGE_2_MAX_PIXELS = 8294400
const GPT_IMAGE_2_MAX_EDGE = 3840
const GPT_IMAGE_2_STEP = 16
const GPT_IMAGE_2_MAX_RATIO = 3
const GPT_RESPONSES_MODEL = 'gpt-5.4'
const GPT_MASK_HISTORY_LIMIT = 40
const GPT_MASK_MIN_ZOOM = 0.08
const GPT_MASK_MAX_ZOOM = 8
const GPT_RESPONSES_POLL_INTERVAL = 2000
const GPT_RESPONSES_STREAM_PARTIAL_IMAGES = 0

const GPT_IMAGE_2_SIZE_OPTIONS: Array<{ label: string; value: string }> = [
  { label: 'auto', value: 'auto' },
  { label: '1024x1024 (Square)', value: '1024x1024' },
  { label: '1536x1024 (Landscape)', value: '1536x1024' },
  { label: '1024x1536 (Portrait)', value: '1024x1536' },
  { label: '2048x2048 (2K Square)', value: '2048x2048' },
  { label: '2048x1152 (2K Landscape)', value: '2048x1152' },
  { label: '3840x2160 (4K Landscape)', value: '3840x2160' },
  { label: '2160x3840 (4K Portrait)', value: '2160x3840' }
] as const

const GPT_LEGACY_SIZE_OPTIONS: Record<string, Array<{ label: string; value: string }>> = {
  'gpt-image-1': [
    { label: '1024x1024 (Square)', value: '1024x1024' },
    { label: '1536x1024 (Landscape)', value: '1536x1024' },
    { label: '1024x1536 (Portrait)', value: '1024x1536' },
    { label: 'auto', value: 'auto' }
  ],
  'dall-e-3': [
    { label: '1024x1024', value: '1024x1024' },
    { label: '1792x1024 (Landscape)', value: '1792x1024' },
    { label: '1024x1792 (Portrait)', value: '1024x1792' }
  ],
  'dall-e-2': [
    { label: '1024x1024', value: '1024x1024' },
    { label: '512x512', value: '512x512' },
    { label: '256x256', value: '256x256' }
  ]
}

const GPT_MODEL_CAPABILITIES: Record<string, GPTModelCapabilities> = {
  'gpt-image-2': {
    description: 'dalle.models.gptImage2Desc',
    supportsEdit: true,
    supportsQuality: true,
    supportsBackground: true,
    supportsTransparentBackground: false,
    supportsCompression: true,
    supportsModeration: true,
    supportsMultiple: true,
    supportsOutputFormat: true,
    supportsFlexibleSize: true,
    defaultSize: 'auto'
  },
  'gpt-image-1': {
    description: 'dalle.models.gptImage1Desc',
    supportsEdit: true,
    supportsQuality: true,
    supportsBackground: true,
    supportsTransparentBackground: true,
    supportsCompression: true,
    supportsModeration: true,
    supportsMultiple: true,
    supportsOutputFormat: true,
    supportsFlexibleSize: false,
    defaultSize: '1024x1024'
  },
  'dall-e-3': {
    description: 'dalle.models.dalle3Desc',
    supportsEdit: false,
    supportsQuality: true,
    supportsBackground: false,
    supportsTransparentBackground: false,
    supportsCompression: false,
    supportsModeration: false,
    supportsMultiple: false,
    supportsOutputFormat: false,
    supportsFlexibleSize: false,
    defaultSize: '1024x1024'
  },
  'dall-e-2': {
    description: 'dalle.models.dalle2Desc',
    supportsEdit: true,
    supportsQuality: false,
    supportsBackground: false,
    supportsTransparentBackground: false,
    supportsCompression: false,
    supportsModeration: false,
    supportsMultiple: true,
    supportsOutputFormat: false,
    supportsFlexibleSize: false,
    defaultSize: '1024x1024'
  },
  custom: {
    description: 'dalle.models.customDesc',
    supportsEdit: true,
    supportsQuality: true,
    supportsBackground: true,
    supportsTransparentBackground: false,
    supportsCompression: true,
    supportsModeration: true,
    supportsMultiple: true,
    supportsOutputFormat: true,
    supportsFlexibleSize: true,
    defaultSize: 'auto'
  }
}

const GPT_RESPONSES_CAPABILITIES: GPTModelCapabilities = {
  description: 'dalle.responses.modelDescription',
  supportsEdit: true,
  supportsQuality: true,
  supportsBackground: true,
  supportsTransparentBackground: false,
  supportsCompression: true,
  supportsModeration: false,
  supportsMultiple: false,
  supportsOutputFormat: true,
  supportsFlexibleSize: true,
  defaultSize: 'auto'
}

// ==================== GPT-Image (DALL·E) Form State ====================
const formGPT = ref({
  prompt: '',
  model: 'gpt-image-2',
  customModel: '',
  size: 'auto',
  customSize: '',
  quality: 'auto',
  background: 'auto',
  outputFormat: 'png',
  outputCompression: 100,
  n: 1,
  moderation: 'auto'
})

const gptMode = ref<'generate' | 'edit'>('generate')
const gptApiMode = ref<GPTApiMode>('image-api')
const gptEditInputSource = ref<GPTEditInputSource>('upload')
const gptReferenceImages = ref<File[]>([])
const gptReferenceImageUrls = ref<string[]>([])
const gptReferenceImageFileIds = ref<string[]>([])
const gptMaskImage = ref<File | null>(null)
const gptUploadedMaskImage = ref<File | null>(null)
const gptMaskUrl = ref('')
const gptMaskFileId = ref('')
const gptImageUrls = ref<string[]>([])
const gptRevisedPrompt = ref('')
const responsesConversationActive = ref(false)
const responsesPreviousResponseId = ref<string | null>(null)
const responsesTurnCount = ref(0)
const responsesLastResponseId = ref<string | null>(null)
const responsesLastImageGenerationCallId = ref<string | null>(null)
const isHydratingGPTSettings = ref(false)

const gptMaskViewportRef = ref<HTMLDivElement | null>(null)
const gptMaskBaseCanvas = ref<HTMLCanvasElement | null>(null)
const gptMaskDrawingCanvas = ref<HTMLCanvasElement | null>(null)
const gptMaskReferenceObjectUrl = ref('')
const gptMaskImageDimensions = ref<GPTMaskCanvasDimensions | null>(null)
const gptMaskTool = ref<GPTMaskTool>('brush')
const gptMaskBrushSize = ref(80)
const gptMaskZoom = ref(1)
const gptMaskPan = ref<GPTMaskPoint>({ x: 0, y: 0 })
const gptMaskHasDrawing = ref(false)
const gptMaskUploadKey = ref(0)
const gptMaskUndoStack = ref<ImageData[]>([])
const gptMaskRedoStack = ref<ImageData[]>([])
const gptMaskActivePointerId = ref<number | null>(null)
const gptMaskLastPoint = ref<GPTMaskPoint | null>(null)
const gptMaskLastPanClient = ref<GPTMaskPoint | null>(null)
const isGPTMaskDrawing = ref(false)
const isGPTMaskPanning = ref(false)

// ==================== Gemini-Image Form States ====================
// Form state - AI Studio
const formAI = ref({
  prompt: '',
  model: 'gemini-3-pro-image-preview',
  customModel: '',
  imageSize: '1K',
  aspectRatio: 'auto',
  googleSearch: true,
  temperature: 1,
  topP: 0.95,
  maxOutputTokens: 32768,
  stopSequences: ''
})

// Form state - Vertex
const formVertex = ref({
  prompt: '',
  model: 'gemini-3-pro-image-preview',
  customModel: '',
  imageSize: '1K',
  aspectRatio: 'auto',
  outputMimeType: 'image/png',
  personGeneration: 'ALLOW_ALL',
  temperature: 1,
  topP: 0.95,
  maxOutputTokens: 32768
})

// Common state
const nanoReferenceImages = ref<File[]>([])

// ==================== Flux Form State ====================
const formFlux = ref({
  prompt: '',
  model: 'flux-kontext-pro',
  customModel: '',
  inputImageUrl: '',
  aspectRatio: '1:1',
  outputFormat: 'png',
  seed: null as number | null,
  safetyTolerance: 2,
  promptUpsampling: false
})

const fluxInputImage = ref<File | null>(null)
const fluxImageUrl = ref('')
const fluxImageInfo = ref<{ width: number; height: number; size: string; type: string } | null>(null)

// Task state
const isLoading = ref(false)
const abortController = ref<AbortController | null>(null)
const errorMessage = ref('')
const imageUrl = ref('')
const imageInfo = ref<{ width: number; height: number; size: string; type: string } | null>(null)

// Lightbox state
const showLightbox = ref(false)
const lightboxIndex = ref(0)

// Provider preset options
const presetOptions = computed(() =>
  configStore.providerPresets.map(p => ({
    label: p.name,
    value: p.id
  }))
)

// Prompt template options
const templateOptions = computed(() => [
  { label: t('settings.noTemplates'), value: '' },
  ...configStore.imageTemplates.map(t => ({
    label: t.name,
    value: t.id
  }))
])

const selectedTemplate = ref('')

// Apply template when selected
watch(selectedTemplate, (id) => {
  if (id) {
    const template = configStore.promptTemplates.find(t => t.id === id)
    if (template) {
      formAI.value.prompt = template.prompt
      formVertex.value.prompt = template.prompt
      formGPT.value.prompt = template.prompt
    }
  }
})

// ==================== GPT-Image Options ====================
const gptModelOptions = [
  {
    label: 'gpt-image-2 (GPT Image 2)',
    value: 'gpt-image-2',
    description: 'dalle.models.gptImage2Desc'
  },
  {
    label: 'gpt-image-1 (GPT Image)',
    value: 'gpt-image-1',
    description: 'dalle.models.gptImage1Desc'
  },
  {
    label: 'dall-e-3',
    value: 'dall-e-3',
    description: 'dalle.models.dalle3Desc'
  },
  {
    label: 'dall-e-2',
    value: 'dall-e-2',
    description: 'dalle.models.dalle2Desc'
  },
  { label: t('common.custom'), value: 'custom' }
]

const isGPTCustomModel = computed(() => formGPT.value.model === 'custom')
const actualGPTModel = computed(() =>
  isGPTCustomModel.value ? formGPT.value.customModel.trim() : formGPT.value.model
)
const isGPTResponsesMode = computed(() =>
  mainTab.value === 'gpt-image' &&
  gptApiMode.value === 'responses-api'
)
const isGPTResponsesEditMode = computed(() =>
  isGPTResponsesMode.value && gptMode.value === 'edit'
)
const isContinuingGPTResponsesConversation = computed(() =>
  isGPTResponsesMode.value &&
  responsesConversationActive.value &&
  Boolean(responsesPreviousResponseId.value)
)

const currentGPTCapabilities = computed(() =>
  GPT_MODEL_CAPABILITIES[formGPT.value.model] || GPT_MODEL_CAPABILITIES['gpt-image-2']
)
const currentGPTRequestCapabilities = computed(() =>
  isGPTResponsesMode.value ? GPT_RESPONSES_CAPABILITIES : currentGPTCapabilities.value
)

const gptSizeOptions = computed(() => {
  const options = currentGPTRequestCapabilities.value.supportsFlexibleSize
    ? [...GPT_IMAGE_2_SIZE_OPTIONS]
    : [...(GPT_LEGACY_SIZE_OPTIONS[formGPT.value.model] || GPT_LEGACY_SIZE_OPTIONS['gpt-image-1'])]

  if (currentGPTRequestCapabilities.value.supportsFlexibleSize) {
    options.push({
      label: t('dalle.customSizeOption'),
      value: 'custom'
    })
  }

  return options
})

const gptQualityOptions = computed(() => [
  { label: t('dalle.qualityOptions.auto'), value: 'auto' },
  { label: t('dalle.qualityOptions.low'), value: 'low' },
  { label: t('dalle.qualityOptions.medium'), value: 'medium' },
  { label: t('dalle.qualityOptions.high'), value: 'high' }
])

const gptBackgroundOptions = computed(() => {
  const options = [{ label: t('dalle.backgroundOptions.auto'), value: 'auto' }]
  if (currentGPTRequestCapabilities.value.supportsTransparentBackground) {
    options.push({ label: t('dalle.backgroundOptions.transparent'), value: 'transparent' })
  }
  if (currentGPTRequestCapabilities.value.supportsBackground) {
    options.push({ label: t('dalle.backgroundOptions.opaque'), value: 'opaque' })
  }
  return options
})

const gptOutputFormatOptions = [
  { label: 'PNG', value: 'png' },
  { label: 'JPEG', value: 'jpeg' },
  { label: 'WebP', value: 'webp' }
]

const gptModerationOptions = computed(() => [
  { label: t('dalle.moderationOptions.auto'), value: 'auto' },
  { label: t('dalle.moderationOptions.low'), value: 'low' }
])

const currentGPTModelInfo = computed(() => {
  return gptModelOptions.find(m => m.value === formGPT.value.model)
})
const gptResponsesModelLabel = computed(() => t('dalle.responses.modelLabel'))
const currentGPTImageApiModelLabel = computed(() => {
  if (isGPTCustomModel.value) {
    return formGPT.value.customModel.trim() || t('common.custom')
  }

  return actualGPTModel.value || 'gpt-image-2'
})
const currentGPTGenerateModelLabel = computed(() =>
  isGPTResponsesMode.value ? GPT_RESPONSES_MODEL : currentGPTImageApiModelLabel.value
)
const currentGPTGenerationRouteLabel = computed(() =>
  isGPTResponsesMode.value
    ? t('dalle.modelCards.gpt54.title')
    : t('dalle.modelCards.gptImage2.title')
)
const currentGPTGenerationRouteDescription = computed(() =>
  isGPTResponsesMode.value
    ? t('dalle.modelCards.gpt54.description')
    : t('dalle.modelCards.gptImage2.description')
)
const isZetaEndpoint = computed(() => {
  const baseUrl = configStore.baseUrl?.trim()
  if (!baseUrl) return false

  try {
    return new URL(baseUrl).hostname.toLowerCase().includes('zeta')
  } catch {
    return baseUrl.toLowerCase().includes('zeta')
  }
})
const shouldShowGPT54ZetaTokenWarning = computed(() =>
  isGPTResponsesMode.value && isZetaEndpoint.value
)
const gptGenerationRouteCards = computed(() => [
  {
    key: 'image-api' as const,
    title: t('dalle.modelCards.gptImage2.title'),
    description: t('dalle.modelCards.gptImage2.description'),
    active: gptApiMode.value === 'image-api'
  },
  {
    key: 'responses-api' as const,
    title: t('dalle.modelCards.gpt54.title'),
    description: t('dalle.modelCards.gpt54.description'),
    active: gptApiMode.value === 'responses-api'
  }
])
const gptModelDescriptionKey = computed(() =>
  isGPTResponsesMode.value
    ? GPT_RESPONSES_CAPABILITIES.description
    : currentGPTModelInfo.value?.description
)

const supportsQuality = computed(() => currentGPTRequestCapabilities.value.supportsQuality)
const supportsBackground = computed(() => currentGPTRequestCapabilities.value.supportsBackground)
const supportsOutputFormat = computed(() => currentGPTRequestCapabilities.value.supportsOutputFormat)
const supportsCompression = computed(() =>
  currentGPTRequestCapabilities.value.supportsCompression &&
  (formGPT.value.outputFormat === 'jpeg' || formGPT.value.outputFormat === 'webp')
)
const supportsMultiple = computed(() => currentGPTRequestCapabilities.value.supportsMultiple)
const supportsEdit = computed(() =>
  isGPTResponsesMode.value ? GPT_RESPONSES_CAPABILITIES.supportsEdit : currentGPTCapabilities.value.supportsEdit
)
const supportsFlexibleGPTSize = computed(() => currentGPTRequestCapabilities.value.supportsFlexibleSize)
const supportsModeration = computed(() => currentGPTRequestCapabilities.value.supportsModeration)
const showGPTCustomSizeInput = computed(() =>
  supportsFlexibleGPTSize.value && formGPT.value.size === 'custom'
)
const resolvedGPTSize = computed(() =>
  formGPT.value.size === 'custom' ? formGPT.value.customSize.trim() : formGPT.value.size
)
const parsedGPTCustomSize = computed<GPTCustomSizeDimensions | null>(() =>
  parseGPTCustomSize(formGPT.value.customSize)
)
const gptCustomSizeWidth = computed<number | null>({
  get: () => parsedGPTCustomSize.value?.width ?? null,
  set: (value) => {
    updateGPTCustomSizeDimensions(value, parsedGPTCustomSize.value?.height ?? null)
  }
})
const gptCustomSizeHeight = computed<number | null>({
  get: () => parsedGPTCustomSize.value?.height ?? null,
  set: (value) => {
    updateGPTCustomSizeDimensions(parsedGPTCustomSize.value?.width ?? null, value)
  }
})
const gptCustomSizePixels = computed(() =>
  parsedGPTCustomSize.value ? parsedGPTCustomSize.value.width * parsedGPTCustomSize.value.height : null
)
const gptCustomSizeRatio = computed(() => {
  if (!parsedGPTCustomSize.value) return null
  const { width, height } = parsedGPTCustomSize.value
  return Math.max(width, height) / Math.min(width, height)
})
const gptCustomSizeConstraintItems = computed(() => {
  const dims = parsedGPTCustomSize.value
  const pixels = gptCustomSizePixels.value
  const ratio = gptCustomSizeRatio.value

  return [
    {
      key: 'multiple',
      label: t('dalle.customSizeConstraints.multipleOf16'),
      value: dims ? `${dims.width} × ${dims.height}` : '—',
      passed: Boolean(dims && dims.width % GPT_IMAGE_2_STEP === 0 && dims.height % GPT_IMAGE_2_STEP === 0)
    },
    {
      key: 'edge',
      label: t('dalle.customSizeConstraints.maxEdge'),
      value: dims ? `${Math.max(dims.width, dims.height)} / ${GPT_IMAGE_2_MAX_EDGE}px` : '—',
      passed: Boolean(dims && Math.max(dims.width, dims.height) <= GPT_IMAGE_2_MAX_EDGE)
    },
    {
      key: 'ratio',
      label: t('dalle.customSizeConstraints.aspectRatio'),
      value: ratio ? `${ratio.toFixed(2)} : 1` : '—',
      passed: Boolean(ratio && ratio <= GPT_IMAGE_2_MAX_RATIO)
    },
    {
      key: 'pixels',
      label: t('dalle.customSizeConstraints.pixelRange'),
      value: pixels ? `${pixels.toLocaleString()}` : '—',
      passed: Boolean(
        pixels &&
        pixels >= GPT_IMAGE_2_MIN_PIXELS &&
        pixels <= GPT_IMAGE_2_MAX_PIXELS
      )
    }
  ]
})
const gptCustomSizePreviewStyle = computed(() => {
  const dims = parsedGPTCustomSize.value
  if (!dims) return {}

  const isLandscape = dims.width >= dims.height
  return {
    aspectRatio: `${dims.width} / ${dims.height}`,
    width: isLandscape ? '100%' : 'auto',
    height: isLandscape ? 'auto' : '100%'
  }
})
const gptReferenceImageUrlsText = computed({
  get: () => gptReferenceImageUrls.value.join('\n'),
  set: (value: string) => {
    gptReferenceImageUrls.value = value
      .split(/\r?\n/)
      .map(item => item.trim())
      .filter(Boolean)
      .slice(0, 10)
  }
})
const gptReferenceImageFileIdsText = computed({
  get: () => gptReferenceImageFileIds.value.join('\n'),
  set: (value: string) => {
    gptReferenceImageFileIds.value = value
      .split(/\r?\n/)
      .map(item => item.trim())
      .filter(Boolean)
      .slice(0, 10)
  }
})

const gptResponsesConversationStatusLabel = computed(() =>
  responsesConversationActive.value
    ? t('dalle.responses.status.continuing')
    : t('dalle.responses.status.new')
)
const gptResponsesConversationHint = computed(() =>
  responsesConversationActive.value
    ? t(gptMode.value === 'edit' ? 'dalle.responses.continuationHintEdit' : 'dalle.responses.continuationHint')
    : t(gptMode.value === 'edit' ? 'dalle.responses.modeHintEdit' : 'dalle.responses.modeHint')
)
const gptResponsesTurnLabel = computed(() =>
  t('dalle.responses.currentTurn', { count: responsesTurnCount.value })
)
const gptCurrentModelHint = computed(() =>
  t('dalle.currentModelValue', { model: currentGPTGenerateModelLabel.value })
)

const gptPrimaryReferenceImage = computed(() => gptReferenceImages.value[0] ?? null)

const showGPTMaskEditor = computed(() =>
  gptMode.value === 'edit' &&
  gptEditInputSource.value === 'upload' &&
  Boolean(gptPrimaryReferenceImage.value)
)

const gptMaskCanUndo = computed(() => gptMaskUndoStack.value.length > 0)
const gptMaskCanRedo = computed(() => gptMaskRedoStack.value.length > 0)
const gptMaskZoomLabel = computed(() => `${Math.round(gptMaskZoom.value * 100)}%`)

const gptMaskCanvasStackStyle = computed(() => {
  const dimensions = gptMaskImageDimensions.value
  if (!dimensions) return {}

  return {
    width: `${dimensions.width}px`,
    height: `${dimensions.height}px`,
    transform: `translate(-50%, -50%) translate(${gptMaskPan.value.x}px, ${gptMaskPan.value.y}px) scale(${gptMaskZoom.value})`
  }
})

function getMimeTypeFromOutputFormat(outputFormat: string): string {
  if (outputFormat === 'jpeg') return 'image/jpeg'
  if (outputFormat === 'webp') return 'image/webp'
  return 'image/png'
}

function parseGPTCustomSize(size: string): GPTCustomSizeDimensions | null {
  const match = size.trim().match(/^(\d+)x(\d+)$/i)
  if (!match) return null

  return {
    width: Number(match[1]),
    height: Number(match[2])
  }
}

function updateGPTCustomSizeDimensions(width: number | null, height: number | null) {
  if (!width || !height) {
    formGPT.value.customSize = ''
    return
  }

  formGPT.value.customSize = `${Math.round(width)}x${Math.round(height)}`
}

function getGPTImage2SizeValidationErrorFromDimensions(
  dimensions: GPTCustomSizeDimensions
): string | null {
  const { width, height } = dimensions

  if (width % GPT_IMAGE_2_STEP !== 0 || height % GPT_IMAGE_2_STEP !== 0) {
    return t('dalle.customSizeMultipleOf16')
  }

  if (Math.max(width, height) > GPT_IMAGE_2_MAX_EDGE) {
    return t('dalle.customSizeMaxEdge')
  }

  const ratio = Math.max(width, height) / Math.min(width, height)
  if (ratio > GPT_IMAGE_2_MAX_RATIO) {
    return t('dalle.customSizeAspectRatio')
  }

  const totalPixels = width * height
  if (totalPixels < GPT_IMAGE_2_MIN_PIXELS || totalPixels > GPT_IMAGE_2_MAX_PIXELS) {
    return t('dalle.customSizePixelRange')
  }

  return null
}

function alignGPTCustomSizeToStep(value: number): number {
  return Math.max(GPT_IMAGE_2_STEP, Math.round(value / GPT_IMAGE_2_STEP) * GPT_IMAGE_2_STEP)
}

function snapGPTCustomSizeToStep() {
  if (!parsedGPTCustomSize.value) return

  updateGPTCustomSizeDimensions(
    alignGPTCustomSizeToStep(parsedGPTCustomSize.value.width),
    alignGPTCustomSizeToStep(parsedGPTCustomSize.value.height)
  )
}

function swapGPTCustomSizeDimensions() {
  if (!parsedGPTCustomSize.value) return

  updateGPTCustomSizeDimensions(
    parsedGPTCustomSize.value.height,
    parsedGPTCustomSize.value.width
  )
}

function handleGPTCustomSizeWheel(
  dimension: keyof GPTCustomSizeDimensions,
  event: WheelEvent
) {
  const currentDimensions = parsedGPTCustomSize.value
  if (!currentDimensions) return

  const stepDirection = event.deltaY < 0 ? 1 : event.deltaY > 0 ? -1 : 0
  if (stepDirection === 0) return

  const nextValue = currentDimensions[dimension] + stepDirection * GPT_IMAGE_2_STEP
  if (nextValue < GPT_IMAGE_2_STEP) return

  const nextDimensions: GPTCustomSizeDimensions = {
    ...currentDimensions,
    [dimension]: nextValue
  }

  if (getGPTImage2SizeValidationErrorFromDimensions(nextDimensions) !== null) {
    return
  }

  updateGPTCustomSizeDimensions(nextDimensions.width, nextDimensions.height)
}

function isPresetGPTSize(size: string): boolean {
  return GPT_IMAGE_2_SIZE_OPTIONS.some(option => option.value === size)
}

function normalizeGPTSizeForModel(model: string) {
  const capabilities = GPT_MODEL_CAPABILITIES[model] || GPT_MODEL_CAPABILITIES['gpt-image-2']

  if (capabilities.supportsFlexibleSize) {
    if (formGPT.value.size === 'custom') {
      return
    }

    if (!isPresetGPTSize(formGPT.value.size) && formGPT.value.size !== 'auto') {
      formGPT.value.customSize = formGPT.value.size
      formGPT.value.size = 'custom'
      return
    }

    if (!isPresetGPTSize(formGPT.value.size) && formGPT.value.size !== 'custom') {
      formGPT.value.size = capabilities.defaultSize
    }

    return
  }

  const options = GPT_LEGACY_SIZE_OPTIONS[model] || GPT_LEGACY_SIZE_OPTIONS['gpt-image-1']
  if (!options.find(option => option.value === formGPT.value.size)) {
    formGPT.value.size = capabilities.defaultSize
  }
}

function validateGPTImage2Size(size: string): string | null {
  if (!size) return t('dalle.customSizeRequired')

  const dims = parseGPTCustomSize(size)
  if (!dims) return t('dalle.customSizeFormatHint')

  return getGPTImage2SizeValidationErrorFromDimensions(dims)
}

function normalizeGPTSizeForResponsesApi() {
  if (formGPT.value.size === 'custom') {
    if (formGPT.value.customSize && validateGPTImage2Size(formGPT.value.customSize) === null) {
      return
    }

    formGPT.value.size = GPT_RESPONSES_CAPABILITIES.defaultSize
    formGPT.value.customSize = ''
    return
  }

  if (formGPT.value.size === 'auto' || isPresetGPTSize(formGPT.value.size)) {
    return
  }

  if (validateGPTImage2Size(formGPT.value.size) === null) {
    formGPT.value.customSize = formGPT.value.size
    formGPT.value.size = 'custom'
    return
  }

  formGPT.value.size = GPT_RESPONSES_CAPABILITIES.defaultSize
  formGPT.value.customSize = ''
}

function resetGPTResponsesConversation(options: { silent?: boolean } = {}) {
  const hadConversation =
    responsesConversationActive.value ||
    responsesTurnCount.value > 0 ||
    Boolean(responsesPreviousResponseId.value) ||
    Boolean(responsesLastResponseId.value) ||
    Boolean(responsesLastImageGenerationCallId.value)

  responsesConversationActive.value = false
  responsesPreviousResponseId.value = null
  responsesTurnCount.value = 0
  responsesLastResponseId.value = null
  responsesLastImageGenerationCallId.value = null

  if (hadConversation && !options.silent) {
    message.info(t('dalle.responses.reset'))
  }
}

function validateGPTRequest(): string | null {
  if (gptMode.value === 'edit') {
    if (gptEditInputSource.value === 'upload' && gptReferenceImages.value.length === 0) {
      return t('dalle.referenceImagesRequired')
    }

    if (gptEditInputSource.value === 'url' && gptReferenceImageUrls.value.length === 0) {
      return t('dalle.referenceImageUrlsRequired')
    }

    if (gptEditInputSource.value === 'file-id' && gptReferenceImageFileIds.value.length === 0) {
      return t('dalle.referenceImageFileIdsRequired')
    }
  }

  if (supportsFlexibleGPTSize.value && resolvedGPTSize.value !== 'auto') {
    return validateGPTImage2Size(resolvedGPTSize.value)
  }

  return null
}

function appendGPTImageOptions(
  target: Record<string, any> | FormData,
  options: { includeMultiple?: boolean } = {}
) {
  const setValue = (key: string, value: string | number) => {
    if (target instanceof FormData) {
      target.set(key, String(value))
    } else {
      target[key] = value
    }
  }

  if (options.includeMultiple && supportsMultiple.value && formGPT.value.n > 1) {
    setValue('n', formGPT.value.n)
  }

  if (resolvedGPTSize.value !== 'auto') {
    setValue('size', resolvedGPTSize.value)
  }

  if (supportsQuality.value && formGPT.value.quality !== 'auto') {
    setValue('quality', formGPT.value.quality)
  }

  if (supportsBackground.value && formGPT.value.background !== 'auto') {
    setValue('background', formGPT.value.background)
  }

  if (
    supportsOutputFormat.value &&
    (formGPT.value.outputFormat === 'jpeg' || formGPT.value.outputFormat === 'webp')
  ) {
    setValue('output_format', formGPT.value.outputFormat)
    if (supportsCompression.value) {
      setValue('output_compression', formGPT.value.outputCompression)
    }
  }

  if (supportsModeration.value && formGPT.value.moderation !== 'auto') {
    setValue('moderation', formGPT.value.moderation)
  }
}

function appendGPTResponsesToolOptions(tool: Record<string, any>) {
  if (resolvedGPTSize.value !== 'auto') {
    tool.size = resolvedGPTSize.value
  }

  if (formGPT.value.quality !== 'auto') {
    tool.quality = formGPT.value.quality
  }

  if (formGPT.value.background === 'opaque') {
    tool.background = 'opaque'
  }

  if (formGPT.value.outputFormat === 'jpeg' || formGPT.value.outputFormat === 'webp') {
    tool.output_format = formGPT.value.outputFormat
    tool.output_compression = formGPT.value.outputCompression
  }
}

async function buildGPTResponsesEditInputContent(): Promise<Array<Record<string, any>>> {
  const content: Array<Record<string, any>> = [
    {
      type: 'input_text',
      text: formGPT.value.prompt
    }
  ]

  if (isContinuingGPTResponsesConversation.value && responsesLastImageGenerationCallId.value) {
    content.push({
      type: 'image_generation_call',
      id: responsesLastImageGenerationCallId.value
    })
  }

  if (gptEditInputSource.value === 'upload') {
    const uploadPayload = await prepareGPTEditUploadPayload()
    const maskDataUrl = uploadPayload.mask ? await fileToDataUrl(uploadPayload.mask) : null

    for (let index = 0; index < uploadPayload.images.length; index += 1) {
      const file = uploadPayload.images[index]
      const inputImage: GPTResponsesInputImage = {
        type: 'input_image',
        image_url: await fileToDataUrl(file)
      }

      if (index === 0 && maskDataUrl) {
        inputImage.input_image_mask = {
          image_url: maskDataUrl
        }
      }

      content.push(inputImage)
    }

    return content
  }

  if (gptEditInputSource.value === 'url') {
    gptReferenceImageUrls.value.forEach((imageUrl, index) => {
      const inputImage: GPTResponsesInputImage = {
        type: 'input_image',
        image_url: imageUrl
      }

      if (index === 0 && gptMaskUrl.value.trim()) {
        inputImage.input_image_mask = {
          image_url: gptMaskUrl.value.trim()
        }
      }

      content.push(inputImage)
    })

    return content
  }

  gptReferenceImageFileIds.value.forEach((fileId, index) => {
    const inputImage: GPTResponsesInputImage = {
      type: 'input_image',
      file_id: fileId
    }

    if (index === 0 && gptMaskFileId.value.trim()) {
      inputImage.input_image_mask = {
        file_id: gptMaskFileId.value.trim()
      }
    }

    content.push(inputImage)
  })

  return content
}

async function buildGPTResponsesRequestBody(options: {
  stream?: boolean
  mode?: 'generate' | 'edit'
} = {}) {
  const mode = options.mode || gptMode.value
  const tool: Record<string, any> = {
    type: 'image_generation'
  }

  tool.action = mode === 'edit'
    ? 'edit'
    : isContinuingGPTResponsesConversation.value
      ? 'auto'
      : 'generate'

  appendGPTResponsesToolOptions(tool)

  const body: Record<string, any> = {
    model: GPT_RESPONSES_MODEL,
    tools: [tool]
  }

  if (mode === 'edit') {
    body.input = [
      {
        role: 'user',
        content: await buildGPTResponsesEditInputContent()
      }
    ]
  } else {
    body.input = formGPT.value.prompt
  }

  if (options.stream) {
    body.stream = true
    body.partial_images = GPT_RESPONSES_STREAM_PARTIAL_IMAGES
  }

  if (isContinuingGPTResponsesConversation.value && responsesPreviousResponseId.value) {
    body.previous_response_id = responsesPreviousResponseId.value
  }

  return body
}

// Watch GPT model changes
watch(() => formGPT.value.model, (newModel) => {
  normalizeGPTSizeForModel(newModel)

  if (!GPT_MODEL_CAPABILITIES[newModel]?.supportsMultiple) {
    formGPT.value.n = 1
  }

  if (!GPT_MODEL_CAPABILITIES[newModel]?.supportsBackground) {
    formGPT.value.background = 'auto'
  }

  if (!GPT_MODEL_CAPABILITIES[newModel]?.supportsTransparentBackground && formGPT.value.background === 'transparent') {
    formGPT.value.background = 'auto'
    if (!isHydratingGPTSettings.value) {
      message.warning(t('dalle.transparentBackgroundNotSupported'))
    }
  }

  if (!GPT_MODEL_CAPABILITIES[newModel]?.supportsModeration) {
    formGPT.value.moderation = 'auto'
  }

  saveGPTSettings()
})

watch(gptMode, (mode, previousMode) => {
  if (mode !== previousMode) {
    resetGPTResponsesConversation({ silent: true })
  }
})

watch(gptApiMode, (mode, previousMode) => {
  if (mode === 'responses-api') {
    normalizeGPTSizeForResponsesApi()
    if (formGPT.value.background === 'transparent') {
      formGPT.value.background = 'auto'
    }
  }

  if (previousMode === 'responses-api' && mode !== 'responses-api') {
    resetGPTResponsesConversation({ silent: true })
  }
})

watch(() => formGPT.value.size, (newSize, oldSize) => {
  if (
    newSize === 'custom' &&
    oldSize !== 'custom' &&
    !parsedGPTCustomSize.value
  ) {
    formGPT.value.customSize = '1024x1024'
  }
})

watch(mainTab, (tab, previousTab) => {
  if (previousTab === 'gpt-image' && tab !== 'gpt-image') {
    resetGPTResponsesConversation({ silent: true })
  }
})

watch(() => configStore.activePresetId, (currentId, previousId) => {
  if (previousId && currentId !== previousId) {
    resetGPTResponsesConversation({ silent: true })
  }
})

watch(gptEditInputSource, (source) => {
  if (source === 'upload') {
    gptReferenceImageUrls.value = []
    gptReferenceImageFileIds.value = []
    gptMaskUrl.value = ''
    gptMaskFileId.value = ''
    return
  }

  gptReferenceImages.value = []
  gptMaskImage.value = null
  gptUploadedMaskImage.value = null
  gptMaskUploadKey.value += 1
  loadGPTMaskReferenceImage(null)

  if (source === 'url') {
    gptReferenceImageFileIds.value = []
    gptMaskFileId.value = ''
    return
  }

  gptReferenceImageUrls.value = []
  gptMaskUrl.value = ''
})

watch(gptPrimaryReferenceImage, (file, previousFile) => {
  if (file === previousFile) return

  gptUploadedMaskImage.value = null
  gptMaskImage.value = null
  gptMaskUploadKey.value += 1
  loadGPTMaskReferenceImage(file)
})

watch(formGPT, () => {
  saveGPTSettings()
}, { deep: true })

watch([gptEditInputSource, gptApiMode], () => {
  saveGPTSettings()
})

function saveGPTSettings() {
  const settings = {
    model: formGPT.value.model,
    customModel: formGPT.value.customModel,
    size: formGPT.value.size,
    customSize: formGPT.value.customSize,
    quality: formGPT.value.quality,
    background: formGPT.value.background,
    outputFormat: formGPT.value.outputFormat,
    outputCompression: formGPT.value.outputCompression,
    n: formGPT.value.n,
    moderation: formGPT.value.moderation,
    apiMode: gptApiMode.value,
    editInputSource: gptEditInputSource.value
  }
  localStorage.setItem(DALLE_SETTINGS_KEY, JSON.stringify(settings))
}

function loadGPTSettings() {
  isHydratingGPTSettings.value = true
  const saved = localStorage.getItem(DALLE_SETTINGS_KEY)
  if (saved) {
    try {
      const settings = JSON.parse(saved)
      formGPT.value.model = settings.model || 'gpt-image-2'
      formGPT.value.customModel = settings.customModel || ''
      formGPT.value.size = settings.size || 'auto'
      formGPT.value.customSize = settings.customSize || ''
      formGPT.value.quality = settings.quality || 'auto'
      formGPT.value.background = settings.background || 'auto'
      formGPT.value.outputFormat = settings.outputFormat || 'png'
      formGPT.value.outputCompression = settings.outputCompression ?? 100
      formGPT.value.n = settings.n || 1
      formGPT.value.moderation = settings.moderation || 'auto'
      gptApiMode.value = settings.apiMode === 'responses-api' ? 'responses-api' : 'image-api'
      gptEditInputSource.value = settings.editInputSource === 'file-id'
        ? 'file-id'
        : settings.editInputSource === 'url'
          ? 'url'
          : 'upload'
    } catch {
      // Ignore
    }
  }
  normalizeGPTSizeForModel(formGPT.value.model)
  if (gptApiMode.value === 'responses-api') {
    normalizeGPTSizeForResponsesApi()
    if (formGPT.value.background === 'transparent') {
      formGPT.value.background = 'auto'
    }
  }
  isHydratingGPTSettings.value = false
}

// ==================== Gemini-Image Options ====================
const geminiModelOptions = [
  { label: 'gemini-3-pro-image-preview (Pro)', value: 'gemini-3-pro-image-preview' },
  { label: 'gemini-2.5-flash-image (Flash)', value: 'gemini-2.5-flash-image' },
  { label: t('common.custom'), value: 'custom' }
]

const imageSizeOptions = [
  { label: '1K', value: '1K' },
  { label: '2K', value: '2K' },
  { label: '4K', value: '4K' }
]

const aspectRatioOptions = [
  { label: t('image.aspectRatios.auto'), value: 'auto' },
  { label: '□ 1:1 (' + t('image.aspectRatios.square') + ')', value: '1:1' },
  { label: '▭ 3:2 (' + t('image.aspectRatios.landscape') + ')', value: '3:2' },
  { label: '▯ 2:3 (' + t('image.aspectRatios.portrait') + ')', value: '2:3' },
  { label: '▯ 3:4 (' + t('image.aspectRatios.portrait') + ')', value: '3:4' },
  { label: '▭ 4:3 (' + t('image.aspectRatios.landscape') + ')', value: '4:3' },
  { label: '▯ 4:5 (' + t('image.aspectRatios.portrait') + ')', value: '4:5' },
  { label: '▭ 5:4 (' + t('image.aspectRatios.landscape') + ')', value: '5:4' },
  { label: '▯ 9:16 (' + t('image.aspectRatios.phone') + ')', value: '9:16' },
  { label: '▭ 16:9 (' + t('image.aspectRatios.phone') + ')', value: '16:9' },
  { label: '▯ 9:21 (' + t('image.aspectRatios.ultraTall') + ')', value: '9:21' },
  { label: '▭ 21:9 (' + t('image.aspectRatios.ultraWide') + ')', value: '21:9' }
]

const personOptions = [
  { label: t('image.personOptions.allowAll'), value: 'ALLOW_ALL' },
  { label: t('image.personOptions.allowAdult'), value: 'ALLOW_ADULT' },
  { label: t('image.personOptions.dontAllow'), value: 'DONT_ALLOW' }
]

// ==================== Flux Options ====================
const fluxModelOptions = [
  {
    label: 'flux-kontext-pro',
    value: 'flux-kontext-pro',
    description: 'flux.models.kontextProDesc'
  },
  {
    label: 'flux-kontext-max',
    value: 'flux-kontext-max',
    description: 'flux.models.kontextMaxDesc'
  },
  { label: t('common.custom'), value: 'custom' }
]

const fluxAspectRatioOptions = computed(() => [
  { label: t('flux.aspectRatios.matchInput'), value: 'match_input_image' },
  { label: '□ 1:1 (' + t('flux.aspectRatios.square') + ')', value: '1:1' },
  { label: '▭ 16:9 (' + t('flux.aspectRatios.landscape') + ')', value: '16:9' },
  { label: '▯ 9:16 (' + t('flux.aspectRatios.portrait') + ')', value: '9:16' },
  { label: '▭ 4:3 (' + t('flux.aspectRatios.landscape') + ')', value: '4:3' },
  { label: '▯ 3:4 (' + t('flux.aspectRatios.portrait') + ')', value: '3:4' },
  { label: '▭ 3:2 (' + t('flux.aspectRatios.landscape') + ')', value: '3:2' },
  { label: '▯ 2:3 (' + t('flux.aspectRatios.portrait') + ')', value: '2:3' },
  { label: '▯ 4:5 (' + t('flux.aspectRatios.portrait') + ')', value: '4:5' },
  { label: '▭ 5:4 (' + t('flux.aspectRatios.landscape') + ')', value: '5:4' },
  { label: '▭ 21:9 (' + t('flux.aspectRatios.ultraWide') + ')', value: '21:9' },
  { label: '▯ 9:21 (' + t('flux.aspectRatios.ultraTall') + ')', value: '9:21' },
  { label: '▭ 2:1 (' + t('flux.aspectRatios.landscape') + ')', value: '2:1' },
  { label: '▯ 1:2 (' + t('flux.aspectRatios.portrait') + ')', value: '1:2' }
])

const fluxOutputFormatOptions = [
  { label: 'PNG', value: 'png' },
  { label: 'JPG', value: 'jpg' }
]

const isFluxCustomModel = computed(() => formFlux.value.model === 'custom')
const actualFluxModel = computed(() =>
  isFluxCustomModel.value ? formFlux.value.customModel : formFlux.value.model
)

const currentFluxModelInfo = computed(() => {
  return fluxModelOptions.find(m => m.value === formFlux.value.model)
})

const previewModelLabel = computed(() => {
  if (mainTab.value === 'gpt-image') return currentGPTGenerateModelLabel.value
  if (mainTab.value === 'flux') return 'Flux'
  return 'Nano Banana'
})

const previewHasResult = computed(() => {
  if (mainTab.value === 'gpt-image') return gptImageUrls.value.length > 0
  if (mainTab.value === 'flux') return Boolean(fluxImageUrl.value)
  return Boolean(imageUrl.value)
})

const previewStatusText = computed(() => {
  if (isLoading.value) return t('image.preview.status.generating')
  if (previewHasResult.value) return t('image.preview.status.ready')
  return t('image.preview.status.idle')
})

const previewEmptyTitle = computed(() => {
  if (mainTab.value === 'gpt-image') {
    return isGPTResponsesMode.value
      ? t('image.preview.empty.gpt54Title')
      : t('image.preview.empty.gptImage2Title')
  }
  if (mainTab.value === 'flux') return t('image.preview.empty.fluxTitle')
  return t('image.preview.empty.nanoBananaTitle')
})

const previewEmptyDescription = computed(() => {
  if (mainTab.value === 'gpt-image') {
    return isGPTResponsesMode.value
      ? t('image.preview.empty.gpt54Description')
      : t('image.preview.empty.gptImage2Description')
  }
  if (mainTab.value === 'flux') return t('image.preview.empty.fluxDescription')
  return t('image.preview.empty.nanoBananaDescription')
})

// Flux settings persistence
watch(formFlux, () => {
  saveFluxSettings()
}, { deep: true })

function saveFluxSettings() {
  const settings = {
    model: formFlux.value.model,
    customModel: formFlux.value.customModel,
    aspectRatio: formFlux.value.aspectRatio,
    outputFormat: formFlux.value.outputFormat,
    safetyTolerance: formFlux.value.safetyTolerance,
    promptUpsampling: formFlux.value.promptUpsampling
  }
  localStorage.setItem(FLUX_SETTINGS_KEY, JSON.stringify(settings))
}

function loadFluxSettings() {
  const saved = localStorage.getItem(FLUX_SETTINGS_KEY)
  if (saved) {
    try {
      const settings = JSON.parse(saved)
      formFlux.value.model = settings.model || 'flux-kontext-pro'
      formFlux.value.customModel = settings.customModel || ''
      formFlux.value.aspectRatio = settings.aspectRatio || '1:1'
      formFlux.value.outputFormat = settings.outputFormat || 'png'
      formFlux.value.safetyTolerance = settings.safetyTolerance ?? 2
      formFlux.value.promptUpsampling = settings.promptUpsampling ?? false
    } catch {
      // Ignore
    }
  }
}

function resetImageViewPreviewState() {
  errorMessage.value = ''
  gptRevisedPrompt.value = ''
  revokeGPTImageUrls(gptImageUrls.value)
  gptImageUrls.value = []
  imageUrl.value = ''
  imageInfo.value = null
  if (fluxImageUrl.value) {
    try {
      URL.revokeObjectURL(fluxImageUrl.value)
    } catch {
      // Ignore remote URLs.
    }
  }
  fluxImageUrl.value = ''
  fluxImageInfo.value = null
}

function applyPendingImageReload(item: HistoryItem) {
  if (item.type !== 'image') return

  const params = item.params as any
  resetImageViewPreviewState()

  if (params.format === 'gpt-image') {
    mainTab.value = 'gpt-image'
    formGPT.value.prompt = params.prompt || ''
    formGPT.value.model = params.model || 'gpt-image-2'
    formGPT.value.customModel = params.customModel || ''
    gptMode.value = params.mode === 'edit' ? 'edit' : 'generate'
    gptApiMode.value = params.apiMode === 'responses-api' ? 'responses-api' : 'image-api'
    gptEditInputSource.value = params.editInputSource === 'file-id'
      ? 'file-id'
      : params.editInputSource === 'url'
        ? 'url'
        : 'upload'
    formGPT.value.size = params.sizePreset || params.size || 'auto'
    formGPT.value.customSize = params.customSize || ''
    formGPT.value.quality = params.quality || 'auto'
    formGPT.value.background = params.background || 'auto'
    formGPT.value.outputFormat = params.outputFormat || 'png'
    formGPT.value.outputCompression = params.outputCompression ?? 100
    formGPT.value.n = params.n || 1
    formGPT.value.moderation = params.moderation || 'auto'
    gptReferenceImages.value = []
    gptMaskImage.value = null
    gptUploadedMaskImage.value = null
    gptMaskUploadKey.value += 1
    loadGPTMaskReferenceImage(null)
    gptReferenceImageUrls.value = gptEditInputSource.value === 'url' && Array.isArray(params.referenceImageUrls)
      ? params.referenceImageUrls.filter(Boolean).slice(0, 10)
      : []
    gptReferenceImageFileIds.value = gptEditInputSource.value === 'file-id' && Array.isArray(params.referenceImageFileIds)
      ? params.referenceImageFileIds.filter(Boolean).slice(0, 10)
      : []
    gptMaskUrl.value = gptEditInputSource.value === 'url' ? (params.maskUrl || '') : ''
    gptMaskFileId.value = gptEditInputSource.value === 'file-id' ? (params.maskFileId || '') : ''
    resetGPTResponsesConversation({ silent: true })
    normalizeGPTSizeForModel(formGPT.value.model)
    if (gptApiMode.value === 'responses-api') {
      normalizeGPTSizeForResponsesApi()
    }
    return
  }

  if (params.format === 'gemini-ai-studio') {
    mainTab.value = 'nano-banana'
    geminiSubTab.value = 'ai-studio'
    formAI.value.prompt = params.prompt || ''
    formAI.value.model = params.model || 'gemini-3-pro-image-preview'
    formAI.value.customModel = params.customModel || ''
    formAI.value.imageSize = params.imageSize || '1K'
    formAI.value.aspectRatio = params.aspectRatio || 'auto'
    formAI.value.googleSearch = params.googleSearch ?? true
    formAI.value.temperature = params.temperature ?? 1
    formAI.value.topP = params.topP ?? 0.95
    formAI.value.maxOutputTokens = params.maxOutputTokens ?? 32768
    formAI.value.stopSequences = Array.isArray(params.stopSequences) ? params.stopSequences.join(', ') : ''
    return
  }

  if (params.format === 'gemini-vertex') {
    mainTab.value = 'nano-banana'
    geminiSubTab.value = 'vertex'
    formVertex.value.prompt = params.prompt || ''
    formVertex.value.model = params.model || 'gemini-3-pro-image-preview'
    formVertex.value.customModel = params.customModel || ''
    formVertex.value.imageSize = params.imageSize || '1K'
    formVertex.value.aspectRatio = params.aspectRatio || 'auto'
    formVertex.value.outputMimeType = params.outputMimeType || 'image/png'
    formVertex.value.personGeneration = params.personGeneration || 'ALLOW_ALL'
    formVertex.value.temperature = params.temperature ?? 1
    formVertex.value.topP = params.topP ?? 0.95
    formVertex.value.maxOutputTokens = params.maxOutputTokens ?? 32768
    return
  }

  if (params.format === 'flux') {
    mainTab.value = 'flux'
    formFlux.value.prompt = params.prompt || ''
    formFlux.value.model = params.model || 'flux-kontext-pro'
    formFlux.value.customModel = params.customModel || ''
    formFlux.value.inputImageUrl = params.inputImageUrl || ''
    formFlux.value.aspectRatio = params.aspectRatio || '1:1'
    formFlux.value.outputFormat = params.outputFormat || 'png'
    formFlux.value.seed = params.seed ?? null
    formFlux.value.safetyTolerance = params.safetyTolerance ?? 2
    formFlux.value.promptUpsampling = params.promptUpsampling ?? false
    fluxInputImage.value = null
  }
}

onMounted(() => {
  loadGPTSettings()
  loadFluxSettings()

  const pendingItem = historyStore.consumePendingReload()
  if (pendingItem?.type === 'image') {
    applyPendingImageReload(pendingItem)
  }
})

// ==================== Common Functions ====================
function handleNanoImageChange(options: { fileList: UploadFileInfo[] }) {
  nanoReferenceImages.value = options.fileList
    .slice(0, 9)
    .map(f => f.file)
    .filter((f): f is File => f !== null && f !== undefined)
}

function handleGPTImageChange(options: { fileList: UploadFileInfo[] }) {
  gptReferenceImages.value = options.fileList
    .slice(0, 10)
    .map(f => f.file)
    .filter((f): f is File => f !== null && f !== undefined)
}

function handleGPTMaskChange(options: { file: UploadFileInfo }) {
  const file = options.file.file
  gptUploadedMaskImage.value = file || null
  if (!gptMaskHasDrawing.value) {
    gptMaskImage.value = gptUploadedMaskImage.value
  }
}

function handleFluxImageChange(options: { file: UploadFileInfo }) {
  const file = options.file.file
  fluxInputImage.value = file || null
  if (file) {
    formFlux.value.inputImageUrl = ''
  }
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1]
      resolve(base64)
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

async function fileToDataUrl(file: File): Promise<string> {
  const base64 = await fileToBase64(file)
  const mimeType = file.type || 'application/octet-stream'
  return `data:${mimeType};base64,${base64}`
}

function base64ToBlob(base64: string, mimeType: string): Blob {
  const byteCharacters = atob(base64)
  const byteNumbers = new Array(byteCharacters.length)
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i)
  }
  const byteArray = new Uint8Array(byteNumbers)
  return new Blob([byteArray], { type: mimeType })
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function getGPTMaskContext(): CanvasRenderingContext2D | null {
  return gptMaskDrawingCanvas.value?.getContext('2d') ?? null
}

function getGPTMaskImageData(): ImageData | null {
  const canvas = gptMaskDrawingCanvas.value
  const context = getGPTMaskContext()
  const dimensions = gptMaskImageDimensions.value
  if (!canvas || !context || !dimensions) return null

  return context.getImageData(0, 0, dimensions.width, dimensions.height)
}

function restoreGPTMaskImageData(imageData: ImageData) {
  const context = getGPTMaskContext()
  const dimensions = gptMaskImageDimensions.value
  if (!context || !dimensions) return

  context.clearRect(0, 0, dimensions.width, dimensions.height)
  context.putImageData(imageData, 0, 0)
  updateGPTMaskHasDrawingFromCanvas()
}

function pushGPTMaskUndoState() {
  const imageData = getGPTMaskImageData()
  if (!imageData) return

  gptMaskUndoStack.value.push(imageData)
  if (gptMaskUndoStack.value.length > GPT_MASK_HISTORY_LIMIT) {
    gptMaskUndoStack.value.shift()
  }
  gptMaskRedoStack.value = []
}

function updateGPTMaskHasDrawingFromCanvas(): boolean {
  const imageData = getGPTMaskImageData()
  if (!imageData) {
    gptMaskHasDrawing.value = false
    return false
  }

  const data = imageData.data
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] > 0) {
      gptMaskHasDrawing.value = true
      return true
    }
  }

  gptMaskHasDrawing.value = false
  return false
}

function resetGPTMaskDrawingState() {
  const context = getGPTMaskContext()
  const dimensions = gptMaskImageDimensions.value
  if (context && dimensions) {
    context.clearRect(0, 0, dimensions.width, dimensions.height)
  }

  gptMaskUndoStack.value = []
  gptMaskRedoStack.value = []
  gptMaskHasDrawing.value = false
  gptMaskImage.value = gptUploadedMaskImage.value
}

function drawGPTMaskBaseImage(image: HTMLImageElement) {
  const canvas = gptMaskBaseCanvas.value
  const context = canvas?.getContext('2d')
  const dimensions = gptMaskImageDimensions.value
  if (!canvas || !context || !dimensions) return

  context.clearRect(0, 0, dimensions.width, dimensions.height)
  context.drawImage(image, 0, 0, dimensions.width, dimensions.height)
}

async function loadGPTMaskReferenceImage(file: File | null) {
  if (gptMaskReferenceObjectUrl.value) {
    URL.revokeObjectURL(gptMaskReferenceObjectUrl.value)
    gptMaskReferenceObjectUrl.value = ''
  }

  gptMaskImageDimensions.value = null
  resetGPTMaskDrawingState()

  if (!file) return

  const objectUrl = URL.createObjectURL(file)
  gptMaskReferenceObjectUrl.value = objectUrl

  const image = new Image()
  image.onload = async () => {
    if (gptMaskReferenceObjectUrl.value !== objectUrl) return

    gptMaskImageDimensions.value = {
      width: image.naturalWidth,
      height: image.naturalHeight
    }

    await nextTick()
    drawGPTMaskBaseImage(image)
    resetGPTMaskDrawingState()
    fitGPTMaskEditorView()
  }
  image.onerror = () => {
    if (gptMaskReferenceObjectUrl.value === objectUrl) {
      gptMaskImageDimensions.value = null
      message.error(t('dalle.maskEditor.loadFailed'))
    }
  }
  image.src = objectUrl
}

function getGPTMaskPointerPoint(event: PointerEvent): GPTMaskPoint | null {
  const canvas = gptMaskDrawingCanvas.value
  const dimensions = gptMaskImageDimensions.value
  if (!canvas || !dimensions) return null

  const rect = canvas.getBoundingClientRect()
  if (rect.width === 0 || rect.height === 0) return null

  return {
    x: clamp((event.clientX - rect.left) * (dimensions.width / rect.width), 0, dimensions.width),
    y: clamp((event.clientY - rect.top) * (dimensions.height / rect.height), 0, dimensions.height)
  }
}

function drawGPTMaskPoint(point: GPTMaskPoint) {
  const context = getGPTMaskContext()
  if (!context) return

  context.save()
  context.globalCompositeOperation = gptMaskTool.value === 'eraser' ? 'destination-out' : 'source-over'
  context.fillStyle = 'rgba(244, 63, 94, 0.62)'
  context.beginPath()
  context.arc(point.x, point.y, gptMaskBrushSize.value / 2, 0, Math.PI * 2)
  context.fill()
  context.restore()

  if (gptMaskTool.value === 'brush') {
    gptMaskHasDrawing.value = true
  }
}

function drawGPTMaskLine(from: GPTMaskPoint, to: GPTMaskPoint) {
  const context = getGPTMaskContext()
  if (!context) return

  context.save()
  context.globalCompositeOperation = gptMaskTool.value === 'eraser' ? 'destination-out' : 'source-over'
  context.strokeStyle = 'rgba(244, 63, 94, 0.62)'
  context.lineWidth = gptMaskBrushSize.value
  context.lineCap = 'round'
  context.lineJoin = 'round'
  context.beginPath()
  context.moveTo(from.x, from.y)
  context.lineTo(to.x, to.y)
  context.stroke()
  context.restore()

  if (gptMaskTool.value === 'brush') {
    gptMaskHasDrawing.value = true
  }
}

function handleGPTMaskPointerDown(event: PointerEvent) {
  if (!gptMaskImageDimensions.value) return

  event.preventDefault()
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
  gptMaskActivePointerId.value = event.pointerId

  if (gptMaskTool.value === 'pan') {
    isGPTMaskPanning.value = true
    gptMaskLastPanClient.value = { x: event.clientX, y: event.clientY }
    return
  }

  const point = getGPTMaskPointerPoint(event)
  if (!point) return

  pushGPTMaskUndoState()
  isGPTMaskDrawing.value = true
  gptMaskLastPoint.value = point
  drawGPTMaskPoint(point)
}

function handleGPTMaskPointerMove(event: PointerEvent) {
  if (gptMaskActivePointerId.value !== event.pointerId) return

  if (isGPTMaskPanning.value && gptMaskLastPanClient.value) {
    const dx = event.clientX - gptMaskLastPanClient.value.x
    const dy = event.clientY - gptMaskLastPanClient.value.y
    gptMaskPan.value = {
      x: gptMaskPan.value.x + dx,
      y: gptMaskPan.value.y + dy
    }
    gptMaskLastPanClient.value = { x: event.clientX, y: event.clientY }
    return
  }

  if (!isGPTMaskDrawing.value || !gptMaskLastPoint.value) return

  const point = getGPTMaskPointerPoint(event)
  if (!point) return

  drawGPTMaskLine(gptMaskLastPoint.value, point)
  gptMaskLastPoint.value = point
}

function handleGPTMaskPointerUp(event: PointerEvent) {
  if (gptMaskActivePointerId.value !== event.pointerId) return

  const target = event.currentTarget as HTMLElement
  if (target.hasPointerCapture(event.pointerId)) {
    target.releasePointerCapture(event.pointerId)
  }
  gptMaskActivePointerId.value = null
  gptMaskLastPoint.value = null
  gptMaskLastPanClient.value = null
  isGPTMaskDrawing.value = false
  isGPTMaskPanning.value = false
  updateGPTMaskHasDrawingFromCanvas()
}

function undoGPTMaskEdit() {
  const previous = gptMaskUndoStack.value.pop()
  const current = getGPTMaskImageData()
  if (!previous || !current) return

  gptMaskRedoStack.value.push(current)
  restoreGPTMaskImageData(previous)
}

function redoGPTMaskEdit() {
  const next = gptMaskRedoStack.value.pop()
  const current = getGPTMaskImageData()
  if (!next || !current) return

  gptMaskUndoStack.value.push(current)
  restoreGPTMaskImageData(next)
}

function clearGPTMaskDrawing() {
  const context = getGPTMaskContext()
  const dimensions = gptMaskImageDimensions.value
  if (!context || !dimensions) return

  pushGPTMaskUndoState()
  context.clearRect(0, 0, dimensions.width, dimensions.height)
  updateGPTMaskHasDrawingFromCanvas()
}

function fillGPTMaskDrawing() {
  const context = getGPTMaskContext()
  const dimensions = gptMaskImageDimensions.value
  if (!context || !dimensions) return

  pushGPTMaskUndoState()
  context.save()
  context.globalCompositeOperation = 'source-over'
  context.fillStyle = 'rgba(244, 63, 94, 0.62)'
  context.fillRect(0, 0, dimensions.width, dimensions.height)
  context.restore()
  updateGPTMaskHasDrawingFromCanvas()
}

function invertGPTMaskDrawing() {
  const context = getGPTMaskContext()
  const dimensions = gptMaskImageDimensions.value
  const imageData = getGPTMaskImageData()
  if (!context || !dimensions || !imageData) return

  pushGPTMaskUndoState()
  const data = imageData.data
  for (let i = 0; i < data.length; i += 4) {
    const isMasked = data[i + 3] > 0
    data[i] = 244
    data[i + 1] = 63
    data[i + 2] = 94
    data[i + 3] = isMasked ? 0 : 158
  }
  context.putImageData(imageData, 0, 0)
  updateGPTMaskHasDrawingFromCanvas()
}

function fitGPTMaskEditorView() {
  const viewport = gptMaskViewportRef.value
  const dimensions = gptMaskImageDimensions.value
  if (!viewport || !dimensions) return

  const availableWidth = Math.max(120, viewport.clientWidth - 40)
  const availableHeight = Math.max(120, viewport.clientHeight - 40)
  gptMaskZoom.value = clamp(
    Math.min(availableWidth / dimensions.width, availableHeight / dimensions.height, 1),
    GPT_MASK_MIN_ZOOM,
    GPT_MASK_MAX_ZOOM
  )
  gptMaskPan.value = { x: 0, y: 0 }
}

function resetGPTMaskEditorView() {
  gptMaskZoom.value = 1
  gptMaskPan.value = { x: 0, y: 0 }
}

function adjustGPTMaskZoom(multiplier: number) {
  gptMaskZoom.value = clamp(gptMaskZoom.value * multiplier, GPT_MASK_MIN_ZOOM, GPT_MASK_MAX_ZOOM)
}

function handleGPTMaskWheel(event: WheelEvent) {
  if (!gptMaskImageDimensions.value) return
  adjustGPTMaskZoom(event.deltaY < 0 ? 1.08 : 1 / 1.08)
}

function getPNGFileName(file: File): string {
  const baseName = file.name.replace(/\.[^.]+$/, '') || 'reference-image'
  return `${baseName}.png`
}

function getImageDimensionsFromFile(file: File): Promise<GPTMaskCanvasDimensions> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file)
    const image = new Image()

    image.onload = () => {
      URL.revokeObjectURL(objectUrl)
      resolve({
        width: image.naturalWidth,
        height: image.naturalHeight
      })
    }

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error(t('dalle.maskEditor.referenceLoadFailed')))
    }

    image.src = objectUrl
  })
}

function convertImageFileToPNG(file: File): Promise<File> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file)
    const image = new Image()

    image.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = image.naturalWidth
      canvas.height = image.naturalHeight

      const context = canvas.getContext('2d')
      if (!context) {
        URL.revokeObjectURL(objectUrl)
        reject(new Error(t('dalle.maskEditor.referenceConvertFailed')))
        return
      }

      context.drawImage(image, 0, 0)
      canvas.toBlob((blob) => {
        URL.revokeObjectURL(objectUrl)
        if (!blob) {
          reject(new Error(t('dalle.maskEditor.referenceConvertFailed')))
          return
        }

        resolve(new File([blob], getPNGFileName(file), { type: 'image/png' }))
      }, 'image/png')
    }

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error(t('dalle.maskEditor.referenceLoadFailed')))
    }

    image.src = objectUrl
  })
}

async function exportGPTMaskFile(): Promise<File | null> {
  const sourceCanvas = gptMaskDrawingCanvas.value
  const sourceContext = sourceCanvas?.getContext('2d')
  const dimensions = gptMaskImageDimensions.value
  if (!sourceCanvas || !sourceContext || !dimensions) return null

  if (!updateGPTMaskHasDrawingFromCanvas()) return null

  const maskPixels = sourceContext.getImageData(0, 0, dimensions.width, dimensions.height)
  const exportCanvas = document.createElement('canvas')
  exportCanvas.width = dimensions.width
  exportCanvas.height = dimensions.height
  const exportContext = exportCanvas.getContext('2d')
  if (!exportContext) return null

  const output = exportContext.createImageData(dimensions.width, dimensions.height)
  const source = maskPixels.data
  const target = output.data
  for (let i = 0; i < source.length; i += 4) {
    const shouldEdit = source[i + 3] > 0
    target[i] = 255
    target[i + 1] = 255
    target[i + 2] = 255
    target[i + 3] = shouldEdit ? 0 : 255
  }

  exportContext.putImageData(output, 0, 0)

  const blob = await new Promise<Blob | null>((resolve) => {
    exportCanvas.toBlob(resolve, 'image/png')
  })
  if (!blob) return null

  return new File([blob], `gpt-image-mask-${Date.now()}.png`, { type: 'image/png' })
}

async function downloadGPTMaskFile() {
  const file = await exportGPTMaskFile()
  if (!file) {
    message.warning(t('dalle.maskEditor.emptyMaskWarning'))
    return
  }

  const url = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = url
  a.download = file.name
  a.click()
  URL.revokeObjectURL(url)
}

async function resolveGPTMaskImageForSubmit(): Promise<File | null> {
  if (gptEditInputSource.value !== 'upload') return null

  const visualMask = await exportGPTMaskFile()
  if (visualMask) {
    gptMaskImage.value = visualMask
    return visualMask
  }

  gptMaskImage.value = gptUploadedMaskImage.value
  return gptMaskImage.value
}

async function prepareGPTEditUploadPayload(): Promise<{ images: File[]; mask: File | null }> {
  const referenceImages = [...gptReferenceImages.value]
  const maskImage = await resolveGPTMaskImageForSubmit()

  if (!maskImage || referenceImages.length === 0) {
    return {
      images: referenceImages,
      mask: null
    }
  }

  const primaryReferenceImage = referenceImages[0]
  const [primaryDimensions, maskDimensions] = await Promise.all([
    getImageDimensionsFromFile(primaryReferenceImage),
    getImageDimensionsFromFile(maskImage)
  ])

  if (
    primaryDimensions.width !== maskDimensions.width ||
    primaryDimensions.height !== maskDimensions.height
  ) {
    throw new Error(t('dalle.maskEditor.maskSizeMismatch'))
  }

  const pngPrimaryReferenceImage = await convertImageFileToPNG(primaryReferenceImage)

  return {
    images: [pngPrimaryReferenceImage, ...referenceImages.slice(1)],
    mask: maskImage
  }
}

function getSafeGPTEndpoint(url: string) {
  try {
    const parsed = new URL(url)
    return `${parsed.origin}${parsed.pathname}`
  } catch {
    return url.replace(/\?.*$/, '')
  }
}

function isGPTFetchNetworkError(error: unknown) {
  if (error instanceof TypeError) return true

  const message = error instanceof Error ? error.message : String(error)
  return /failed to fetch|networkerror|load failed|network request failed/i.test(message)
}

function createGPTNetworkError(error: unknown, url: string, startedAt: number) {
  const elapsedSeconds = Math.max(1, Math.round((Date.now() - startedAt) / 1000))
  const originalMessage = error instanceof Error ? error.message : String(error)

  return new Error(t('dalle.networkFailure', {
    seconds: elapsedSeconds,
    endpoint: getSafeGPTEndpoint(url),
    message: originalMessage || t('errors.networkError')
  }))
}

function isGPTImageStreamUnsupportedError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  return (
    /stream|partial_images/i.test(message) &&
    /unsupported|not supported|unknown|unrecognized|invalid|unexpected/i.test(message)
  )
}

function getGPTImageItemsFromStreamPayload(payload: any): GPTImageResponseItem[] {
  if (!payload) return []

  if (Array.isArray(payload.data)) {
    return payload.data.filter((item: any) => item?.b64_json || item?.url)
  }

  if (payload.b64_json || payload.url) {
    return [payload]
  }

  if (payload.image?.b64_json || payload.image?.url) {
    return [payload.image]
  }

  return []
}

function parseGPTImageStreamBlock(block: string) {
  const lines = block.split(/\n/)
  const dataLines: string[] = []
  let eventName = ''

  for (const line of lines) {
    if (line.startsWith('event:')) {
      eventName = line.slice(6).trim()
    } else if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).trimStart())
    }
  }

  if (dataLines.length === 0) return null

  const data = dataLines.join('\n').trim()
  if (!data || data === '[DONE]') return null

  try {
    return {
      eventName,
      data: JSON.parse(data)
    }
  } catch {
    return null
  }
}

function consumeGPTImageStreamBuffer(
  buffer: string,
  flush: boolean,
  onBlock: (block: string) => void
) {
  let remaining = buffer.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  let separatorIndex = remaining.indexOf('\n\n')

  while (separatorIndex !== -1) {
    const block = remaining.slice(0, separatorIndex).trim()
    if (block) onBlock(block)
    remaining = remaining.slice(separatorIndex + 2)
    separatorIndex = remaining.indexOf('\n\n')
  }

  if (flush && remaining.trim()) {
    onBlock(remaining.trim())
    return ''
  }

  return remaining
}

async function parseGPTImageStreamResponse(res: Response): Promise<{ data: GPTImageResponseItem[] }> {
  const completedItems: GPTImageResponseItem[] = []
  const partialItems: GPTImageResponseItem[] = []

  const handleStreamBlock = (block: string) => {
    const event = parseGPTImageStreamBlock(block)
    if (!event) return

    const eventType = String(event.data?.type || event.eventName || '')
    if (eventType === 'error' || event.data?.error) {
      const message = event.data?.error?.message || event.data?.message || t('errors.networkError')
      throw new Error(message)
    }

    const items = getGPTImageItemsFromStreamPayload(event.data)
    if (items.length === 0) return

    if (eventType.includes('partial_image')) {
      partialItems.splice(0, partialItems.length, ...items)
    } else {
      completedItems.push(...items)
    }
  }

  if (!res.body) {
    const text = await res.text()
    consumeGPTImageStreamBuffer(text, true, handleStreamBlock)
    return { data: completedItems.length > 0 ? completedItems : partialItems }
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    buffer = consumeGPTImageStreamBuffer(buffer, false, handleStreamBlock)
  }

  buffer += decoder.decode()
  consumeGPTImageStreamBuffer(buffer, true, handleStreamBlock)

  return { data: completedItems.length > 0 ? completedItems : partialItems }
}

function mergeGPTResponsesOutputItems(
  existingItems: any[],
  appendedItems: GPTResponsesImageGenerationCall[]
) {
  const merged = [...existingItems]

  for (const item of appendedItems) {
    const duplicateIndex = merged.findIndex((existingItem: any) =>
      (item.id && existingItem?.id === item.id) ||
      (
        !item.id &&
        existingItem?.type === item.type &&
        existingItem?.revised_prompt === item.revised_prompt &&
        JSON.stringify(existingItem?.result) === JSON.stringify(item.result)
      )
    )

    if (duplicateIndex === -1) {
      merged.push(item)
    } else {
      merged[duplicateIndex] = {
        ...merged[duplicateIndex],
        ...item
      }
    }
  }

  return merged
}

async function parseGPTResponsesStreamResponse(res: Response): Promise<any> {
  const outputItems: GPTResponsesImageGenerationCall[] = []
  let responseId: string | null = null
  let responseStatus = ''
  let completedResponse: any = null

  const handleStreamBlock = (block: string) => {
    const event = parseGPTImageStreamBlock(block)
    if (!event) return

    const payload = event.data
    const eventType = String(payload?.type || event.eventName || '')

    if (eventType === 'error' || payload?.error) {
      const message = payload?.error?.message || payload?.message || t('errors.networkError')
      throw new Error(message)
    }

    if (typeof payload?.response_id === 'string' && payload.response_id) {
      responseId = payload.response_id
    }

    if (typeof payload?.response?.id === 'string' && payload.response.id) {
      responseId = payload.response.id
    }

    if (typeof payload?.response?.status === 'string' && payload.response.status) {
      responseStatus = payload.response.status
    }

    if (typeof payload?.status === 'string' && payload.status) {
      responseStatus = payload.status
    }

    if (eventType === 'response.output_item.done' && payload?.item?.type === 'image_generation_call') {
      outputItems.push(payload.item)
      return
    }

    if (eventType === 'response.completed' && payload?.response) {
      completedResponse = payload.response
    }
  }

  if (!res.body) {
    const text = await res.text()
    consumeGPTImageStreamBuffer(text, true, handleStreamBlock)
  } else {
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      buffer = consumeGPTImageStreamBuffer(buffer, false, handleStreamBlock)
    }

    buffer += decoder.decode()
    consumeGPTImageStreamBuffer(buffer, true, handleStreamBlock)
  }

  if (completedResponse && typeof completedResponse === 'object') {
    const existingOutput = Array.isArray(completedResponse.output) ? completedResponse.output : []
    return {
      ...completedResponse,
      id: responseId || completedResponse.id || null,
      status: responseStatus || completedResponse.status || 'completed',
      output: mergeGPTResponsesOutputItems(existingOutput, outputItems)
    }
  }

  if (outputItems.length > 0) {
    return {
      id: responseId,
      status: responseStatus || 'completed',
      output: outputItems
    }
  }

  return {
    id: responseId,
    status: responseStatus || '',
    output: []
  }
}

async function requestGPTImageJSON(
  url: string,
  init: RequestInit,
  sourceSignal: AbortSignal
): Promise<any> {
  const startedAt = Date.now()
  const requestController = new AbortController()

  const abortFromSource = () => requestController.abort()
  if (sourceSignal.aborted) {
    requestController.abort()
  } else {
    sourceSignal.addEventListener('abort', abortFromSource, { once: true })
  }

  try {
    const res = await fetch(url, {
      ...init,
      signal: requestController.signal
    })

    const contentType = res.headers.get('content-type') || ''

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw parseApiError(text, res.status)
    }

    if (contentType.includes('text/event-stream')) {
      return await parseGPTImageStreamResponse(res)
    }

    const text = await res.text()
    return JSON.parse(text)
  } catch (error) {
    if (sourceSignal.aborted) {
      throw error
    }

    if (isGPTFetchNetworkError(error)) {
      throw createGPTNetworkError(error, url, startedAt)
    }

    throw error
  } finally {
    sourceSignal.removeEventListener('abort', abortFromSource)
  }
}

async function requestGPTResponses(
  url: string,
  init: RequestInit,
  sourceSignal: AbortSignal
): Promise<any> {
  const startedAt = Date.now()
  const requestController = new AbortController()

  const abortFromSource = () => requestController.abort()
  if (sourceSignal.aborted) {
    requestController.abort()
  } else {
    sourceSignal.addEventListener('abort', abortFromSource, { once: true })
  }

  try {
    const res = await fetch(url, {
      ...init,
      signal: requestController.signal
    })

    const contentType = res.headers.get('content-type') || ''

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw parseApiError(text, res.status)
    }

    if (contentType.includes('text/event-stream')) {
      return await parseGPTResponsesStreamResponse(res)
    }

    const text = await res.text()
    return JSON.parse(text)
  } catch (error) {
    if (sourceSignal.aborted) {
      throw error
    }

    if (isGPTFetchNetworkError(error)) {
      throw createGPTNetworkError(error, url, startedAt)
    }

    throw error
  } finally {
    sourceSignal.removeEventListener('abort', abortFromSource)
  }
}

function delayWithSignal(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException('Aborted', 'AbortError'))
      return
    }

    const timeoutId = window.setTimeout(() => {
      cleanup()
      resolve()
    }, ms)

    const handleAbort = () => {
      cleanup()
      reject(new DOMException('Aborted', 'AbortError'))
    }

    const cleanup = () => {
      window.clearTimeout(timeoutId)
      signal.removeEventListener('abort', handleAbort)
    }

    signal.addEventListener('abort', handleAbort, { once: true })
  })
}

function extractGPTResponsesOutputText(response: any): string {
  const output = Array.isArray(response?.output) ? response.output as GPTResponsesOutputTextItem[] : []
  const parts: string[] = []

  if (typeof response?.error?.message === 'string' && response.error.message.trim()) {
    parts.push(response.error.message.trim())
  }

  if (typeof response?.output_text === 'string' && response.output_text.trim()) {
    parts.push(response.output_text.trim())
  }

  if (typeof response?.incomplete_details?.reason === 'string' && response.incomplete_details.reason.trim()) {
    parts.push(response.incomplete_details.reason.trim())
  }

  for (const item of output) {
    if (typeof item?.text === 'string' && item.text.trim()) {
      parts.push(item.text.trim())
    }

    if (typeof item?.output_text === 'string' && item.output_text.trim()) {
      parts.push(item.output_text.trim())
    }

    if (typeof item?.refusal === 'string' && item.refusal.trim()) {
      parts.push(item.refusal.trim())
    }

    if (!Array.isArray(item?.content)) continue

    for (const contentItem of item.content) {
      if (typeof contentItem?.text === 'string' && contentItem.text.trim()) {
        parts.push(contentItem.text.trim())
      }

      if (typeof contentItem?.output_text === 'string' && contentItem.output_text.trim()) {
        parts.push(contentItem.output_text.trim())
      }

      if (typeof contentItem?.refusal === 'string' && contentItem.refusal.trim()) {
        parts.push(contentItem.refusal.trim())
      }
    }
  }

  return [...new Set(parts)].join(' ').slice(0, 400)
}

function hasGPTResponsesImageCall(response: any): boolean {
  const output = Array.isArray(response?.output) ? response.output : []
  return output.some((item: any) =>
    item?.type === 'image_generation_call' ||
    (Array.isArray(item?.content) && item.content.some((contentItem: any) => contentItem?.type === 'image_generation_call'))
  )
}

async function retrieveGPTResponse(
  responseId: string,
  sourceSignal: AbortSignal
): Promise<any> {
  const url = `${configStore.baseUrl.replace(/\/$/, '')}/v1/responses/${responseId}`
  return await requestGPTImageJSON(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${configStore.apiKey}`
    }
  }, sourceSignal)
}

async function resolveGPTResponsesFinalResponse(
  initialResponse: any,
  sourceSignal: AbortSignal
): Promise<any> {
  let response = initialResponse

  while (
    typeof response?.id === 'string' &&
    (
      response?.status === 'queued' ||
      response?.status === 'in_progress' ||
      (
        !hasGPTResponsesImageCall(response) &&
        !Array.isArray(response?.data) &&
        (
          response?.output == null ||
          (Array.isArray(response?.output) && response.output.length === 0)
        )
      )
    )
  ) {
    await delayWithSignal(GPT_RESPONSES_POLL_INTERVAL, sourceSignal)
    response = await retrieveGPTResponse(response.id, sourceSignal)
  }

  return response
}

function createGPTResponsesTerminalError(response: any): Error | null {
  const status = typeof response?.status === 'string' ? response.status : ''
  if (!status || status === 'completed') return null

  const diagnosticText = extractGPTResponsesOutputText(response)
  if (diagnosticText) {
    return new Error(`${status}: ${diagnosticText}`)
  }

  return new Error(`Responses API request ended with status: ${status}`)
}

function extractGPTImageUrlsFromResponse(response: any): string[] {
  const items = Array.isArray(response?.data) ? response.data : []
  const urls: string[] = []

  for (const item of items) {
    if (item.b64_json) {
      const mimeType = item.output_format
        ? getMimeTypeFromOutputFormat(item.output_format)
        : getMimeTypeFromOutputFormat(formGPT.value.outputFormat)
      const blob = base64ToBlob(item.b64_json, mimeType)
      urls.push(URL.createObjectURL(blob))
    } else if (item.url) {
      urls.push(item.url)
    }

    if (item.revised_prompt) {
      gptRevisedPrompt.value = item.revised_prompt
    }
  }

  if (urls.length === 0) {
    throw new Error(t('dalle.emptyResponse'))
  }

  return urls
}

function extractGPTImageUrlsFromResponsesResponse(response: any) {
  const output = Array.isArray(response?.output) ? response.output : []
  const imageCalls = output.filter((item: any): item is GPTResponsesImageGenerationCall =>
    item?.type === 'image_generation_call'
  )
  const nestedImageCalls = output.flatMap((item: any) =>
    Array.isArray(item?.content)
      ? item.content.filter((contentItem: any) => contentItem?.type === 'image_generation_call')
      : []
  ) as GPTResponsesImageGenerationCall[]
  const allImageCalls = [...imageCalls, ...nestedImageCalls]

  if (allImageCalls.length === 0 && Array.isArray(response?.data)) {
    const urls = extractGPTImageUrlsFromResponse(response)
    return {
      urls,
      revisedPrompt: '',
      responseId: typeof response?.id === 'string' ? response.id : null
    }
  }

  if (allImageCalls.length === 0) {
    const diagnosticText = extractGPTResponsesOutputText(response)
    if (diagnosticText) {
      throw new Error(`${t('dalle.responses.errors.noImageGenerationCall')} ${diagnosticText}`)
    }
    throw new Error(t('dalle.responses.errors.noImageGenerationCall'))
  }

  const urls: string[] = []
  let revisedPrompt = ''
  let imageCallId: string | null = null

  for (const item of allImageCalls) {
    if (typeof item.id === 'string' && item.id) {
      imageCallId = item.id
    }

    if (typeof item.revised_prompt === 'string' && item.revised_prompt.trim()) {
      revisedPrompt = item.revised_prompt.trim()
    }

    const resultList =
      typeof item.result === 'string'
        ? [item.result]
        : Array.isArray(item.result)
          ? item.result.filter((value: unknown): value is string => typeof value === 'string' && value.trim().length > 0)
          : []

    for (const result of resultList) {
      const mimeType = item.output_format
        ? getMimeTypeFromOutputFormat(item.output_format)
        : getMimeTypeFromOutputFormat(formGPT.value.outputFormat)
      const blob = base64ToBlob(result, mimeType)
      urls.push(URL.createObjectURL(blob))
    }
  }

  if (urls.length === 0) {
    const diagnosticText = extractGPTResponsesOutputText(response)
    if (diagnosticText) {
      throw new Error(`${t('dalle.responses.errors.noImageResult')} ${diagnosticText}`)
    }
    throw new Error(t('dalle.responses.errors.noImageResult'))
  }

  return {
    urls,
    revisedPrompt,
    responseId: typeof response?.id === 'string' ? response.id : null,
    imageCallId
  }
}

async function executeGPTResponsesRequest(
  buildBody: (options?: { stream?: boolean }) => Promise<Record<string, any>>,
  sourceSignal: AbortSignal
) {
  const url = configStore.baseUrl.replace(/\/$/, '') + '/v1/responses'
  let response: any

  try {
    response = await requestGPTResponses(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${configStore.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(await buildBody({ stream: true }))
    }, sourceSignal)
  } catch (error) {
    if (!isGPTImageStreamUnsupportedError(error)) {
      throw normalizeGPTResponsesError(error)
    }

    try {
      response = await requestGPTResponses(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${configStore.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(await buildBody())
      }, sourceSignal)
    } catch (fallbackError) {
      throw normalizeGPTResponsesError(fallbackError)
    }
  }

  if (response?.status !== 'completed' || !hasGPTResponsesImageCall(response)) {
    try {
      response = await resolveGPTResponsesFinalResponse(response, sourceSignal)
    } catch (error) {
      throw normalizeGPTResponsesError(error)
    }
  }

  const terminalError = createGPTResponsesTerminalError(response)
  if (terminalError) {
    throw normalizeGPTResponsesError(terminalError)
  }

  return extractGPTImageUrlsFromResponsesResponse(response)
}

function normalizeGPTResponsesError(error: unknown): Error {
  if (!(error instanceof Error)) {
    return new Error(String(error))
  }

  const messageText = error.message || ''

  if (/API 404|API 405|not found|no route|unknown path|unsupported endpoint/i.test(messageText)) {
    return new Error(t('dalle.responses.errors.endpointUnsupported'))
  }

  if (
    /image_generation|tool_choice|tool/i.test(messageText) &&
    /unsupported|not supported|unknown|unrecognized|invalid/i.test(messageText)
  ) {
    return new Error(t('dalle.responses.errors.toolUnsupported'))
  }

  if (
    /gpt-5\.4|model/i.test(messageText) &&
    /unsupported|not supported|not found|does not exist|unknown/i.test(messageText)
  ) {
    return new Error(t('dalle.responses.errors.modelUnsupported'))
  }

  return error
}

function revokeGPTImageUrls(urls: string[]) {
  urls.forEach(url => {
    try {
      URL.revokeObjectURL(url)
    } catch {
      // Ignore remote URLs and already released object URLs.
    }
  })
}

// ==================== GPT-Image Submit ====================
async function handleSubmitGPT() {
  if (!configStore.apiKey) {
    message.error(t('errors.missingApiKey'))
    return
  }
  if (!formGPT.value.prompt) {
    message.error(t('errors.missingPrompt'))
    return
  }
  if (isGPTCustomModel.value && !formGPT.value.customModel) {
    message.error(t('errors.missingModel'))
    return
  }

  const validationError = validateGPTRequest()
  if (validationError) {
    message.error(validationError)
    return
  }

  errorMessage.value = ''
  const isResponsesRequest = isGPTResponsesMode.value
  const continuingResponsesTurn = isResponsesRequest && isContinuingGPTResponsesConversation.value
  const previousPreviewUrls = [...gptImageUrls.value]
  const preserveExistingPreview = continuingResponsesTurn && previousPreviewUrls.length > 0

  if (!preserveExistingPreview) {
    gptRevisedPrompt.value = ''
    revokeGPTImageUrls(previousPreviewUrls)
    gptImageUrls.value = []
    imageUrl.value = ''
  }

  isLoading.value = true

  const ctrl = new AbortController()
  abortController.value = ctrl

  try {
    let generatedUrls: string[] = []
    let generatedRevisedPrompt = ''
    let responsesResponseId: string | null = null
    let responsesImageCallId: string | null = null

    if (gptMode.value === 'edit') {
      if (isResponsesRequest) {
        const parsedResponse = await executeGPTResponsesRequest(
          (options) => buildGPTResponsesRequestBody({ ...options, mode: 'edit' }),
          ctrl.signal
        )
        generatedUrls = parsedResponse.urls
        generatedRevisedPrompt = parsedResponse.revisedPrompt
        responsesResponseId = parsedResponse.responseId ?? null
        responsesImageCallId = parsedResponse.imageCallId ?? null
      } else {
        const url = configStore.baseUrl.replace(/\/$/, '') + '/v1/images/edits'

        if (gptEditInputSource.value === 'upload') {
          const fd = new FormData()
          fd.set('model', actualGPTModel.value)
          fd.set('prompt', formGPT.value.prompt)

          const uploadPayload = await prepareGPTEditUploadPayload()
          uploadPayload.images.forEach((file) => {
            fd.append('image[]', file, file.name)
          })

          if (uploadPayload.mask) {
            fd.set('mask', uploadPayload.mask, uploadPayload.mask.name)
          }

          appendGPTImageOptions(fd)

          const response = await requestGPTImageJSON(url, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${configStore.apiKey}`
            },
            body: fd
          }, ctrl.signal)
          generatedUrls = extractGPTImageUrlsFromResponse(response)
        } else {
          const body: Record<string, any> = {
            model: actualGPTModel.value,
            prompt: formGPT.value.prompt,
            images: gptReferenceImageUrls.value.map(imageUrl => ({ image_url: imageUrl }))
          }

          if (gptMaskUrl.value.trim()) {
            body.mask = { image_url: gptMaskUrl.value.trim() }
          }

          appendGPTImageOptions(body)

          const response = await requestGPTImageJSON(url, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${configStore.apiKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
          }, ctrl.signal)
          generatedUrls = extractGPTImageUrlsFromResponse(response)
        }
      }
    } else {
      if (isResponsesRequest) {
        const parsedResponse = await executeGPTResponsesRequest(
          (options) => buildGPTResponsesRequestBody({ ...options, mode: 'generate' }),
          ctrl.signal
        )
        generatedUrls = parsedResponse.urls
        generatedRevisedPrompt = parsedResponse.revisedPrompt
        responsesResponseId = parsedResponse.responseId ?? null
        responsesImageCallId = parsedResponse.imageCallId ?? null
      } else {
        const body: Record<string, any> = {
          model: actualGPTModel.value,
          prompt: formGPT.value.prompt
        }

        appendGPTImageOptions(body, { includeMultiple: true })

        const shouldUseGPTImageStream = actualGPTModel.value === 'gpt-image-2'
        if (shouldUseGPTImageStream) {
          body.stream = true
          body.partial_images = 0
        }

        const url = configStore.baseUrl.replace(/\/$/, '') + '/v1/images/generations'
        const requestInit = {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${configStore.apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(body)
        }

        let response: any
        try {
          response = await requestGPTImageJSON(url, requestInit, ctrl.signal)
        } catch (error) {
          if (!shouldUseGPTImageStream || !isGPTImageStreamUnsupportedError(error)) {
            throw error
          }

          delete body.stream
          delete body.partial_images
          response = await requestGPTImageJSON(url, {
            ...requestInit,
            body: JSON.stringify(body)
          }, ctrl.signal)
        }

        generatedUrls = extractGPTImageUrlsFromResponse(response)
      }
    }

    gptImageUrls.value = generatedUrls
    imageUrl.value = generatedUrls[0] || ''
    if (isResponsesRequest) {
      gptRevisedPrompt.value = generatedRevisedPrompt
    }

    if (preserveExistingPreview) {
      revokeGPTImageUrls(previousPreviewUrls)
    }

    if (isResponsesRequest) {
      responsesConversationActive.value = true
      responsesPreviousResponseId.value = responsesResponseId
      responsesLastResponseId.value = responsesResponseId
      responsesLastImageGenerationCallId.value = responsesImageCallId
      responsesTurnCount.value = continuingResponsesTurn ? responsesTurnCount.value + 1 : 1
    }

    const gptParams: GPTImageFormData = {
      prompt: formGPT.value.prompt,
      model: formGPT.value.model,
      customModel: formGPT.value.customModel,
      format: 'gpt-image',
      mode: gptMode.value,
      editInputSource: gptEditInputSource.value,
      size: resolvedGPTSize.value,
      sizePreset: formGPT.value.size,
      customSize: formGPT.value.customSize,
      quality: formGPT.value.quality,
      background: formGPT.value.background,
      outputFormat: formGPT.value.outputFormat,
      outputCompression: formGPT.value.outputCompression,
      n: formGPT.value.n,
      moderation: formGPT.value.moderation,
      apiMode: isResponsesRequest ? 'responses-api' : 'image-api',
      responsesModel: isResponsesRequest ? GPT_RESPONSES_MODEL : undefined,
      responsesTurnCount: isResponsesRequest ? responsesTurnCount.value : undefined,
      responsesContinued: isResponsesRequest ? continuingResponsesTurn : undefined,
      referenceImages: gptEditInputSource.value === 'upload' ? [...gptReferenceImages.value] : [],
      referenceImageUrls: gptEditInputSource.value === 'url' ? [...gptReferenceImageUrls.value] : [],
      referenceImageFileIds: gptEditInputSource.value === 'file-id' ? [...gptReferenceImageFileIds.value] : [],
      maskUrl: gptEditInputSource.value === 'url' ? gptMaskUrl.value.trim() : '',
      maskFileId: gptEditInputSource.value === 'file-id' ? gptMaskFileId.value.trim() : ''
    }
    historyStore.addItem({
      type: 'image',
      status: 'completed',
      params: gptParams,
      result: {
        thumbnail: generatedUrls[0]?.substring(0, 100)
      }
    })

    message.success(t('dalle.imageReady'))
  } catch (e: any) {
    if (e.name === 'AbortError') {
      message.info(t('common.cancel'))
    } else {
      errorMessage.value = e.message
    }
  } finally {
    isLoading.value = false
    abortController.value = null
  }
}

// ==================== Flux Submit ====================
async function handleSubmitFlux() {
  if (!configStore.apiKey) {
    message.error(t('errors.missingApiKey'))
    return
  }
  if (!formFlux.value.prompt) {
    message.error(t('errors.missingPrompt'))
    return
  }
  if (isFluxCustomModel.value && !formFlux.value.customModel) {
    message.error(t('errors.missingModel'))
    return
  }

  errorMessage.value = ''
  if (fluxImageUrl.value) URL.revokeObjectURL(fluxImageUrl.value)
  fluxImageUrl.value = ''
  fluxImageInfo.value = null
  isLoading.value = true

  const ctrl = new AbortController()
  abortController.value = ctrl

  try {
    const body: Record<string, any> = {
      model: actualFluxModel.value,
      prompt: formFlux.value.prompt,
      aspect_ratio: formFlux.value.aspectRatio,
      output_format: formFlux.value.outputFormat,
      safety_tolerance: formFlux.value.safetyTolerance,
      prompt_upsampling: formFlux.value.promptUpsampling
    }

    if (formFlux.value.seed !== null && formFlux.value.seed !== undefined) {
      body.seed = formFlux.value.seed
    }

    // Handle input image
    if (fluxInputImage.value) {
      const base64 = await fileToBase64(fluxInputImage.value)
      const mimeType = fluxInputImage.value.type || 'image/png'
      body.input_image = `data:${mimeType};base64,${base64}`
    } else if (formFlux.value.inputImageUrl.trim()) {
      body.input_image = formFlux.value.inputImageUrl.trim()
    }

    const url = configStore.baseUrl.replace(/\/$/, '') + '/v1/images/generations'
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${configStore.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body),
      signal: ctrl.signal
    })

    const text = await res.text()
    if (!res.ok) throw parseApiError(text, res.status)

    const response = JSON.parse(text)

    if (response.data) {
      for (const item of response.data) {
        if (item.b64_json) {
          const mimeType = `image/${formFlux.value.outputFormat === 'jpg' ? 'jpeg' : 'png'}`
          const blob = base64ToBlob(item.b64_json, mimeType)
          fluxImageUrl.value = URL.createObjectURL(blob)

          const img = new Image()
          img.onload = () => {
            fluxImageInfo.value = {
              width: img.naturalWidth,
              height: img.naturalHeight,
              size: (blob.size / 1024).toFixed(2) + ' KB',
              type: blob.type
            }
          }
          img.src = fluxImageUrl.value
        } else if (item.url) {
          fluxImageUrl.value = item.url
        }
      }
    }

    const fluxParams: FluxFormData = {
      prompt: formFlux.value.prompt,
      model: formFlux.value.model,
      customModel: formFlux.value.customModel,
      format: 'flux',
      inputImageUrl: formFlux.value.inputImageUrl,
      aspectRatio: formFlux.value.aspectRatio,
      outputFormat: formFlux.value.outputFormat,
      seed: formFlux.value.seed,
      safetyTolerance: formFlux.value.safetyTolerance,
      promptUpsampling: formFlux.value.promptUpsampling
    }
    historyStore.addItem({
      type: 'image',
      status: 'completed',
      params: fluxParams,
      result: {
        thumbnail: fluxImageUrl.value?.substring(0, 100)
      }
    })

    message.success(t('flux.imageReady'))
  } catch (e: any) {
    if (e.name === 'AbortError') {
      message.info(t('common.cancel'))
    } else {
      errorMessage.value = e.message
    }
  } finally {
    isLoading.value = false
    abortController.value = null
  }
}

// ==================== Gemini-Image Functions ====================
async function generateGeminiImage(model: string, contents: any, generationConfig: any, safetySettings?: any, tools?: any, signal?: AbortSignal) {
  const url = configStore.baseUrl.replace(/\/$/, '') + `/v1beta/models/${model}:generateContent?key=${configStore.apiKey}`

  const body: any = { contents, generationConfig }
  if (safetySettings) body.safetySettings = safetySettings
  if (tools) body.tools = tools

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal
  })

  const text = await res.text()
  if (!res.ok) throw parseApiError(text, res.status)

  return JSON.parse(text)
}

function extractImageFromResponse(response: any): { data: string; mimeType: string } {
  if (response.candidates?.[0]?.content?.parts) {
    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData?.data) {
        return {
          data: part.inlineData.data,
          mimeType: part.inlineData.mimeType || 'image/png'
        }
      }
    }
  }
  throw new Error('No image data in response')
}

async function handleSubmitAI() {
  if (!configStore.apiKey) {
    message.error(t('errors.missingApiKey'))
    return
  }
  if (!formAI.value.prompt) {
    message.error(t('errors.missingPrompt'))
    return
  }

  const model = formAI.value.model === 'custom' ? formAI.value.customModel : formAI.value.model
  if (!model) {
    message.error(t('errors.missingModel'))
    return
  }

  errorMessage.value = ''
  imageUrl.value = ''
  gptImageUrls.value = []
  isLoading.value = true

  const ctrl = new AbortController()
  abortController.value = ctrl

  try {
    const parts: any[] = [{ text: formAI.value.prompt }]

    for (const file of nanoReferenceImages.value.slice(0, 9)) {
      const base64 = await fileToBase64(file)
      parts.push({
        inlineData: {
          mimeType: file.type || 'image/png',
          data: base64
        }
      })
    }

    const contents = [{ role: 'user', parts }]

    const generationConfig: any = {
      responseModalities: ['IMAGE', 'TEXT'],
      temperature: formAI.value.temperature,
      topP: formAI.value.topP,
      maxOutputTokens: formAI.value.maxOutputTokens,
      imageConfig: {
        image_size: formAI.value.imageSize
      }
    }

    // Add aspect ratio if not auto
    if (formAI.value.aspectRatio !== 'auto') {
      generationConfig.imageConfig.aspectRatio = formAI.value.aspectRatio
    }

    // Add stop sequences if provided
    const stopSeqArray = formAI.value.stopSequences
      .split(',')
      .map(s => s.trim())
      .filter(s => s.length > 0)
    if (stopSeqArray.length > 0) {
      generationConfig.stopSequences = stopSeqArray
    }

    // Google Search tool based on user toggle
    const tools = formAI.value.googleSearch ? [{ googleSearch: {} }] : null

    const response = await generateGeminiImage(model, contents, generationConfig, null, tools, ctrl.signal)
    const imageData = extractImageFromResponse(response)
    const blob = base64ToBlob(imageData.data, imageData.mimeType)

    const img = new Image()
    img.onload = () => {
      imageInfo.value = {
        width: img.naturalWidth,
        height: img.naturalHeight,
        size: (blob.size / 1024).toFixed(2) + ' KB',
        type: blob.type
      }
    }
    imageUrl.value = URL.createObjectURL(blob)
    img.src = imageUrl.value

    const aiStudioParams: GeminiAIStudioFormData = {
      prompt: formAI.value.prompt,
      model: formAI.value.model,
      customModel: formAI.value.customModel,
      format: 'gemini-ai-studio',
      imageSize: formAI.value.imageSize,
      aspectRatio: formAI.value.aspectRatio,
      googleSearch: formAI.value.googleSearch,
      temperature: formAI.value.temperature,
      topP: formAI.value.topP,
      maxOutputTokens: formAI.value.maxOutputTokens,
      stopSequences: stopSeqArray,
      referenceImages: []
    }
    historyStore.addItem({
      type: 'image',
      status: 'completed',
      params: aiStudioParams
    })

    message.success(t('image.imageReady'))
  } catch (e: any) {
    if (e.name === 'AbortError') {
      message.info(t('common.cancel'))
    } else {
      errorMessage.value = e.message
    }
  } finally {
    isLoading.value = false
    abortController.value = null
  }
}

async function handleSubmitVertex() {
  if (!configStore.apiKey) {
    message.error(t('errors.missingApiKey'))
    return
  }
  if (!formVertex.value.prompt) {
    message.error(t('errors.missingPrompt'))
    return
  }

  const model = formVertex.value.model === 'custom' ? formVertex.value.customModel : formVertex.value.model
  if (!model) {
    message.error(t('errors.missingModel'))
    return
  }

  errorMessage.value = ''
  imageUrl.value = ''
  gptImageUrls.value = []
  isLoading.value = true

  const ctrl = new AbortController()
  abortController.value = ctrl

  try {
    const parts: any[] = [{ text: formVertex.value.prompt }]

    for (const file of nanoReferenceImages.value.slice(0, 9)) {
      const base64 = await fileToBase64(file)
      parts.push({
        inlineData: {
          mimeType: file.type || 'image/png',
          data: base64
        }
      })
    }

    const contents = [{ role: 'user', parts }]

    const generationConfig: any = {
      temperature: formVertex.value.temperature,
      maxOutputTokens: formVertex.value.maxOutputTokens,
      responseModalities: ['TEXT', 'IMAGE'],
      topP: formVertex.value.topP,
      imageConfig: {
        imageSize: formVertex.value.imageSize,
        imageOutputOptions: {
          mimeType: formVertex.value.outputMimeType
        },
        personGeneration: formVertex.value.personGeneration
      }
    }

    if (formVertex.value.aspectRatio !== 'auto') {
      generationConfig.imageConfig.aspectRatio = formVertex.value.aspectRatio
    }

    const safetySettings = [
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'OFF' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'OFF' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'OFF' },
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'OFF' }
    ]

    const response = await generateGeminiImage(model, contents, generationConfig, safetySettings, null, ctrl.signal)
    const imageData = extractImageFromResponse(response)
    const blob = base64ToBlob(imageData.data, imageData.mimeType)

    const img = new Image()
    img.onload = () => {
      imageInfo.value = {
        width: img.naturalWidth,
        height: img.naturalHeight,
        size: (blob.size / 1024).toFixed(2) + ' KB',
        type: blob.type
      }
    }
    imageUrl.value = URL.createObjectURL(blob)
    img.src = imageUrl.value

    const vertexParams: GeminiVertexFormData = {
      prompt: formVertex.value.prompt,
      model: formVertex.value.model,
      customModel: formVertex.value.customModel,
      format: 'gemini-vertex',
      imageSize: formVertex.value.imageSize,
      aspectRatio: formVertex.value.aspectRatio,
      outputMimeType: formVertex.value.outputMimeType,
      personGeneration: formVertex.value.personGeneration,
      temperature: formVertex.value.temperature,
      topP: formVertex.value.topP,
      maxOutputTokens: formVertex.value.maxOutputTokens,
      referenceImages: []
    }
    historyStore.addItem({
      type: 'image',
      status: 'completed',
      params: vertexParams
    })

    message.success(t('image.imageReady'))
  } catch (e: any) {
    if (e.name === 'AbortError') {
      message.info(t('common.cancel'))
    } else {
      errorMessage.value = e.message
    }
  } finally {
    isLoading.value = false
    abortController.value = null
  }
}

function handleCancel() {
  abortController.value?.abort()
}

function handleDownload(index?: number) {
  if (mainTab.value === 'gpt-image' && gptImageUrls.value.length > 0) {
    const idx = index ?? 0
    const url = gptImageUrls.value[idx]
    if (!url) return
    const a = document.createElement('a')
    a.href = url
    a.download = `gpt-image-${Date.now()}-${idx + 1}.${formGPT.value.outputFormat}`
    a.click()
  } else if (mainTab.value === 'flux' && fluxImageUrl.value) {
    const a = document.createElement('a')
    a.href = fluxImageUrl.value
    const ext = formFlux.value.outputFormat === 'jpg' ? 'jpg' : 'png'
    a.download = `flux-${Date.now()}.${ext}`
    a.click()
  } else if (imageUrl.value) {
    const a = document.createElement('a')
    a.href = imageUrl.value
    const ext = imageInfo.value?.type.split('/')[1] || 'png'
    a.download = `generated-${Date.now()}.${ext}`
    a.click()
  }
}

function openLightbox(index: number) {
  lightboxIndex.value = index
  showLightbox.value = true
}

onUnmounted(() => {
  abortController.value?.abort()
  if (imageUrl.value) URL.revokeObjectURL(imageUrl.value)
  if (fluxImageUrl.value) URL.revokeObjectURL(fluxImageUrl.value)
  revokeGPTImageUrls(gptImageUrls.value)
  if (gptMaskReferenceObjectUrl.value) URL.revokeObjectURL(gptMaskReferenceObjectUrl.value)
})
</script>

<template>
  <div class="page-container">
    <div class="page-header">
      <div class="header-row">
        <div>
          <h1 class="page-title gradient-text">{{ t('image.title') }}</h1>
          <p class="page-subtitle">{{ t('image.subtitle') }}</p>
        </div>
        <BatchModeSwitch v-model="isBatchMode" />
      </div>
    </div>

    <!-- Batch Mode -->
    <BatchImagePanel v-if="isBatchMode" />

    <!-- Single Mode -->
    <div v-else class="image-layout">
        <!-- Form Section -->
        <NCard class="glass-card form-card">
          <!-- Main Tabs -->
          <NTabs v-model:value="mainTab" type="segment" animated class="main-tabs">
            <!-- Nano Banana Tab (Gemini-Image) -->
            <NTabPane name="nano-banana" tab="Nano Banana">
              <!-- Sub-tabs for AI Studio vs Vertex -->
              <NTabs v-model:value="geminiSubTab" type="line" animated class="gemini-sub-tabs">
                <!-- AI Studio Format -->
                <NTabPane name="ai-studio" :tab="t('image.format.aiStudio')">
                  <NForm label-placement="left" label-width="140" class="form-content">
                    <!-- Provider Preset -->
                    <NFormItem :label="t('settings.providerPresets')">
                      <NSpace align="center" style="width: 100%">
                        <NSelect
                          :value="configStore.activePresetId"
                          :options="presetOptions"
                          @update:value="configStore.setActivePreset"
                          style="flex: 1; min-width: 180px"
                        />
                        <NTooltip>
                          <template #trigger>
                            <NTag :type="configStore.apiKey ? 'success' : 'warning'" size="small">
                              {{ configStore.apiKey ? 'API Key ✓' : 'API Key ✗' }}
                            </NTag>
                          </template>
                          {{ configStore.apiKey ? configStore.baseUrl : t('errors.missingApiKey') }}
                        </NTooltip>
                        <NButton text size="small" @click="goToSettings">
                          {{ t('image.editPreset') }}
                        </NButton>
                      </NSpace>
                    </NFormItem>

                    <!-- Prompt Template -->
                    <NFormItem v-if="configStore.imageTemplates.length > 0" :label="t('settings.promptTemplates')">
                      <NSelect
                        v-model:value="selectedTemplate"
                        :options="templateOptions"
                        clearable
                        :placeholder="t('settings.noTemplates')"
                      />
                    </NFormItem>

                    <!-- Model -->
                    <NFormItem :label="t('common.model')">
                      <NSpace vertical style="width: 100%">
                        <NSelect v-model:value="formAI.model" :options="geminiModelOptions" />
                        <NInput v-if="formAI.model === 'custom'" v-model:value="formAI.customModel" :placeholder="t('common.custom')" />
                      </NSpace>
                    </NFormItem>

                    <!-- Prompt -->
                    <NFormItem :label="t('image.prompt')">
                      <NInput
                        v-model:value="formAI.prompt"
                        type="textarea"
                        :rows="4"
                        :placeholder="t('image.promptPlaceholder')"
                      />
                    </NFormItem>

                    <!-- Reference Images -->
                    <NFormItem :label="t('image.referenceImages')">
                      <NUpload
                        accept="image/*"
                        :max="9"
                        multiple
                        list-type="image-card"
                        :default-upload="false"
                        @change="handleNanoImageChange"
                      />
                    </NFormItem>

                    <!-- Image Size -->
                    <NFormItem :label="t('image.imageSize')">
                      <NRadioGroup v-model:value="formAI.imageSize">
                        <NSpace>
                          <NRadio v-for="opt in imageSizeOptions" :key="opt.value" :value="opt.value">
                            {{ opt.label }}
                          </NRadio>
                        </NSpace>
                      </NRadioGroup>
                    </NFormItem>

                    <!-- Aspect Ratio -->
                    <NFormItem :label="t('image.aspectRatio')">
                      <NSelect v-model:value="formAI.aspectRatio" :options="aspectRatioOptions" />
                    </NFormItem>

                    <!-- Google Search -->
                    <NFormItem :label="t('image.googleSearch')">
                      <NSpace align="center">
                        <NSwitch v-model:value="formAI.googleSearch" />
                        <span class="form-hint">{{ t('image.googleSearchHint') }}</span>
                      </NSpace>
                    </NFormItem>

                    <!-- Temperature -->
                    <NFormItem :label="t('image.temperature')">
                      <div class="slider-container">
                        <NSlider v-model:value="formAI.temperature" :min="0" :max="1" :step="0.05" />
                        <NInputNumber v-model:value="formAI.temperature" :min="0" :max="1" :step="0.05" style="width: 80px" />
                      </div>
                    </NFormItem>

                    <!-- Top P -->
                    <NFormItem :label="t('image.topP')">
                      <div class="slider-container">
                        <NSlider v-model:value="formAI.topP" :min="0" :max="1" :step="0.05" />
                        <NInputNumber v-model:value="formAI.topP" :min="0" :max="1" :step="0.05" style="width: 80px" />
                      </div>
                    </NFormItem>

                    <!-- Max Tokens -->
                    <NFormItem :label="t('image.maxTokens')">
                      <div class="slider-container">
                        <NSlider v-model:value="formAI.maxOutputTokens" :min="1" :max="32768" :step="1024" />
                        <NInputNumber v-model:value="formAI.maxOutputTokens" :min="1" :max="32768" :step="1" style="width: 100px" />
                      </div>
                    </NFormItem>

                    <!-- Stop Sequences -->
                    <NFormItem :label="t('image.stopSequences')">
                      <NInput
                        v-model:value="formAI.stopSequences"
                        :placeholder="t('image.stopSequencesPlaceholder')"
                      />
                    </NFormItem>

                    <!-- Submit -->
                    <NFormItem label=" ">
                      <NSpace>
                        <NButton type="primary" :loading="isLoading" @click="handleSubmitAI">
                          {{ t('image.generate') }}
                        </NButton>
                        <NButton :disabled="!isLoading" @click="handleCancel">
                          {{ t('common.cancel') }}
                        </NButton>
                      </NSpace>
                    </NFormItem>
                  </NForm>
                </NTabPane>

                <!-- Vertex Format -->
                <NTabPane name="vertex" :tab="t('image.format.vertex')">
                  <NForm label-placement="left" label-width="140" class="form-content">
                    <!-- Provider Preset -->
                    <NFormItem :label="t('settings.providerPresets')">
                      <NSpace align="center" style="width: 100%">
                        <NSelect
                          :value="configStore.activePresetId"
                          :options="presetOptions"
                          @update:value="configStore.setActivePreset"
                          style="flex: 1; min-width: 180px"
                        />
                        <NTooltip>
                          <template #trigger>
                            <NTag :type="configStore.apiKey ? 'success' : 'warning'" size="small">
                              {{ configStore.apiKey ? 'API Key ✓' : 'API Key ✗' }}
                            </NTag>
                          </template>
                          {{ configStore.apiKey ? configStore.baseUrl : t('errors.missingApiKey') }}
                        </NTooltip>
                        <NButton text size="small" @click="goToSettings">
                          {{ t('image.editPreset') }}
                        </NButton>
                      </NSpace>
                    </NFormItem>

                    <!-- Prompt Template -->
                    <NFormItem v-if="configStore.imageTemplates.length > 0" :label="t('settings.promptTemplates')">
                      <NSelect
                        v-model:value="selectedTemplate"
                        :options="templateOptions"
                        clearable
                        :placeholder="t('settings.noTemplates')"
                      />
                    </NFormItem>

                    <!-- Model -->
                    <NFormItem :label="t('common.model')">
                      <NSpace vertical style="width: 100%">
                        <NSelect v-model:value="formVertex.model" :options="geminiModelOptions" />
                        <NInput v-if="formVertex.model === 'custom'" v-model:value="formVertex.customModel" :placeholder="t('common.custom')" />
                      </NSpace>
                    </NFormItem>

                    <!-- Prompt -->
                    <NFormItem :label="t('image.prompt')">
                      <NInput
                        v-model:value="formVertex.prompt"
                        type="textarea"
                        :rows="4"
                        :placeholder="t('image.promptPlaceholder')"
                      />
                    </NFormItem>

                    <!-- Reference Images -->
                    <NFormItem :label="t('image.referenceImages')">
                      <NUpload
                        accept="image/*"
                        :max="9"
                        multiple
                        list-type="image-card"
                        :default-upload="false"
                        @change="handleNanoImageChange"
                      />
                    </NFormItem>

                    <!-- Image Size -->
                    <NFormItem :label="t('image.imageSize')">
                      <NRadioGroup v-model:value="formVertex.imageSize">
                        <NSpace>
                          <NRadio v-for="opt in imageSizeOptions" :key="opt.value" :value="opt.value">
                            {{ opt.label }}
                          </NRadio>
                        </NSpace>
                      </NRadioGroup>
                    </NFormItem>

                    <!-- Aspect Ratio -->
                    <NFormItem :label="t('image.aspectRatio')">
                      <NSelect v-model:value="formVertex.aspectRatio" :options="aspectRatioOptions" />
                    </NFormItem>

                    <!-- Output Format -->
                    <NFormItem :label="t('image.outputFormat')">
                      <NRadioGroup v-model:value="formVertex.outputMimeType">
                        <NSpace>
                          <NRadio value="image/png">PNG</NRadio>
                          <NRadio value="image/jpeg">JPEG</NRadio>
                        </NSpace>
                      </NRadioGroup>
                    </NFormItem>

                    <!-- Person Generation -->
                    <NFormItem :label="t('image.personGeneration')">
                      <NRadioGroup v-model:value="formVertex.personGeneration">
                        <NSpace>
                          <NRadio v-for="opt in personOptions" :key="opt.value" :value="opt.value">
                            {{ opt.label }}
                          </NRadio>
                        </NSpace>
                      </NRadioGroup>
                    </NFormItem>

                    <!-- Temperature -->
                    <NFormItem :label="t('image.temperature')">
                      <div class="slider-container">
                        <NSlider v-model:value="formVertex.temperature" :min="0" :max="2" :step="0.1" />
                        <NInputNumber v-model:value="formVertex.temperature" :min="0" :max="2" :step="0.1" style="width: 80px" />
                      </div>
                    </NFormItem>

                    <!-- Top P -->
                    <NFormItem :label="t('image.topP')">
                      <div class="slider-container">
                        <NSlider v-model:value="formVertex.topP" :min="0" :max="1" :step="0.05" />
                        <NInputNumber v-model:value="formVertex.topP" :min="0" :max="1" :step="0.05" style="width: 80px" />
                      </div>
                    </NFormItem>

                    <!-- Max Tokens -->
                    <NFormItem :label="t('image.maxTokens')">
                      <div class="slider-container">
                        <NSlider v-model:value="formVertex.maxOutputTokens" :min="1024" :max="32768" :step="1024" />
                        <NInputNumber v-model:value="formVertex.maxOutputTokens" :min="1024" :max="32768" :step="1024" style="width: 100px" />
                      </div>
                    </NFormItem>

                    <!-- Submit -->
                    <NFormItem label=" ">
                      <NSpace>
                        <NButton type="primary" :loading="isLoading" @click="handleSubmitVertex">
                          {{ t('image.generate') }}
                        </NButton>
                        <NButton :disabled="!isLoading" @click="handleCancel">
                          {{ t('common.cancel') }}
                        </NButton>
                      </NSpace>
                    </NFormItem>
                  </NForm>
                </NTabPane>
              </NTabs>
            </NTabPane>

            <!-- GPT-Image Tab -->
            <NTabPane name="gpt-image" tab="GPT-Image">
              <NForm label-placement="left" label-width="140" class="form-content">
                <!-- Provider Preset -->
                <NFormItem :label="t('settings.providerPresets')">
                  <NSpace align="center" style="width: 100%">
                    <NSelect
                      :value="configStore.activePresetId"
                      :options="presetOptions"
                      @update:value="configStore.setActivePreset"
                      style="flex: 1; min-width: 180px"
                    />
                    <NTooltip>
                      <template #trigger>
                        <NTag :type="configStore.apiKey ? 'success' : 'warning'" size="small">
                          {{ configStore.apiKey ? 'API Key ✓' : 'API Key ✗' }}
                        </NTag>
                      </template>
                      {{ configStore.apiKey ? configStore.baseUrl : t('errors.missingApiKey') }}
                    </NTooltip>
                    <NButton text size="small" @click="goToSettings">
                      {{ t('image.editPreset') }}
                    </NButton>
                  </NSpace>
                </NFormItem>

                <!-- Mode Switch -->
                <NFormItem v-if="supportsEdit" :label="t('dalle.mode')">
                  <NRadioGroup v-model:value="gptMode">
                    <NSpace>
                      <NRadio value="generate">{{ t('dalle.modeGenerate') }}</NRadio>
                      <NRadio value="edit">{{ t('dalle.modeEdit') }}</NRadio>
                    </NSpace>
                  </NRadioGroup>
                </NFormItem>

                <NFormItem :label="t('dalle.requestModel')">
                  <div class="gpt-model-card-grid">
                    <button
                      v-for="option in gptGenerationRouteCards"
                      :key="option.key"
                      type="button"
                      class="gpt-model-card"
                      :class="{ 'is-active': option.active }"
                      @click="gptApiMode = option.key"
                    >
                      <div class="gpt-model-card-title">{{ option.title }}</div>
                      <div class="gpt-model-card-description">{{ option.description }}</div>
                    </button>
                  </div>
                </NFormItem>

                <NFormItem v-if="gptMode === 'generate' && !isGPTResponsesMode" :label="t('dalle.currentModel')">
                  <div class="gpt-current-model-card">
                    <div class="gpt-current-model-value">{{ currentGPTGenerateModelLabel }}</div>
                    <div class="form-hint">{{ currentGPTGenerationRouteDescription }}</div>
                  </div>
                </NFormItem>

                <!-- Model -->
                <NFormItem :label="t('common.model')">
                  <NSpace vertical style="width: 100%">
                    <template v-if="isGPTResponsesMode">
                      <div class="responses-model-card">
                        <div class="responses-model-name">{{ gptResponsesModelLabel }}</div>
                        <div v-if="gptModelDescriptionKey" class="model-description">
                          {{ t(gptModelDescriptionKey) }}
                        </div>
                        <div v-if="shouldShowGPT54ZetaTokenWarning" class="gpt-zeta-warning">
                          {{ t('dalle.responses.zetaTokenWarning') }}
                        </div>
                      </div>
                    </template>
                    <template v-else>
                      <NSelect v-model:value="formGPT.model" :options="gptModelOptions" />
                      <NInput v-if="isGPTCustomModel" v-model:value="formGPT.customModel" :placeholder="t('common.custom')" />
                      <div v-if="gptModelDescriptionKey" class="model-description">
                        {{ t(gptModelDescriptionKey) }}
                      </div>
                    </template>
                  </NSpace>
                </NFormItem>

                <!-- Prompt -->
                <NFormItem :label="t('dalle.prompt')" required>
                  <NInput
                    v-model:value="formGPT.prompt"
                    type="textarea"
                    :rows="4"
                    :placeholder="t('dalle.promptPlaceholder')"
                  />
                </NFormItem>

                <NFormItem v-if="isGPTResponsesMode" :label="t('dalle.responses.conversation')">
                  <div class="responses-conversation-card">
                    <div class="responses-conversation-meta">
                      <NTag size="small" :type="responsesConversationActive ? 'success' : 'default'">
                        {{ gptResponsesConversationStatusLabel }}
                      </NTag>
                      <NTag size="small" round>{{ gptResponsesTurnLabel }}</NTag>
                    </div>
                    <div class="form-hint">{{ gptResponsesConversationHint }}</div>
                    <NButton size="small" quaternary @click="resetGPTResponsesConversation()">
                      {{ t('dalle.responses.newConversation') }}
                    </NButton>
                  </div>
                </NFormItem>

                <!-- Edit Input Source -->
                <NFormItem v-if="gptMode === 'edit'" :label="t('dalle.editInputSource')">
                  <NSpace vertical style="width: 100%">
                    <NRadioGroup v-model:value="gptEditInputSource">
                      <NSpace>
                      <NRadio value="upload">{{ t('dalle.editInputSources.upload') }}</NRadio>
                      <NRadio value="url">{{ t('dalle.editInputSources.url') }}</NRadio>
                      <NRadio v-if="isGPTResponsesEditMode" value="file-id">
                        {{ t('dalle.editInputSources.fileId') }}
                      </NRadio>
                      </NSpace>
                    </NRadioGroup>
                    <div v-if="isGPTResponsesEditMode" class="form-hint">
                      {{ t('dalle.responses.editModeHint') }}
                    </div>
                  </NSpace>
                </NFormItem>

                <!-- Reference Images (Edit mode) -->
                <NFormItem
                  v-if="gptMode === 'edit' && gptEditInputSource === 'upload'"
                  :label="t('dalle.referenceImages')"
                >
                  <NUpload
                    accept="image/*"
                    :max="10"
                    multiple
                    list-type="image-card"
                    :default-upload="false"
                    @change="handleGPTImageChange"
                  />
                </NFormItem>

                <!-- Reference Image URLs (Edit mode) -->
                <NFormItem
                  v-if="gptMode === 'edit' && gptEditInputSource === 'url'"
                  :label="t('dalle.referenceImageUrls')"
                >
                  <NSpace vertical style="width: 100%">
                    <NInput
                      v-model:value="gptReferenceImageUrlsText"
                      type="textarea"
                      :rows="4"
                      :placeholder="t('dalle.referenceImageUrlsPlaceholder')"
                    />
                    <div class="form-hint">{{ t('dalle.referenceImageUrlsHint') }}</div>
                  </NSpace>
                </NFormItem>

                <NFormItem
                  v-if="gptMode === 'edit' && gptEditInputSource === 'file-id' && isGPTResponsesEditMode"
                  :label="t('dalle.referenceImageFileIds')"
                >
                  <NSpace vertical style="width: 100%">
                    <NInput
                      v-model:value="gptReferenceImageFileIdsText"
                      type="textarea"
                      :rows="4"
                      :placeholder="t('dalle.referenceImageFileIdsPlaceholder')"
                    />
                    <div class="form-hint">{{ t('dalle.referenceImageFileIdsHint') }}</div>
                  </NSpace>
                </NFormItem>

                <!-- Mask (Edit mode) -->
                <NFormItem
                  v-if="gptMode === 'edit' && gptEditInputSource === 'upload'"
                  :label="t('dalle.mask')"
                >
                  <NSpace vertical style="width: 100%">
                    <NAlert type="info" class="mask-editor-alert">
                      {{ t('dalle.maskEditor.scopeHint') }}
                    </NAlert>

                    <div v-if="!showGPTMaskEditor" class="form-hint">
                      {{ t('dalle.maskEditor.noReference') }}
                    </div>

                    <div v-else class="gpt-mask-editor">
                      <div class="gpt-mask-editor-header">
                        <div>
                          <div class="gpt-mask-editor-title">{{ t('dalle.maskEditor.title') }}</div>
                          <div class="gpt-mask-editor-subtitle">
                            {{ t('dalle.maskEditor.subtitle') }}
                          </div>
                        </div>
                        <NTag :type="gptMaskHasDrawing ? 'success' : 'default'" size="small">
                          {{ gptMaskHasDrawing ? t('dalle.maskEditor.maskReady') : t('dalle.maskEditor.noMask') }}
                        </NTag>
                      </div>

                      <div class="gpt-mask-toolbar">
                        <NSpace wrap align="center">
                          <NButton
                            size="small"
                            :type="gptMaskTool === 'brush' ? 'primary' : 'default'"
                            @click="gptMaskTool = 'brush'"
                          >
                            {{ t('dalle.maskEditor.brush') }}
                          </NButton>
                          <NButton
                            size="small"
                            :type="gptMaskTool === 'eraser' ? 'primary' : 'default'"
                            @click="gptMaskTool = 'eraser'"
                          >
                            {{ t('dalle.maskEditor.eraser') }}
                          </NButton>
                          <NButton
                            size="small"
                            :type="gptMaskTool === 'pan' ? 'primary' : 'default'"
                            @click="gptMaskTool = 'pan'"
                          >
                            {{ t('dalle.maskEditor.pan') }}
                          </NButton>
                        </NSpace>

                        <div class="gpt-mask-brush-control">
                          <span>{{ t('dalle.maskEditor.brushSize') }}</span>
                          <NSlider v-model:value="gptMaskBrushSize" :min="8" :max="240" :step="4" />
                          <NInputNumber
                            v-model:value="gptMaskBrushSize"
                            :min="8"
                            :max="240"
                            :step="4"
                            size="small"
                            style="width: 86px"
                          />
                        </div>
                      </div>

                      <div
                        ref="gptMaskViewportRef"
                        class="gpt-mask-stage"
                        :class="`tool-${gptMaskTool}`"
                        @pointerdown="handleGPTMaskPointerDown"
                        @pointermove="handleGPTMaskPointerMove"
                        @pointerup="handleGPTMaskPointerUp"
                        @pointercancel="handleGPTMaskPointerUp"
                        @wheel.prevent="handleGPTMaskWheel"
                      >
                        <div
                          v-if="gptMaskImageDimensions"
                          class="gpt-mask-canvas-stack"
                          :style="gptMaskCanvasStackStyle"
                        >
                          <canvas
                            ref="gptMaskBaseCanvas"
                            class="gpt-mask-base-canvas"
                            :width="gptMaskImageDimensions.width"
                            :height="gptMaskImageDimensions.height"
                          />
                          <canvas
                            ref="gptMaskDrawingCanvas"
                            class="gpt-mask-drawing-canvas"
                            :width="gptMaskImageDimensions.width"
                            :height="gptMaskImageDimensions.height"
                          />
                        </div>
                        <div v-else class="gpt-mask-loading">
                          {{ t('dalle.maskEditor.loading') }}
                        </div>
                      </div>

                      <div class="gpt-mask-actions">
                        <NSpace wrap align="center">
                          <NButton size="small" :disabled="!gptMaskCanUndo" @click="undoGPTMaskEdit">
                            {{ t('dalle.maskEditor.undo') }}
                          </NButton>
                          <NButton size="small" :disabled="!gptMaskCanRedo" @click="redoGPTMaskEdit">
                            {{ t('dalle.maskEditor.redo') }}
                          </NButton>
                          <NButton size="small" @click="clearGPTMaskDrawing">
                            {{ t('dalle.maskEditor.clear') }}
                          </NButton>
                          <NButton size="small" @click="invertGPTMaskDrawing">
                            {{ t('dalle.maskEditor.invert') }}
                          </NButton>
                          <NButton size="small" @click="fillGPTMaskDrawing">
                            {{ t('dalle.maskEditor.fill') }}
                          </NButton>
                          <NButton size="small" @click="downloadGPTMaskFile">
                            {{ t('dalle.maskEditor.download') }}
                          </NButton>
                        </NSpace>

                        <NSpace wrap align="center">
                          <NButton size="small" @click="adjustGPTMaskZoom(1 / 1.15)">-</NButton>
                          <span class="gpt-mask-zoom-label">{{ gptMaskZoomLabel }}</span>
                          <NButton size="small" @click="adjustGPTMaskZoom(1.15)">+</NButton>
                          <NButton size="small" @click="fitGPTMaskEditorView">
                            {{ t('dalle.maskEditor.fit') }}
                          </NButton>
                          <NButton size="small" @click="resetGPTMaskEditorView">
                            {{ t('dalle.maskEditor.resetView') }}
                          </NButton>
                        </NSpace>
                      </div>

                      <div class="gpt-mask-editor-footnote">
                        {{ t('dalle.maskEditor.exportHint') }}
                      </div>
                    </div>

                    <div class="gpt-mask-fallback">
                      <div class="gpt-mask-fallback-title">{{ t('dalle.maskEditor.fallbackTitle') }}</div>
                      <NUpload
                        :key="gptMaskUploadKey"
                        accept="image/png"
                        :max="1"
                        :default-upload="false"
                        @change="handleGPTMaskChange"
                      >
                        <NButton size="small">{{ t('dalle.uploadMask') }}</NButton>
                      </NUpload>
                      <div v-if="gptUploadedMaskImage && !gptMaskHasDrawing" class="form-hint">
                        {{ t('dalle.maskEditor.fallbackActive') }}
                      </div>
                      <div v-else class="form-hint">
                        {{ t('dalle.maskEditor.fallbackHint') }}
                      </div>
                    </div>
                  </NSpace>
                </NFormItem>

                <NFormItem
                  v-if="gptMode === 'edit' && gptEditInputSource === 'url'"
                  :label="t('dalle.maskUrl')"
                >
                  <NInput
                    v-model:value="gptMaskUrl"
                    :placeholder="t('dalle.maskUrlPlaceholder')"
                  />
                </NFormItem>

                <NFormItem
                  v-if="gptMode === 'edit' && gptEditInputSource === 'file-id' && isGPTResponsesEditMode"
                  :label="t('dalle.maskFileId')"
                >
                  <NInput
                    v-model:value="gptMaskFileId"
                    :placeholder="t('dalle.maskFileIdPlaceholder')"
                  />
                </NFormItem>

                <!-- Size -->
                <NFormItem :label="t('dalle.size')">
                  <NSpace vertical style="width: 100%">
                    <NSelect v-model:value="formGPT.size" :options="gptSizeOptions" />
                    <div v-if="showGPTCustomSizeInput" class="custom-size-editor">
                      <div class="custom-size-editor-header">
                        <span class="custom-size-editor-title">{{ t('dalle.customSizeEditor') }}</span>
                        <div class="custom-size-editor-actions">
                          <NButton size="small" quaternary @click="swapGPTCustomSizeDimensions">
                            {{ t('dalle.swapDimensions') }}
                          </NButton>
                          <NButton size="small" quaternary @click="snapGPTCustomSizeToStep">
                            {{ t('dalle.snapTo16') }}
                          </NButton>
                        </div>
                      </div>

                      <div class="custom-size-editor-grid">
                        <div
                          class="custom-size-number-group"
                          @wheel.capture.prevent.stop="handleGPTCustomSizeWheel('width', $event)"
                        >
                          <span class="custom-size-number-label">{{ t('dalle.customWidth') }}</span>
                          <NInputNumber
                            v-model:value="gptCustomSizeWidth"
                            :min="GPT_IMAGE_2_STEP"
                            :max="GPT_IMAGE_2_MAX_EDGE"
                            :step="GPT_IMAGE_2_STEP"
                          />
                        </div>
                        <div
                          class="custom-size-number-group"
                          @wheel.capture.prevent.stop="handleGPTCustomSizeWheel('height', $event)"
                        >
                          <span class="custom-size-number-label">{{ t('dalle.customHeight') }}</span>
                          <NInputNumber
                            v-model:value="gptCustomSizeHeight"
                            :min="GPT_IMAGE_2_STEP"
                            :max="GPT_IMAGE_2_MAX_EDGE"
                            :step="GPT_IMAGE_2_STEP"
                          />
                        </div>
                      </div>

                      <NInput
                        v-model:value="formGPT.customSize"
                        :placeholder="t('dalle.customSizePlaceholder')"
                      />

                      <div class="custom-size-visual-card">
                        <div class="custom-size-visual-frame">
                          <div
                            v-if="parsedGPTCustomSize"
                            class="custom-size-visual-box"
                            :style="gptCustomSizePreviewStyle"
                          >
                            <span>{{ parsedGPTCustomSize.width }} × {{ parsedGPTCustomSize.height }}</span>
                          </div>
                        </div>

                        <div class="custom-size-sidebar">
                          <div class="custom-size-metrics">
                            <div class="custom-size-metric">
                              <span class="custom-size-metric-label">{{ t('dalle.customSizeMetrics.ratio') }}</span>
                              <strong>{{ gptCustomSizeRatio ? `${gptCustomSizeRatio.toFixed(2)} : 1` : '—' }}</strong>
                            </div>
                            <div class="custom-size-metric">
                              <span class="custom-size-metric-label">{{ t('dalle.customSizeMetrics.pixels') }}</span>
                              <strong>{{ gptCustomSizePixels ? gptCustomSizePixels.toLocaleString() : '—' }}</strong>
                            </div>
                          </div>

                          <div class="custom-size-rules">
                            <div
                              v-for="item in gptCustomSizeConstraintItems"
                              :key="item.key"
                              class="custom-size-rule"
                              :class="{ 'is-valid': item.passed, 'is-invalid': !item.passed }"
                            >
                              <div class="custom-size-rule-main">
                                <span class="custom-size-rule-dot" />
                                <span>{{ item.label }}</span>
                              </div>
                              <span class="custom-size-rule-value">{{ item.value }}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div v-if="supportsFlexibleGPTSize" class="form-hint">
                      {{ t('dalle.customSizeHint') }}
                    </div>
                  </NSpace>
                </NFormItem>

                <!-- Quality -->
                <NFormItem v-if="supportsQuality" :label="t('dalle.quality')">
                  <NRadioGroup v-model:value="formGPT.quality">
                    <NSpace>
                      <NRadio v-for="opt in gptQualityOptions" :key="opt.value" :value="opt.value">
                        {{ opt.label }}
                      </NRadio>
                    </NSpace>
                  </NRadioGroup>
                </NFormItem>

                <!-- Background -->
                <NFormItem v-if="supportsBackground" :label="t('dalle.background')">
                  <NRadioGroup v-model:value="formGPT.background">
                    <NSpace>
                      <NRadio v-for="opt in gptBackgroundOptions" :key="opt.value" :value="opt.value">
                        {{ opt.label }}
                      </NRadio>
                    </NSpace>
                  </NRadioGroup>
                </NFormItem>

                <!-- Output Format -->
                <NFormItem v-if="supportsOutputFormat" :label="t('dalle.outputFormat')">
                  <NRadioGroup v-model:value="formGPT.outputFormat">
                    <NSpace>
                      <NRadio v-for="opt in gptOutputFormatOptions" :key="opt.value" :value="opt.value">
                        {{ opt.label }}
                      </NRadio>
                    </NSpace>
                  </NRadioGroup>
                </NFormItem>

                <!-- Compression -->
                <NFormItem v-if="supportsCompression" :label="t('dalle.compression')">
                  <div class="slider-container">
                    <NInputNumber
                      v-model:value="formGPT.outputCompression"
                      :min="0"
                      :max="100"
                      style="width: 100px"
                    />
                    <span class="slider-unit">%</span>
                  </div>
                </NFormItem>

                <!-- Number of images -->
                <NFormItem v-if="supportsMultiple && gptMode === 'generate'" :label="t('dalle.numberOfImages')">
                  <NInputNumber v-model:value="formGPT.n" :min="1" :max="10" />
                </NFormItem>

                <!-- Moderation -->
                <NFormItem v-if="supportsModeration" :label="t('dalle.moderation')">
                  <NRadioGroup v-model:value="formGPT.moderation">
                    <NSpace>
                      <NRadio v-for="opt in gptModerationOptions" :key="opt.value" :value="opt.value">
                        {{ opt.label }}
                      </NRadio>
                    </NSpace>
                  </NRadioGroup>
                </NFormItem>

                <!-- Submit -->
                <NFormItem label=" ">
                  <NSpace>
                    <NButton type="primary" :loading="isLoading" @click="handleSubmitGPT">
                      {{ gptMode === 'edit' ? t('dalle.edit') : t('dalle.generate') }}
                    </NButton>
                    <NButton :disabled="!isLoading" @click="handleCancel">
                      {{ t('common.cancel') }}
                    </NButton>
                  </NSpace>
                </NFormItem>
              </NForm>
            </NTabPane>

            <!-- Flux Tab -->
            <NTabPane name="flux" tab="Flux">
              <NForm label-placement="left" label-width="140" class="form-content">
                <!-- Provider Preset -->
                <NFormItem :label="t('settings.providerPresets')">
                  <NSpace align="center" style="width: 100%">
                    <NSelect
                      :value="configStore.activePresetId"
                      :options="presetOptions"
                      @update:value="configStore.setActivePreset"
                      style="flex: 1; min-width: 180px"
                    />
                    <NTooltip>
                      <template #trigger>
                        <NTag :type="configStore.apiKey ? 'success' : 'warning'" size="small">
                          {{ configStore.apiKey ? 'API Key ✓' : 'API Key ✗' }}
                        </NTag>
                      </template>
                      {{ configStore.apiKey ? configStore.baseUrl : t('errors.missingApiKey') }}
                    </NTooltip>
                    <NButton text size="small" @click="goToSettings">
                      {{ t('image.editPreset') }}
                    </NButton>
                  </NSpace>
                </NFormItem>

                <!-- Model -->
                <NFormItem :label="t('common.model')">
                  <NSpace vertical style="width: 100%">
                    <NSelect v-model:value="formFlux.model" :options="fluxModelOptions" />
                    <NInput v-if="isFluxCustomModel" v-model:value="formFlux.customModel" :placeholder="t('common.custom')" />
                    <div v-if="currentFluxModelInfo?.description" class="model-description">
                      {{ t(currentFluxModelInfo.description) }}
                    </div>
                  </NSpace>
                </NFormItem>

                <!-- Prompt -->
                <NFormItem :label="t('flux.prompt')" required>
                  <NInput
                    v-model:value="formFlux.prompt"
                    type="textarea"
                    :rows="4"
                    :placeholder="t('flux.promptPlaceholder')"
                  />
                </NFormItem>

                <!-- Input Image URL -->
                <NFormItem :label="t('flux.inputImageUrl')">
                  <NInput
                    v-model:value="formFlux.inputImageUrl"
                    :placeholder="t('flux.inputImageUrlPlaceholder')"
                    :disabled="!!fluxInputImage"
                  />
                </NFormItem>

                <!-- Upload Input Image -->
                <NFormItem :label="t('flux.uploadInputImage')">
                  <NUpload
                    accept="image/*"
                    :max="1"
                    :default-upload="false"
                    @change="handleFluxImageChange"
                    :disabled="!!formFlux.inputImageUrl.trim()"
                  >
                    <NButton :disabled="!!formFlux.inputImageUrl.trim()">{{ t('flux.selectImage') }}</NButton>
                  </NUpload>
                </NFormItem>

                <!-- Aspect Ratio -->
                <NFormItem :label="t('flux.aspectRatio')">
                  <NSelect v-model:value="formFlux.aspectRatio" :options="fluxAspectRatioOptions" />
                </NFormItem>

                <!-- Output Format -->
                <NFormItem :label="t('flux.outputFormat')">
                  <NRadioGroup v-model:value="formFlux.outputFormat">
                    <NSpace>
                      <NRadio v-for="opt in fluxOutputFormatOptions" :key="opt.value" :value="opt.value">
                        {{ opt.label }}
                      </NRadio>
                    </NSpace>
                  </NRadioGroup>
                </NFormItem>

                <!-- Seed -->
                <NFormItem :label="t('flux.seed')">
                  <NInputNumber
                    v-model:value="formFlux.seed"
                    :min="0"
                    :placeholder="t('flux.seedPlaceholder')"
                    clearable
                    style="width: 200px"
                  />
                </NFormItem>

                <!-- Safety Tolerance -->
                <NFormItem :label="t('flux.safetyTolerance')">
                  <div class="slider-container">
                    <NSlider v-model:value="formFlux.safetyTolerance" :min="0" :max="6" :step="1" :marks="{0: t('flux.safetyLevels.strict'), 6: t('flux.safetyLevels.loose')}" />
                    <NInputNumber v-model:value="formFlux.safetyTolerance" :min="0" :max="6" style="width: 80px" />
                  </div>
                </NFormItem>

                <!-- Prompt Upsampling -->
                <NFormItem :label="t('flux.promptUpsampling')">
                  <NRadioGroup v-model:value="formFlux.promptUpsampling">
                    <NSpace>
                      <NRadio :value="false">OFF</NRadio>
                      <NRadio :value="true">ON</NRadio>
                    </NSpace>
                  </NRadioGroup>
                </NFormItem>

                <!-- Submit -->
                <NFormItem label=" ">
                  <NSpace>
                    <NButton type="primary" :loading="isLoading" @click="handleSubmitFlux">
                      {{ t('flux.generate') }}
                    </NButton>
                    <NButton :disabled="!isLoading" @click="handleCancel">
                      {{ t('common.cancel') }}
                    </NButton>
                  </NSpace>
                </NFormItem>
              </NForm>
            </NTabPane>
          </NTabs>
        </NCard>

        <!-- Preview Section -->
        <div class="preview-section">
          <NCard class="glass-card preview-card">
            <template #header>
              <div class="preview-card-header">
                <div>
                  <div class="preview-card-title">{{ t('image.preview.title') }}</div>
                  <div class="preview-card-subtitle">{{ previewStatusText }}</div>
                </div>
                <NTag size="small" round>{{ previewModelLabel }}</NTag>
              </div>
            </template>

            <NAlert v-if="isLoading" type="warning" class="preview-notice">
              {{ t('image.preview.refreshNotice') }}
            </NAlert>

            <div v-if="mainTab === 'gpt-image'" class="responses-preview-card">
              <div class="responses-preview-meta">
                <NTag size="small" type="info">{{ currentGPTGenerationRouteLabel }}</NTag>
                <NTag size="small" round>{{ currentGPTGenerateModelLabel }}</NTag>
                <template v-if="isGPTResponsesMode">
                  <NTag size="small" :type="responsesConversationActive ? 'success' : 'default'">
                    {{ gptResponsesConversationStatusLabel }}
                  </NTag>
                  <NTag size="small" round>{{ gptResponsesTurnLabel }}</NTag>
                </template>
              </div>
              <div class="responses-preview-hint">
                {{ isGPTResponsesMode ? gptResponsesConversationHint : gptCurrentModelHint }}
              </div>
              <div v-if="isGPTResponsesMode && gptRevisedPrompt" class="responses-preview-revised">
                <div class="responses-preview-revised-title">{{ t('dalle.revisedPrompt') }}</div>
                <div class="responses-preview-revised-text">{{ gptRevisedPrompt }}</div>
              </div>
            </div>

            <NAlert v-if="gptRevisedPrompt && mainTab === 'gpt-image' && !isGPTResponsesMode" type="info" class="revised-prompt">
              <template #header>{{ t('dalle.revisedPrompt') }}</template>
              {{ gptRevisedPrompt }}
            </NAlert>

            <NAlert v-if="errorMessage" type="error" class="preview-error">
              {{ errorMessage }}
            </NAlert>

            <div class="preview-stage" :class="{ 'is-empty': !previewHasResult }">
              <NSpin :show="isLoading">
              <!-- GPT-Image Results (multiple images) -->
              <template v-if="mainTab === 'gpt-image' && gptImageUrls.length > 0 && !isGPTResponsesMode">
                <div class="images-grid">
                  <div
                    v-for="(url, idx) in gptImageUrls"
                    :key="idx"
                    class="image-item"
                    @click="openLightbox(idx)"
                  >
                    <img :src="url" alt="Generated" class="preview-image" />
                    <div class="image-overlay">
                      <NButton size="small" @click.stop="handleDownload(idx)">
                        {{ t('common.download') }}
                      </NButton>
                    </div>
                  </div>
                </div>
                <div class="preview-supporting-text">{{ t('image.preview.clickToZoom') }}</div>
              </template>

              <template v-else-if="mainTab === 'gpt-image' && gptImageUrls.length > 0">
                <div class="image-container" @click="openLightbox(0)">
                  <img :src="gptImageUrls[0]" class="preview-image" alt="Generated" />
                </div>

                <div class="preview-supporting-text">{{ t('image.preview.clickToZoom') }}</div>

                <NButton
                  type="primary"
                  block
                  style="margin-top: 16px"
                  @click="handleDownload(0)"
                >
                  {{ t('common.download') }}
                </NButton>
              </template>

              <!-- Nano Banana (Gemini-Image) Result (single image) -->
              <template v-else-if="imageUrl && mainTab === 'nano-banana'">
                <div class="image-container" @click="showLightbox = true">
                  <img :src="imageUrl" class="preview-image" alt="Generated" />
                </div>

                <div v-if="imageInfo" class="image-info">
                  {{ imageInfo.width }} × {{ imageInfo.height }} | {{ imageInfo.size }} | {{ imageInfo.type }}
                </div>

                <div class="preview-supporting-text">{{ t('image.preview.clickToZoom') }}</div>

                <NButton
                  type="primary"
                  block
                  style="margin-top: 16px"
                  @click="handleDownload()"
                >
                  {{ t('common.download') }}
                </NButton>
              </template>

              <!-- Flux Result (single image) -->
              <template v-else-if="fluxImageUrl && mainTab === 'flux'">
                <div class="image-container" @click="showLightbox = true">
                  <img :src="fluxImageUrl" class="preview-image" alt="Generated" />
                </div>

                <div v-if="fluxImageInfo" class="image-info">
                  {{ fluxImageInfo.width }} × {{ fluxImageInfo.height }} | {{ fluxImageInfo.size }} | {{ fluxImageInfo.type }}
                </div>

                <div class="preview-supporting-text">{{ t('image.preview.clickToZoom') }}</div>

                <NButton
                  type="primary"
                  block
                  style="margin-top: 16px"
                  @click="handleDownload()"
                >
                  {{ t('common.download') }}
                </NButton>
              </template>

              <!-- Placeholder -->
              <div v-else class="image-placeholder">
                <div class="placeholder-icon">🖼️</div>
                <div class="placeholder-badge">{{ previewModelLabel }}</div>
                <div class="placeholder-title">{{ previewEmptyTitle }}</div>
                <div class="placeholder-text">{{ previewEmptyDescription }}</div>
              </div>
            </NSpin>
            </div>
          </NCard>
        </div>
      </div>

    <!-- Lightbox -->
    <NModal v-model:show="showLightbox" preset="card" style="max-width: 90vw; background: transparent; border: none;">
      <div class="lightbox-content">
        <img
          :src="mainTab === 'gpt-image' ? gptImageUrls[lightboxIndex] : mainTab === 'flux' ? fluxImageUrl : imageUrl"
          class="lightbox-image"
          alt="Preview"
        />
        <div v-if="imageInfo && mainTab === 'nano-banana'" class="lightbox-info">
          {{ imageInfo.width }} × {{ imageInfo.height }} | {{ imageInfo.size }} | {{ imageInfo.type }}
        </div>
        <div v-if="fluxImageInfo && mainTab === 'flux'" class="lightbox-info">
          {{ fluxImageInfo.width }} × {{ fluxImageInfo.height }} | {{ fluxImageInfo.size }} | {{ fluxImageInfo.type }}
        </div>
        <NSpace justify="center" style="margin-top: 16px">
          <NButton @click="handleDownload(mainTab === 'gpt-image' ? lightboxIndex : undefined)">{{ t('common.download') }}</NButton>
          <NButton @click="showLightbox = false">{{ t('common.cancel') }}</NButton>
        </NSpace>
      </div>
    </NModal>
  </div>
</template>

<style scoped>
.page-container {
  max-width: 1400px;
  margin: 0 auto;
}

.page-header {
  margin-bottom: 24px;
}

.header-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
}

.page-title {
  font-size: 28px;
  font-weight: 700;
  margin: 0 0 8px 0;
  background: linear-gradient(135deg, #22d3ee, #a78bfa, #4ade80);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.page-subtitle {
  font-size: 14px;
  opacity: 0.7;
  margin: 0;
}

.form-content {
  margin-top: 16px;
}

.gemini-sub-tabs {
  margin-top: 8px;
}

.slider-container {
  display: flex;
  align-items: center;
  gap: 16px;
  width: 100%;
}

.slider-container :deep(.n-slider) {
  flex: 1;
  min-width: 200px;
}

.slider-unit {
  opacity: 0.7;
}

.main-tabs :deep(.n-tabs-nav-scroll-content) {
  display: flex;
}

.main-tabs :deep(.n-tabs-tab:nth-child(1)) {
  order: 2;
}

.main-tabs :deep(.n-tabs-tab:nth-child(2)) {
  order: 1;
}

.main-tabs :deep(.n-tabs-tab:nth-child(3)) {
  order: 3;
}

.image-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.12fr) minmax(360px, 0.88fr);
  gap: 24px;
  align-items: start;
}

@media (max-width: 1024px) {
  .image-layout {
    grid-template-columns: 1fr;
  }
}

.form-card {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.preview-section {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.preview-section > :last-child {
  flex: 1;
}

.preview-card {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.preview-card :deep(.n-card__content) {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.preview-card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.preview-card-title {
  font-size: 16px;
  font-weight: 700;
}

.preview-card-subtitle {
  margin-top: 4px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.62);
}

.preview-notice,
.preview-error,
.revised-prompt {
  margin-bottom: 0;
}

.preview-stage {
  flex: 1;
  min-height: 520px;
}

.preview-stage.is-empty {
  display: flex;
}

.preview-stage :deep(.n-spin-body),
.preview-stage :deep(.n-spin-container) {
  width: 100%;
  height: 100%;
}

.preview-stage :deep(.n-spin-container) {
  display: flex;
  flex-direction: column;
}

.preview-supporting-text {
  margin-top: 12px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.58);
  text-align: center;
}

.revised-prompt {
  margin-bottom: 0;
}

.model-description {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
  margin-top: 4px;
}

.form-hint {
  font-size: 12px;
  opacity: 0.6;
}

.gpt-model-card-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  width: 100%;
}

.gpt-model-card {
  appearance: none;
  width: 100%;
  padding: 16px;
  border-radius: 18px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background:
    radial-gradient(circle at top left, rgba(34, 211, 238, 0.08), transparent 42%),
    rgba(255, 255, 255, 0.02);
  text-align: left;
  color: inherit;
  cursor: pointer;
  transition: transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease;
}

.gpt-model-card:hover {
  transform: translateY(-1px);
  border-color: rgba(34, 211, 238, 0.24);
}

.gpt-model-card.is-active {
  border-color: rgba(34, 211, 238, 0.45);
  box-shadow: 0 14px 34px rgba(34, 211, 238, 0.12);
}

.gpt-model-card-title {
  font-size: 14px;
  font-weight: 700;
}

.gpt-model-card-description {
  margin-top: 8px;
  font-size: 12px;
  line-height: 1.65;
  color: rgba(255, 255, 255, 0.66);
}

.gpt-current-model-card,
.responses-model-card,
.responses-conversation-card,
.responses-preview-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px 16px;
  border-radius: 16px;
  border: 1px solid rgba(34, 211, 238, 0.16);
  background:
    radial-gradient(circle at top left, rgba(34, 211, 238, 0.1), transparent 40%),
    rgba(255, 255, 255, 0.02);
}

.gpt-current-model-value,
.responses-model-name {
  font-size: 14px;
  font-weight: 700;
}

.gpt-zeta-warning {
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid rgba(255, 107, 107, 0.35);
  background: rgba(255, 107, 107, 0.08);
  color: #ff8f8f;
  font-size: 12px;
  line-height: 1.6;
  font-weight: 600;
}

.responses-conversation-meta,
.responses-preview-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.responses-preview-hint {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.62);
}

.responses-preview-revised {
  padding-top: 10px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.responses-preview-revised-title {
  margin-bottom: 6px;
  font-size: 12px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.78);
}

.responses-preview-revised-text {
  font-size: 13px;
  line-height: 1.65;
  color: rgba(255, 255, 255, 0.72);
}

.custom-size-editor {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 16px;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.02);
}

.custom-size-editor-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.custom-size-editor-title {
  font-size: 13px;
  font-weight: 600;
}

.custom-size-editor-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.custom-size-editor-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.custom-size-number-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.custom-size-number-group :deep(.n-input-number) {
  width: 100%;
}

.custom-size-number-label {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.72);
}

.custom-size-visual-card {
  display: grid;
  grid-template-columns: minmax(0, 220px) minmax(0, 1fr);
  gap: 16px;
  align-items: start;
}

.custom-size-sidebar {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.custom-size-visual-frame {
  height: 180px;
  padding: 16px;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: linear-gradient(180deg, rgba(18, 26, 44, 0.9), rgba(13, 19, 33, 0.95));
  display: flex;
  align-items: center;
  justify-content: center;
}

.custom-size-visual-box {
  max-width: 100%;
  max-height: 100%;
  min-width: 40px;
  min-height: 40px;
  border-radius: 12px;
  border: 1px solid rgba(34, 211, 238, 0.55);
  background: linear-gradient(135deg, rgba(34, 211, 238, 0.18), rgba(167, 139, 250, 0.16));
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px;
  color: rgba(255, 255, 255, 0.9);
  font-size: 12px;
  text-align: center;
  box-shadow: 0 12px 32px rgba(34, 211, 238, 0.12);
}

.custom-size-metrics {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 12px;
}

.custom-size-metric {
  padding: 12px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
}

.custom-size-metric strong {
  display: block;
  margin-top: 6px;
  font-size: 14px;
}

.custom-size-metric-label {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.62);
}

.custom-size-rules {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.custom-size-rule {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  background: rgba(255, 255, 255, 0.02);
}

.custom-size-rule-main {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.custom-size-rule-dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  flex: 0 0 auto;
  background: rgba(250, 204, 21, 0.9);
}

.custom-size-rule.is-valid .custom-size-rule-dot {
  background: #4ade80;
}

.custom-size-rule.is-invalid .custom-size-rule-dot {
  background: #f59e0b;
}

.custom-size-rule-value {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
  white-space: nowrap;
}

.mask-editor-alert {
  margin-bottom: 4px;
}

.gpt-mask-editor {
  padding: 16px;
  border-radius: 18px;
  border: 1px solid rgba(34, 211, 238, 0.18);
  background:
    radial-gradient(circle at top left, rgba(34, 211, 238, 0.12), transparent 32%),
    linear-gradient(180deg, rgba(14, 20, 34, 0.9), rgba(9, 14, 24, 0.94));
}

.gpt-mask-editor-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}

.gpt-mask-editor-title {
  font-size: 15px;
  font-weight: 700;
}

.gpt-mask-editor-subtitle,
.gpt-mask-editor-footnote,
.gpt-mask-fallback .form-hint {
  margin-top: 4px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.62);
}

.gpt-mask-toolbar {
  display: grid;
  grid-template-columns: minmax(0, auto) minmax(220px, 1fr);
  gap: 14px;
  align-items: center;
  margin-bottom: 14px;
}

.gpt-mask-brush-control {
  display: grid;
  grid-template-columns: auto minmax(120px, 1fr) auto;
  gap: 10px;
  align-items: center;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.72);
}

.gpt-mask-stage {
  position: relative;
  height: 420px;
  overflow: hidden;
  border-radius: 18px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background:
    linear-gradient(45deg, rgba(255, 255, 255, 0.04) 25%, transparent 25%),
    linear-gradient(-45deg, rgba(255, 255, 255, 0.04) 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, rgba(255, 255, 255, 0.04) 75%),
    linear-gradient(-45deg, transparent 75%, rgba(255, 255, 255, 0.04) 75%),
    #0a0f1a;
  background-size: 24px 24px;
  background-position: 0 0, 0 12px, 12px -12px, -12px 0;
  touch-action: none;
  user-select: none;
}

.gpt-mask-stage.tool-brush,
.gpt-mask-stage.tool-eraser {
  cursor: crosshair;
}

.gpt-mask-stage.tool-pan {
  cursor: grab;
}

.gpt-mask-canvas-stack {
  position: absolute;
  left: 50%;
  top: 50%;
  transform-origin: center center;
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.36);
}

.gpt-mask-base-canvas,
.gpt-mask-drawing-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.gpt-mask-base-canvas {
  background: #0f172a;
}

.gpt-mask-drawing-canvas {
  mix-blend-mode: normal;
}

.gpt-mask-loading {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.62);
  font-size: 13px;
}

.gpt-mask-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 14px;
}

.gpt-mask-zoom-label {
  min-width: 48px;
  text-align: center;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.72);
}

.gpt-mask-fallback {
  padding: 14px;
  border-radius: 14px;
  border: 1px dashed rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.02);
}

.gpt-mask-fallback-title {
  margin-bottom: 8px;
  font-size: 13px;
  font-weight: 600;
}

/* GPT-Image multi-image grid */
.images-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 16px;
}

.image-item {
  position: relative;
  border-radius: 12px;
  overflow: hidden;
  cursor: pointer;
  transition: transform 0.2s ease;
}

.image-item:hover {
  transform: scale(1.02);
}

.image-item:hover .image-overlay {
  opacity: 1;
}

.image-item .preview-image {
  width: 100%;
  height: auto;
  display: block;
}

.image-overlay {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 12px;
  background: linear-gradient(transparent, rgba(0, 0, 0, 0.7));
  display: flex;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.2s ease;
}

/* Single image container */
.image-container {
  aspect-ratio: 1;
  border-radius: 12px;
  overflow: hidden;
  cursor: pointer;
  transition: transform 0.2s ease;
}

.image-container:hover {
  transform: scale(1.02);
}

.dark .image-container {
  background: rgba(0, 0, 0, 0.3);
}

.light .image-container {
  background: rgba(0, 0, 0, 0.05);
}

.image-container .preview-image {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.image-placeholder {
  width: 100%;
  min-height: 520px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  padding: 32px;
  border: 1px dashed rgba(255, 255, 255, 0.14);
  border-radius: 24px;
  background:
    radial-gradient(circle at top, rgba(34, 211, 238, 0.1), transparent 38%),
    linear-gradient(180deg, rgba(20, 26, 42, 0.92), rgba(12, 18, 30, 0.96));
}

.placeholder-icon {
  display: none;
}

.placeholder-badge {
  padding: 6px 12px;
  border-radius: 999px;
  background: rgba(34, 211, 238, 0.12);
  border: 1px solid rgba(34, 211, 238, 0.22);
  color: #67e8f9;
  font-size: 12px;
  font-weight: 600;
}

.placeholder-title {
  font-size: 22px;
  font-weight: 700;
  text-align: center;
  max-width: 22ch;
}

.placeholder-text {
  font-size: 14px;
  line-height: 1.7;
  color: rgba(255, 255, 255, 0.62);
  text-align: center;
  max-width: 34ch;
}

.image-info {
  margin-top: 12px;
  font-size: 13px;
  opacity: 0.7;
  text-align: center;
}

.lightbox-content {
  text-align: center;
}

.lightbox-image {
  max-width: 100%;
  max-height: 70vh;
  border-radius: 8px;
}

.lightbox-info {
  margin-top: 12px;
  font-size: 14px;
  opacity: 0.8;
}

@media (max-width: 640px) {
  .gpt-model-card-grid {
    grid-template-columns: 1fr;
  }

  .custom-size-editor-header {
    flex-direction: column;
    align-items: stretch;
  }

  .custom-size-visual-card {
    grid-template-columns: 1fr;
  }

  .custom-size-editor-grid,
  .custom-size-metrics {
    grid-template-columns: 1fr;
  }

  .gpt-mask-editor-header,
  .gpt-mask-actions {
    flex-direction: column;
    align-items: stretch;
  }

  .gpt-mask-toolbar,
  .gpt-mask-brush-control {
    grid-template-columns: 1fr;
  }

  .gpt-mask-stage {
    height: 320px;
  }

  .preview-card-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .image-placeholder {
    min-height: 360px;
    padding: 24px;
  }

  .placeholder-title {
    font-size: 18px;
  }
}
</style>
