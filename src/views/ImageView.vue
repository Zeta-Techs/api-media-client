<script setup lang="ts">
import { ref, computed, watch, onUnmounted, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  NCard, NForm, NFormItem, NInput, NSelect, NButton, NSpace,
  NInputNumber, NUpload, NAlert, NSpin, NTabs, NTabPane,
  NRadioGroup, NRadio, NSlider, NModal, NTag, NTooltip,
  type UploadFileInfo
} from 'naive-ui'
import { useConfigStore } from '@/stores/config'
import { useHistoryStore } from '@/stores/history'
import { message } from '@/composables/useNaiveMessage'
import { parseApiError } from '@/utils/api'
import type { GPTImageFormData, FluxFormData, GeminiAIStudioFormData, GeminiVertexFormData } from '@/types'

const { t } = useI18n()
const configStore = useConfigStore()
const historyStore = useHistoryStore()

// Main tab: Nano Banana (Gemini), GPT-Image, Flux
const mainTab = ref<'nano-banana' | 'gpt-image' | 'flux'>('nano-banana')
// Sub-tab for Nano Banana (Gemini-Image)
const geminiSubTab = ref<'ai-studio' | 'vertex'>('ai-studio')

// Local storage keys
const DALLE_SETTINGS_KEY = 'dalle-form-settings'
const FLUX_SETTINGS_KEY = 'flux-form-settings'

// ==================== GPT-Image (DALL·E) Form State ====================
const formGPT = ref({
  prompt: '',
  model: 'gpt-image-1',
  customModel: '',
  size: '1024x1024',
  quality: 'auto',
  background: 'auto',
  outputFormat: 'png',
  outputCompression: 100,
  n: 1,
  moderation: 'auto'
})

const gptMode = ref<'generate' | 'edit'>('generate')
const gptReferenceImages = ref<File[]>([])
const gptMaskImage = ref<File | null>(null)
const gptImageUrls = ref<string[]>([])
const gptRevisedPrompt = ref('')

// ==================== Gemini-Image Form States ====================
// Form state - AI Studio
const formAI = ref({
  prompt: '',
  model: 'gemini-3-pro-image-preview-flatfee',
  customModel: '',
  imageSize: '1K'
})

