<script setup lang="ts">
import { ref, computed, watch, onUnmounted, onMounted } from 'vue'
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
import type { GPTImageFormData, FluxFormData, GeminiAIStudioFormData, GeminiVertexFormData } from '@/types'
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

type GPTEditInputSource = 'upload' | 'url'

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

const GPT_IMAGE_2_MIN_PIXELS = 655360
const GPT_IMAGE_2_MAX_PIXELS = 8294400
const GPT_IMAGE_2_MAX_EDGE = 3840
const GPT_IMAGE_2_STEP = 16
const GPT_IMAGE_2_MAX_RATIO = 3

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
const gptEditInputSource = ref<GPTEditInputSource>('upload')
const gptReferenceImages = ref<File[]>([])
const gptReferenceImageUrls = ref<string[]>([])
const gptMaskImage = ref<File | null>(null)
const gptMaskUrl = ref('')
const gptImageUrls = ref<string[]>([])
const gptRevisedPrompt = ref('')
const isHydratingGPTSettings = ref(false)

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

const currentGPTCapabilities = computed(() =>
  GPT_MODEL_CAPABILITIES[formGPT.value.model] || GPT_MODEL_CAPABILITIES['gpt-image-2']
)

const gptSizeOptions = computed(() => {
  const options = currentGPTCapabilities.value.supportsFlexibleSize
    ? [...GPT_IMAGE_2_SIZE_OPTIONS]
    : [...(GPT_LEGACY_SIZE_OPTIONS[formGPT.value.model] || GPT_LEGACY_SIZE_OPTIONS['gpt-image-1'])]

  if (currentGPTCapabilities.value.supportsFlexibleSize) {
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
  if (currentGPTCapabilities.value.supportsTransparentBackground) {
    options.push({ label: t('dalle.backgroundOptions.transparent'), value: 'transparent' })
  }
  if (currentGPTCapabilities.value.supportsBackground) {
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

const supportsQuality = computed(() => currentGPTCapabilities.value.supportsQuality)
const supportsBackground = computed(() => currentGPTCapabilities.value.supportsBackground)
const supportsOutputFormat = computed(() => currentGPTCapabilities.value.supportsOutputFormat)
const supportsCompression = computed(() =>
  currentGPTCapabilities.value.supportsCompression &&
  (formGPT.value.outputFormat === 'jpeg' || formGPT.value.outputFormat === 'webp')
)
const supportsMultiple = computed(() => currentGPTCapabilities.value.supportsMultiple)
const supportsEdit = computed(() => currentGPTCapabilities.value.supportsEdit)
const supportsFlexibleGPTSize = computed(() => currentGPTCapabilities.value.supportsFlexibleSize)
const supportsModeration = computed(() => currentGPTCapabilities.value.supportsModeration)
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

function validateGPTRequest(): string | null {
  if (gptMode.value === 'edit') {
    if (gptEditInputSource.value === 'upload' && gptReferenceImages.value.length === 0) {
      return t('dalle.referenceImagesRequired')
    }

    if (gptEditInputSource.value === 'url' && gptReferenceImageUrls.value.length === 0) {
      return t('dalle.referenceImageUrlsRequired')
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

  if (options.includeMultiple && supportsMultiple.value) {
    setValue('n', formGPT.value.n)
  }

  if (resolvedGPTSize.value !== 'auto') {
    setValue('size', resolvedGPTSize.value)
  }

  if (supportsQuality.value) {
    setValue('quality', formGPT.value.quality)
  }

  if (supportsBackground.value) {
    setValue('background', formGPT.value.background)
  }

  if (supportsOutputFormat.value) {
    setValue('output_format', formGPT.value.outputFormat)
    if (supportsCompression.value) {
      setValue('output_compression', formGPT.value.outputCompression)
    }
  }

  if (supportsModeration.value) {
    setValue('moderation', formGPT.value.moderation)
  }
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

watch(() => formGPT.value.size, (newSize, oldSize) => {
  if (
    newSize === 'custom' &&
    oldSize !== 'custom' &&
    !parsedGPTCustomSize.value
  ) {
    formGPT.value.customSize = '1024x1024'
  }
})

watch(gptEditInputSource, (source) => {
  if (source === 'upload') {
    gptReferenceImageUrls.value = []
    gptMaskUrl.value = ''
  } else {
    gptReferenceImages.value = []
    gptMaskImage.value = null
  }
})

watch(formGPT, () => {
  saveGPTSettings()
}, { deep: true })

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
      gptEditInputSource.value = settings.editInputSource || 'upload'
    } catch {
      // Ignore
    }
  }
  normalizeGPTSizeForModel(formGPT.value.model)
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
  if (mainTab.value === 'gpt-image') return 'GPT-Image'
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
  if (mainTab.value === 'gpt-image') return t('image.preview.empty.gptImageTitle')
  if (mainTab.value === 'flux') return t('image.preview.empty.fluxTitle')
  return t('image.preview.empty.nanoBananaTitle')
})

const previewEmptyDescription = computed(() => {
  if (mainTab.value === 'gpt-image') return t('image.preview.empty.gptImageDescription')
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

onMounted(() => {
  loadGPTSettings()
  loadFluxSettings()
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
  gptMaskImage.value = file || null
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

function base64ToBlob(base64: string, mimeType: string): Blob {
  const byteCharacters = atob(base64)
  const byteNumbers = new Array(byteCharacters.length)
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i)
  }
  const byteArray = new Uint8Array(byteNumbers)
  return new Blob([byteArray], { type: mimeType })
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
  gptRevisedPrompt.value = ''
  gptImageUrls.value.forEach(url => URL.revokeObjectURL(url))
  gptImageUrls.value = []
  imageUrl.value = ''
  isLoading.value = true

  const ctrl = new AbortController()
  abortController.value = ctrl

  try {
    let response: any

    if (gptMode.value === 'edit') {
      const url = configStore.baseUrl.replace(/\/$/, '') + '/v1/images/edits'

      if (gptEditInputSource.value === 'upload') {
        const fd = new FormData()
        fd.set('model', actualGPTModel.value)
        fd.set('prompt', formGPT.value.prompt)

        gptReferenceImages.value.forEach((file) => {
          fd.append('image[]', file, file.name)
        })

        if (gptMaskImage.value) {
          fd.set('mask', gptMaskImage.value, gptMaskImage.value.name)
        }

        appendGPTImageOptions(fd)

        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${configStore.apiKey}`
          },
          body: fd,
          signal: ctrl.signal
        })

        const text = await res.text()
        if (!res.ok) throw parseApiError(text, res.status)
        response = JSON.parse(text)
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
        response = JSON.parse(text)
      }
    } else {
      const body: Record<string, any> = {
        model: actualGPTModel.value,
        prompt: formGPT.value.prompt
      }

      appendGPTImageOptions(body, { includeMultiple: true })

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
      response = JSON.parse(text)
    }

    if (response.data) {
      const urls: string[] = []
      for (const item of response.data) {
        if (item.b64_json) {
          const mimeType = getMimeTypeFromOutputFormat(formGPT.value.outputFormat)
          const blob = base64ToBlob(item.b64_json, mimeType)
          urls.push(URL.createObjectURL(blob))
        } else if (item.url) {
          urls.push(item.url)
        }
        if (item.revised_prompt) {
          gptRevisedPrompt.value = item.revised_prompt
        }
      }
      gptImageUrls.value = urls
      if (urls.length > 0) {
        imageUrl.value = urls[0]
      }
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
      referenceImages: gptEditInputSource.value === 'upload' ? [...gptReferenceImages.value] : [],
      referenceImageUrls: gptEditInputSource.value === 'url' ? [...gptReferenceImageUrls.value] : [],
      maskUrl: gptEditInputSource.value === 'url' ? gptMaskUrl.value.trim() : ''
    }
    historyStore.addItem({
      type: 'image',
      status: 'completed',
      params: gptParams,
      result: {
        thumbnail: gptImageUrls.value[0]?.substring(0, 100)
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
  gptImageUrls.value.forEach(url => URL.revokeObjectURL(url))
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

                <!-- Model -->
                <NFormItem :label="t('common.model')">
                  <NSpace vertical style="width: 100%">
                    <NSelect v-model:value="formGPT.model" :options="gptModelOptions" />
                    <NInput v-if="isGPTCustomModel" v-model:value="formGPT.customModel" :placeholder="t('common.custom')" />
                    <div v-if="currentGPTModelInfo?.description" class="model-description">
                      {{ t(currentGPTModelInfo.description) }}
                    </div>
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

                <!-- Edit Input Source -->
                <NFormItem v-if="gptMode === 'edit'" :label="t('dalle.editInputSource')">
                  <NRadioGroup v-model:value="gptEditInputSource">
                    <NSpace>
                      <NRadio value="upload">{{ t('dalle.editInputSources.upload') }}</NRadio>
                      <NRadio value="url">{{ t('dalle.editInputSources.url') }}</NRadio>
                    </NSpace>
                  </NRadioGroup>
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

                <!-- Mask (Edit mode) -->
                <NFormItem
                  v-if="gptMode === 'edit' && gptEditInputSource === 'upload'"
                  :label="t('dalle.mask')"
                >
                  <NUpload
                    accept="image/png"
                    :max="1"
                    :default-upload="false"
                    @change="handleGPTMaskChange"
                  >
                    <NButton>{{ t('dalle.uploadMask') }}</NButton>
                  </NUpload>
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

            <NAlert v-if="gptRevisedPrompt && mainTab === 'gpt-image'" type="info" class="revised-prompt">
              <template #header>{{ t('dalle.revisedPrompt') }}</template>
              {{ gptRevisedPrompt }}
            </NAlert>

            <NAlert v-if="errorMessage" type="error" class="preview-error">
              {{ errorMessage }}
            </NAlert>

            <div class="preview-stage" :class="{ 'is-empty': !previewHasResult }">
              <NSpin :show="isLoading">
              <!-- GPT-Image Results (multiple images) -->
              <template v-if="mainTab === 'gpt-image' && gptImageUrls.length > 0">
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