// Form state - Vertex
const formVertex = ref({
  prompt: '',
  model: 'gemini-3-pro-image-preview-flatfee',
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

const gptSizeOptionsMap: Record<string, Array<{ label: string; value: string }>> = {
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

const gptSizeOptions = computed(() => {
  if (formGPT.value.model === 'custom') return gptSizeOptionsMap['gpt-image-1']
  return gptSizeOptionsMap[formGPT.value.model] || gptSizeOptionsMap['gpt-image-1']
})

const gptQualityOptions = computed(() => [
  { label: t('dalle.qualityOptions.auto'), value: 'auto' },
  { label: t('dalle.qualityOptions.low'), value: 'low' },
  { label: t('dalle.qualityOptions.medium'), value: 'medium' },
  { label: t('dalle.qualityOptions.high'), value: 'high' }
])

const gptBackgroundOptions = computed(() => [
  { label: t('dalle.backgroundOptions.auto'), value: 'auto' },
  { label: t('dalle.backgroundOptions.transparent'), value: 'transparent' },
  { label: t('dalle.backgroundOptions.opaque'), value: 'opaque' }
])

const gptOutputFormatOptions = [
  { label: 'PNG', value: 'png' },
  { label: 'JPEG', value: 'jpeg' },
  { label: 'WebP', value: 'webp' }
]

const gptModerationOptions = computed(() => [
  { label: t('dalle.moderationOptions.auto'), value: 'auto' },
  { label: t('dalle.moderationOptions.low'), value: 'low' }
])

const isGPTCustomModel = computed(() => formGPT.value.model === 'custom')
const actualGPTModel = computed(() =>
  isGPTCustomModel.value ? formGPT.value.customModel : formGPT.value.model
)

const currentGPTModelInfo = computed(() => {
  return gptModelOptions.find(m => m.value === formGPT.value.model)
})

const supportsQuality = computed(() =>
  formGPT.value.model === 'gpt-image-1' || formGPT.value.model === 'dall-e-3' || formGPT.value.model === 'custom'
)

const supportsTransparency = computed(() =>
  formGPT.value.model === 'gpt-image-1' || formGPT.value.model === 'custom'
)

const supportsCompression = computed(() =>
  (formGPT.value.model === 'gpt-image-1' || formGPT.value.model === 'custom') &&
  (formGPT.value.outputFormat === 'jpeg' || formGPT.value.outputFormat === 'webp')
)

const supportsMultiple = computed(() =>
  formGPT.value.model === 'gpt-image-1' || formGPT.value.model === 'dall-e-2' || formGPT.value.model === 'custom'
)

const supportsEdit = computed(() =>
  formGPT.value.model === 'gpt-image-1' || formGPT.value.model === 'dall-e-2' || formGPT.value.model === 'custom'
)

// Watch GPT model changes
watch(() => formGPT.value.model, (newModel) => {
  const options = gptSizeOptionsMap[newModel] || gptSizeOptionsMap['gpt-image-1']
  if (!options.find(o => o.value === formGPT.value.size)) {
    formGPT.value.size = options[0]?.value || '1024x1024'
  }
  if (newModel === 'dall-e-3') {
    formGPT.value.n = 1
  }
  saveGPTSettings()
})

watch(formGPT, () => {
  saveGPTSettings()
}, { deep: true })

function saveGPTSettings() {
  const settings = {
    model: formGPT.value.model,
    customModel: formGPT.value.customModel,
    size: formGPT.value.size,
    quality: formGPT.value.quality,
    background: formGPT.value.background,
    outputFormat: formGPT.value.outputFormat,
    outputCompression: formGPT.value.outputCompression,
    n: formGPT.value.n,
    moderation: formGPT.value.moderation
  }
  localStorage.setItem(DALLE_SETTINGS_KEY, JSON.stringify(settings))
}

function loadGPTSettings() {
  const saved = localStorage.getItem(DALLE_SETTINGS_KEY)
  if (saved) {
    try {
      const settings = JSON.parse(saved)
      formGPT.value.model = settings.model || 'gpt-image-1'
      formGPT.value.customModel = settings.customModel || ''
      formGPT.value.size = settings.size || '1024x1024'
      formGPT.value.quality = settings.quality || 'auto'
      formGPT.value.background = settings.background || 'auto'
      formGPT.value.outputFormat = settings.outputFormat || 'png'
      formGPT.value.outputCompression = settings.outputCompression ?? 100
      formGPT.value.n = settings.n || 1
      formGPT.value.moderation = settings.moderation || 'auto'
    } catch {
      // Ignore
    }
  }
}

// ==================== Gemini-Image Options ====================
const geminiModelOptions = [
  { label: 'gemini-3-pro-image-preview-flatfee (Pro 按次计费)', value: 'gemini-3-pro-image-preview-flatfee' },
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

    if (gptMode.value === 'edit' && gptReferenceImages.value.length > 0) {
      const fd = new FormData()
      fd.set('model', actualGPTModel.value)
      fd.set('prompt', formGPT.value.prompt)

      gptReferenceImages.value.forEach((file) => {
        fd.append('image[]', file, file.name)
      })

      if (gptMaskImage.value) {
        fd.set('mask', gptMaskImage.value, gptMaskImage.value.name)
      }

      if (formGPT.value.size !== 'auto') {
        fd.set('size', formGPT.value.size)
      }

      const url = configStore.baseUrl.replace(/\/$/, '') + '/v1/images/edits'
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
        n: formGPT.value.n
      }

      if (formGPT.value.size !== 'auto') {
        body.size = formGPT.value.size
      }

      if (supportsQuality.value && formGPT.value.quality !== 'auto') {
        body.quality = formGPT.value.quality
      }

      if (supportsTransparency.value && formGPT.value.background !== 'auto') {
        body.background = formGPT.value.background
      }

      if (formGPT.value.model === 'gpt-image-1' || formGPT.value.model === 'custom') {
        body.output_format = formGPT.value.outputFormat
        if (supportsCompression.value) {
          body.output_compression = formGPT.value.outputCompression
        }
        if (formGPT.value.moderation !== 'auto') {
          body.moderation = formGPT.value.moderation
        }
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
      response = JSON.parse(text)
    }

    if (response.data) {
      const urls: string[] = []
      for (const item of response.data) {
        if (item.b64_json) {
          const mimeType = `image/${formGPT.value.outputFormat}`
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
      size: formGPT.value.size,
      quality: formGPT.value.quality,
      background: formGPT.value.background,
      outputFormat: formGPT.value.outputFormat,
      outputCompression: formGPT.value.outputCompression,
      n: formGPT.value.n,
      moderation: formGPT.value.moderation,
      referenceImages: []
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

    const generationConfig = {
      responseModalities: ['IMAGE', 'TEXT'],
      imageConfig: {
        image_size: formAI.value.imageSize
      }
    }

    const tools = model.includes('2.5-flash') ? null : [{ googleSearch: {} }]

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
      <h1 class="page-title gradient-text">{{ t('image.title') }}</h1>
      <p class="page-subtitle">{{ t('image.subtitle') }}</p>
    </div>

    <div class="image-layout">
        <!-- Form Section -->
        <NCard class="glass-card form-card">
          <!-- Main Tabs: Nano Banana, GPT-Image, Flux -->
          <NTabs v-model:value="mainTab" type="segment" animated>
            <!-- Nano Banana Tab (Gemini-Image) -->
            <NTabPane name="nano-banana" tab="Nano Banana">
              <!-- Sub-tabs for AI Studio vs Vertex -->
              <NTabs v-model:value="geminiSubTab" type="line" animated class="gemini-sub-tabs">
                <!-- AI Studio Format -->
                <NTabPane name="ai-studio" :tab="t('image.format.aiStudio')">
                  <NForm label-placement="left" label-width="120" class="form-content">
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

                <!-- Reference Images (Edit mode) -->
                <NFormItem v-if="gptMode === 'edit'" :label="t('dalle.referenceImages')">
                  <NUpload
                    accept="image/*"
                    :max="10"
                    multiple
                    list-type="image-card"
                    :default-upload="false"
                    @change="handleGPTImageChange"
                  />
                </NFormItem>

                <!-- Mask (Edit mode) -->
                <NFormItem v-if="gptMode === 'edit'" :label="t('dalle.mask')">
                  <NUpload
                    accept="image/png"
                    :max="1"
                    :default-upload="false"
                    @change="handleGPTMaskChange"
                  >
                    <NButton>{{ t('dalle.uploadMask') }}</NButton>
                  </NUpload>
                </NFormItem>

                <!-- Size -->
                <NFormItem :label="t('dalle.size')">
                  <NSelect v-model:value="formGPT.size" :options="gptSizeOptions" />
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
                <NFormItem v-if="supportsTransparency" :label="t('dalle.background')">
                  <NRadioGroup v-model:value="formGPT.background">
                    <NSpace>
                      <NRadio v-for="opt in gptBackgroundOptions" :key="opt.value" :value="opt.value">
                        {{ opt.label }}
                      </NRadio>
                    </NSpace>
                  </NRadioGroup>
                </NFormItem>

                <!-- Output Format -->
                <NFormItem v-if="supportsTransparency" :label="t('dalle.outputFormat')">
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
                <NFormItem v-if="formGPT.model === 'gpt-image-1'" :label="t('dalle.moderation')">
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
          <!-- Revised Prompt (GPT-Image only) -->
          <NAlert v-if="gptRevisedPrompt && mainTab === 'gpt-image'" type="info" class="revised-prompt">
            <template #header>{{ t('dalle.revisedPrompt') }}</template>
            {{ gptRevisedPrompt }}
          </NAlert>

          <NCard class="glass-card preview-card">
            <template #header>
              <span style="font-size: 14px; font-weight: 600;">{{ t('common.status') }}</span>
            </template>

            <NAlert v-if="errorMessage" type="error" style="margin-bottom: 16px">
              {{ errorMessage }}
            </NAlert>

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
              </template>

              <!-- Nano Banana (Gemini-Image) Result (single image) -->
              <template v-else-if="imageUrl && mainTab === 'nano-banana'">
                <div class="image-container" @click="showLightbox = true">
                  <img :src="imageUrl" class="preview-image" alt="Generated" />
                </div>

                <div v-if="imageInfo" class="image-info">
                  {{ imageInfo.width }} × {{ imageInfo.height }} | {{ imageInfo.size }} | {{ imageInfo.type }}
                </div>

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
                <div class="placeholder-text">{{ t('image.generating') }}</div>
              </div>
            </NSpin>
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

.page-title {
  font-size: 28px;
  font-weight: 700;
  margin: 0 0 8px 0;
  background: linear-gradient(135deg, #7c3aed, #06b6d4);
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

.image-layout {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
  align-items: stretch;
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
  gap: 16px;
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
}

.revised-prompt {
  margin-bottom: 0;
}

.model-description {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
  margin-top: 4px;
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
  min-height: 300px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
}

.placeholder-icon {
  font-size: 48px;
  opacity: 0.3;
}

.placeholder-text {
  font-size: 14px;
  opacity: 0.5;
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
</style>
