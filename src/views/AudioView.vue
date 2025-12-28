<script setup lang="ts">
import { ref, computed, watch, onUnmounted, onMounted, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import {
  NCard, NForm, NFormItem, NInput, NSelect, NButton, NSpace,
  NUpload, NAlert, NSpin, NTag, NTooltip, NSlider, NCheckboxGroup,
  NCheckbox, NCollapse, NCollapseItem, NScrollbar, NSwitch,
  NDivider, NInputNumber,
  type UploadFileInfo
} from 'naive-ui'
import { useConfigStore } from '@/stores/config'
import { useHistoryStore } from '@/stores/history'
import { message } from '@/composables/useNaiveMessage'
import { parseApiError } from '@/utils/api'
import type { AudioTranscriptionResponse, AudioFormData } from '@/types'
import { BatchModeSwitch, BatchAudioPanel } from '@/components/batch'

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

// Local storage key for audio settings
const AUDIO_SETTINGS_KEY = 'audio-form-settings'

// Form state with persistence
const form = ref<AudioFormData>({
  model: 'whisper-1',
  customModel: '',
  language: '',
  responseFormat: 'verbose_json',
  temperature: 0,
  timestampGranularities: ['word', 'segment'],
  prompt: ''
})

// Diarization specific settings
const diarizeSettings = ref({
  chunkingStrategy: 'auto' as 'auto' | 'vad',
  vadThreshold: 0.5,
  vadPrefixPadding: 300,
  vadSilenceDuration: 500,
  knownSpeakerNames: [] as string[],
  knownSpeakerReferences: [] as File[]
})

// New speaker input
const newSpeakerName = ref('')

const audioFile = ref<File | null>(null)
const audioFileName = ref('')

// Result state
const isLoading = ref(false)
const abortController = ref<AbortController | null>(null)
const transcriptionResult = ref<AudioTranscriptionResponse | null>(null)
const rawResult = ref('')
const errorMessage = ref('')

// Audio player state
const audioUrl = ref('')
const audioElement = ref<HTMLAudioElement | null>(null)
const isPlaying = ref(false)
const currentTime = ref(0)
const duration = ref(0)
const currentWordIndex = ref(-1)
const currentSegmentIndex = ref(-1)
const showSyncSubtitles = ref(true)

// Scrollbar refs for auto-scroll
const segmentScrollRef = ref<InstanceType<typeof NScrollbar> | null>(null)
const wordScrollRef = ref<InstanceType<typeof NScrollbar> | null>(null)

// Refs for dynamic height calculation
const formSectionRef = ref<HTMLElement | null>(null)
const resultCardRef = ref<InstanceType<typeof NCard> | null>(null)
const scrollbarMaxHeight = ref(350) // Default height

// Calculate scrollbar height based on left section height
function updateScrollbarHeight() {
  nextTick(() => {
    if (formSectionRef.value) {
      const formSectionHeight = formSectionRef.value.offsetHeight

      // Player card height (if exists)
      const playerCard = document.querySelector('.player-card') as HTMLElement
      const playerHeight = playerCard ? playerCard.offsetHeight + 16 : 0

      // Error alert height (if exists)
      const errorAlert = document.querySelector('.error-alert') as HTMLElement
      const errorHeight = errorAlert ? errorAlert.offsetHeight + 16 : 0

      // Result card header height
      const resultCardElement = resultCardRef.value?.$el as HTMLElement
      const cardHeader = resultCardElement?.querySelector('.n-card-header') as HTMLElement
      const headerHeight = cardHeader ? cardHeader.offsetHeight : 50

      // Result meta height (if exists)
      const resultMeta = resultCardElement?.querySelector('.result-meta') as HTMLElement
      const metaHeight = resultMeta ? resultMeta.offsetHeight + 16 : 0

      // Section title height (if exists)
      const sectionTitle = resultCardElement?.querySelector('.section-title') as HTMLElement
      const titleHeight = sectionTitle ? sectionTitle.offsetHeight + 12 : 0

      // Card padding and border
      const padding = 48

      const availableHeight = formSectionHeight - playerHeight - errorHeight - headerHeight - metaHeight - titleHeight - padding
      scrollbarMaxHeight.value = Math.max(150, availableHeight)
    }
  })
}

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
  ...configStore.audioTemplates.map(t => ({
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
      form.value.prompt = template.prompt
    }
  }
})

// Model options with descriptions
const modelOptions = [
  {
    label: 'whisper-1',
    value: 'whisper-1',
    description: t('audio.models.whisper1Desc'),
    formats: ['json', 'text', 'srt', 'verbose_json', 'vtt'],
    supportsTimestamps: true,
    supportsPrompt: true
  },
  {
    label: 'gpt-4o-transcribe',
    value: 'gpt-4o-transcribe',
    description: t('audio.models.gpt4oTranscribeDesc'),
    formats: ['json', 'text'],
    supportsTimestamps: false,
    supportsPrompt: true
  },
  {
    label: 'gpt-4o-mini-transcribe',
    value: 'gpt-4o-mini-transcribe',
    description: t('audio.models.gpt4oMiniTranscribeDesc'),
    formats: ['json', 'text'],
    supportsTimestamps: false,
    supportsPrompt: true
  },
  {
    label: 'gpt-4o-transcribe-diarize',
    value: 'gpt-4o-transcribe-diarize',
    description: t('audio.models.gpt4oTranscribeDiarizeDesc'),
    formats: ['json', 'text', 'diarized_json'],
    supportsTimestamps: false,
    supportsPrompt: false
  },
  { label: t('common.custom'), value: 'custom' }
]

// Get current model info
const currentModelInfo = computed(() => {
  return modelOptions.find(m => m.value === form.value.model) || modelOptions[0]
})

// Is diarization model
const isDiarizeModel = computed(() => form.value.model === 'gpt-4o-transcribe-diarize')

// Response format options - dynamic based on model
const responseFormatOptions = computed(() => {
  const model = currentModelInfo.value
  if (!model.formats) {
    return [
      { label: 'JSON', value: 'json' },
      { label: 'Text', value: 'text' }
    ]
  }

  const options: { label: string; value: string }[] = []

  if (model.formats.includes('json')) {
    options.push({ label: 'JSON', value: 'json' })
  }
  if (model.formats.includes('text')) {
    options.push({ label: 'Text', value: 'text' })
  }
  if (model.formats.includes('srt')) {
    options.push({ label: 'SRT', value: 'srt' })
  }
  if (model.formats.includes('vtt')) {
    options.push({ label: 'VTT', value: 'vtt' })
  }
  if (model.formats.includes('verbose_json')) {
    options.push({ label: 'Verbose JSON (' + t('audio.recommendedForSync') + ')', value: 'verbose_json' })
  }
  if (model.formats.includes('diarized_json')) {
    options.push({ label: 'Diarized JSON (' + t('audio.speakerLabels') + ')', value: 'diarized_json' })
  }

  return options
})

// Language options
// Note: Whisper API uses language codes, but doesn't distinguish simplified/traditional Chinese
// We use special values to handle this: zh-CN for simplified, zh-TW for traditional (will add prompt hint)
const languageOptions = [
  { label: t('audio.languages.auto'), value: '' },
  { label: 'English', value: 'en' },
  { label: '简体中文 (Simplified)', value: 'zh-CN' },
  { label: '繁體中文 (Traditional)', value: 'zh-TW' },
  { label: '粤语 (Cantonese)', value: 'yue' },
  { label: '日本語', value: 'ja' },
  { label: '한국어', value: 'ko' },
  { label: 'Español', value: 'es' },
  { label: 'Français', value: 'fr' },
  { label: 'Deutsch', value: 'de' },
  { label: 'Italiano', value: 'it' },
  { label: 'Português', value: 'pt' },
  { label: 'Русский', value: 'ru' },
  { label: 'العربية', value: 'ar' },
  { label: 'हिन्दी', value: 'hi' },
  { label: 'ภาษาไทย', value: 'th' },
  { label: 'Tiếng Việt', value: 'vi' }
]

// Timestamp granularity options
const timestampGranularityOptions = [
  { label: 'Word', value: 'word' },
  { label: 'Segment', value: 'segment' }
]

// Chunking strategy options
const chunkingStrategyOptions = [
  { label: 'Auto', value: 'auto' },
  { label: 'VAD (Voice Activity Detection)', value: 'vad' }
]

const isCustomModel = computed(() => form.value.model === 'custom')
const actualModel = computed(() =>
  isCustomModel.value ? form.value.customModel : form.value.model
)

const showTimestampGranularities = computed(() =>
  form.value.responseFormat === 'verbose_json' && currentModelInfo.value.supportsTimestamps
)

const supportsPrompt = computed(() => currentModelInfo.value.supportsPrompt !== false)

// Check if we have word-level timestamps for sync
const hasWordTimestamps = computed(() =>
  transcriptionResult.value?.words && transcriptionResult.value.words.length > 0
)

const hasSegmentTimestamps = computed(() =>
  transcriptionResult.value?.segments && transcriptionResult.value.segments.length > 0
)

// Check if we have diarized segments
const hasDiarizedSegments = computed(() =>
  transcriptionResult.value?.segments?.some(s => s.speaker !== undefined)
)

// Map words to segments for merged display
// Returns an array where each element corresponds to a segment, containing word indices that belong to it
const segmentWordMap = computed(() => {
  if (!hasWordTimestamps.value || !hasSegmentTimestamps.value) return []

  const segments = transcriptionResult.value?.segments || []
  const words = transcriptionResult.value?.words || []

  return segments.map((segment) => {
    // Find words that fall within this segment's time range
    const segmentWords: number[] = []
    words.forEach((word, wordIdx) => {
      // A word belongs to a segment if its start time is within the segment's time range
      // Use some tolerance for edge cases
      if (word.start >= segment.start - 0.05 && word.start < segment.end + 0.05) {
        segmentWords.push(wordIdx)
      }
    })
    return segmentWords
  })
})

// Get word by index
function getWordByIndex(idx: number) {
  return transcriptionResult.value?.words?.[idx]
}

// Check if a word index is the current playing word
function isWordActive(wordIdx: number): boolean {
  return wordIdx === currentWordIndex.value
}

// Check if a word has been played (past)
function isWordPast(wordIdx: number): boolean {
  return currentWordIndex.value > wordIdx
}

// Supported audio formats
const acceptedFormats = '.flac,.mp3,.mp4,.mpeg,.mpga,.m4a,.ogg,.wav,.webm'

// Watch model changes to update response format
watch(() => form.value.model, (newModel) => {
  const modelInfo = modelOptions.find(m => m.value === newModel)
  if (modelInfo?.formats && !modelInfo.formats.includes(form.value.responseFormat)) {
    // Reset to first available format
    form.value.responseFormat = modelInfo.formats[0]
  }
  // Save settings
  saveFormSettings()
})

// Watch form changes to persist
watch(form, () => {
  saveFormSettings()
}, { deep: true })

// Save form settings to localStorage
function saveFormSettings() {
  const settings = {
    model: form.value.model,
    customModel: form.value.customModel,
    language: form.value.language,
    responseFormat: form.value.responseFormat,
    temperature: form.value.temperature,
    timestampGranularities: form.value.timestampGranularities,
  }
  localStorage.setItem(AUDIO_SETTINGS_KEY, JSON.stringify(settings))
}

// Load form settings from localStorage
function loadFormSettings() {
  const saved = localStorage.getItem(AUDIO_SETTINGS_KEY)
  if (saved) {
    try {
      const settings = JSON.parse(saved)
      form.value.model = settings.model || 'whisper-1'
      form.value.customModel = settings.customModel || ''
      form.value.language = settings.language || ''
      form.value.responseFormat = settings.responseFormat || 'verbose_json'
      form.value.temperature = settings.temperature ?? 0
      form.value.timestampGranularities = settings.timestampGranularities || ['word', 'segment']
    } catch {
      // Ignore parse errors
    }
  }
}

// Load settings on mount and check for pending history reload
onMounted(() => {
  loadFormSettings()

  // Check if there's a pending history reload
  const pendingItem = historyStore.consumePendingReload()
  if (pendingItem && pendingItem.type === 'audio') {
    // Load form parameters
    const params = pendingItem.params as AudioFormData
    form.value.model = params.model || 'whisper-1'
    form.value.customModel = params.customModel || ''
    form.value.language = params.language || ''
    form.value.responseFormat = params.responseFormat || 'verbose_json'
    form.value.temperature = params.temperature ?? 0
    form.value.timestampGranularities = params.timestampGranularities || ['word', 'segment']
    form.value.prompt = params.prompt || ''

    // Load result if available
    if (pendingItem.result?.text) {
      rawResult.value = pendingItem.result.text
      // Try to parse as JSON for verbose results
      try {
        transcriptionResult.value = JSON.parse(pendingItem.result.text)
      } catch {
        transcriptionResult.value = { text: pendingItem.result.text }
      }
    }
  }

  // Initial height calculation
  updateScrollbarHeight()

  // Add resize listener
  window.addEventListener('resize', updateScrollbarHeight)
})

// Watch transcription result changes to update height
watch(transcriptionResult, () => {
  updateScrollbarHeight()
})

// Watch audio URL changes (player card appears/disappears)
watch(audioUrl, () => {
  updateScrollbarHeight()
})

// Handle audio file upload
function handleAudioChange(options: { file: UploadFileInfo }) {
  const file = options.file.file
  if (!file) {
    audioFile.value = null
    audioFileName.value = ''
    if (audioUrl.value) {
      URL.revokeObjectURL(audioUrl.value)
      audioUrl.value = ''
    }
    return
  }
  audioFile.value = file
  audioFileName.value = file.name

  // Create audio URL for playback
  if (audioUrl.value) {
    URL.revokeObjectURL(audioUrl.value)
  }
  audioUrl.value = URL.createObjectURL(file)
}

// Handle speaker reference upload
function handleSpeakerRefChange(options: { fileList: UploadFileInfo[] }) {
  diarizeSettings.value.knownSpeakerReferences = options.fileList
    .slice(0, 4)
    .map(f => f.file)
    .filter((f): f is File => f !== null && f !== undefined)
}

// Add speaker name
function addSpeakerName() {
  const name = newSpeakerName.value.trim()
  if (name && diarizeSettings.value.knownSpeakerNames.length < 4) {
    diarizeSettings.value.knownSpeakerNames.push(name)
    newSpeakerName.value = ''
  }
}

// Remove speaker name
function removeSpeakerName(index: number) {
  diarizeSettings.value.knownSpeakerNames.splice(index, 1)
}

// Convert file to base64 data URL
async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      resolve(reader.result as string)
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// Audio player functions
function onAudioLoaded() {
  if (audioElement.value) {
    duration.value = audioElement.value.duration
  }
}

function onTimeUpdate() {
  if (!audioElement.value) return
  currentTime.value = audioElement.value.currentTime

  // Update current word index based on time
  if (hasWordTimestamps.value && transcriptionResult.value?.words) {
    const words = transcriptionResult.value.words
    let newIndex = -1
    for (let i = 0; i < words.length; i++) {
      if (currentTime.value >= words[i].start && currentTime.value <= words[i].end) {
        newIndex = i
        break
      }
      if (i < words.length - 1 && currentTime.value > words[i].end && currentTime.value < words[i + 1].start) {
        newIndex = i
        break
      }
    }
    if (newIndex !== currentWordIndex.value) {
      currentWordIndex.value = newIndex
      // Auto scroll to current word
      if (newIndex >= 0 && showSyncSubtitles.value) {
        nextTick(() => {
          const wordEl = document.querySelector(`.word-item[data-index="${newIndex}"]`)
          if (wordEl) {
            wordEl.scrollIntoView({ behavior: 'smooth', block: 'center' })
          }
        })
      }
    }
  }

  // Update current segment index
  if (hasSegmentTimestamps.value && transcriptionResult.value?.segments) {
    const segments = transcriptionResult.value.segments
    let newIndex = -1
    for (let i = 0; i < segments.length; i++) {
      if (currentTime.value >= segments[i].start && currentTime.value <= segments[i].end) {
        newIndex = i
        break
      }
    }
    if (newIndex !== currentSegmentIndex.value) {
      currentSegmentIndex.value = newIndex
      // Auto scroll to current segment
      if (newIndex >= 0 && showSyncSubtitles.value) {
        nextTick(() => {
          const segmentEl = document.querySelector(`.segment-item[data-index="${newIndex}"]`)
          if (segmentEl) {
            segmentEl.scrollIntoView({ behavior: 'smooth', block: 'center' })
          }
        })
      }
    }
  }
}

function togglePlay() {
  if (!audioElement.value) return
  if (isPlaying.value) {
    audioElement.value.pause()
  } else {
    audioElement.value.play()
  }
}

function onPlay() {
  isPlaying.value = true
}

function onPause() {
  isPlaying.value = false
}

function onEnded() {
  isPlaying.value = false
  currentWordIndex.value = -1
  currentSegmentIndex.value = -1
}

function seekTo(time: number) {
  if (audioElement.value) {
    audioElement.value.currentTime = time
  }
}

function onSliderChange(value: number) {
  seekTo(value)
}

// Click on word to seek
function onWordClick(wordIndex: number) {
  if (transcriptionResult.value?.words) {
    const word = transcriptionResult.value.words[wordIndex]
    seekTo(word.start)
    if (!isPlaying.value && audioElement.value) {
      audioElement.value.play()
    }
  }
}

// Click on segment to seek
function onSegmentClick(segmentIndex: number) {
  if (transcriptionResult.value?.segments) {
    const segment = transcriptionResult.value.segments[segmentIndex]
    seekTo(segment.start)
    if (!isPlaying.value && audioElement.value) {
      audioElement.value.play()
    }
  }
}

// Submit transcription
async function handleSubmit() {
  if (!configStore.apiKey) {
    message.error(t('errors.missingApiKey'))
    return
  }
  if (!audioFile.value) {
    message.error(t('audio.errors.missingAudioFile'))
    return
  }
  if (isCustomModel.value && !form.value.customModel) {
    message.error(t('errors.missingModel'))
    return
  }

  errorMessage.value = ''
  transcriptionResult.value = null
  rawResult.value = ''
  currentWordIndex.value = -1
  currentSegmentIndex.value = -1
  isLoading.value = true

  const ctrl = new AbortController()
  abortController.value = ctrl

  try {
    const fd = new FormData()
    fd.set('file', audioFile.value, audioFile.value.name)
    fd.set('model', actualModel.value)

    // Handle Chinese language variants
    // Whisper API only supports 'zh', not 'zh-CN' or 'zh-TW'
    let actualLanguage = form.value.language
    let chinesePromptHint = ''
    if (form.value.language === 'zh-CN') {
      actualLanguage = 'zh'
      chinesePromptHint = '请使用简体中文输出。'
    } else if (form.value.language === 'zh-TW') {
      actualLanguage = 'zh'
      chinesePromptHint = '請使用繁體中文輸出。'
    }

    if (actualLanguage) {
      fd.set('language', actualLanguage)
    }
    if (form.value.responseFormat) {
      fd.set('response_format', form.value.responseFormat)
    }
    if (form.value.temperature > 0) {
      fd.set('temperature', form.value.temperature.toString())
    }

    // Combine Chinese prompt hint with user prompt
    const finalPrompt = chinesePromptHint
      ? (form.value.prompt ? `${chinesePromptHint} ${form.value.prompt}` : chinesePromptHint)
      : form.value.prompt

    if (finalPrompt && supportsPrompt.value) {
      fd.set('prompt', finalPrompt)
    }

    if (form.value.timestampGranularities.length > 0 &&
        form.value.responseFormat === 'verbose_json' &&
        currentModelInfo.value.supportsTimestamps) {
      form.value.timestampGranularities.forEach(g => {
        fd.append('timestamp_granularities[]', g)
      })
    }

    if (isDiarizeModel.value) {
      fd.set('chunking_strategy', diarizeSettings.value.chunkingStrategy)

      if (diarizeSettings.value.knownSpeakerNames.length > 0) {
        diarizeSettings.value.knownSpeakerNames.forEach(name => {
          fd.append('known_speaker_names[]', name)
        })

        for (const refFile of diarizeSettings.value.knownSpeakerReferences) {
          const dataUrl = await fileToDataUrl(refFile)
          fd.append('known_speaker_references[]', dataUrl)
        }
      }
    }

    const url = configStore.baseUrl.replace(/\/$/, '') + '/v1/audio/transcriptions'
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${configStore.apiKey}` },
      body: fd,
      signal: ctrl.signal
    })

    const text = await res.text()
    if (!res.ok) throw parseApiError(text, res.status)

    rawResult.value = text

    if (form.value.responseFormat === 'json' ||
        form.value.responseFormat === 'verbose_json' ||
        form.value.responseFormat === 'diarized_json') {
      transcriptionResult.value = JSON.parse(text)
    } else {
      transcriptionResult.value = { text }
    }

    historyStore.addItem({
      type: 'audio',
      status: 'completed',
      params: { ...form.value },
      result: {
        text: rawResult.value, // Store full result for history reload
        duration: transcriptionResult.value?.duration,
        language: transcriptionResult.value?.language
      }
    })

    message.success(t('audio.transcriptionComplete'))
  } catch (e: any) {
    if (e.name === 'AbortError') {
      message.warning(t('common.cancel'))
    } else {
      errorMessage.value = e.message
      historyStore.addItem({
        type: 'audio',
        status: 'failed',
        params: { ...form.value },
        error: e.message
      })
    }
  } finally {
    isLoading.value = false
    abortController.value = null
  }
}

function handleCancel() {
  abortController.value?.abort()
}

async function handleCopy() {
  const textToCopy = rawResult.value || transcriptionResult.value?.text || ''
  if (!textToCopy) return

  try {
    await navigator.clipboard.writeText(textToCopy)
    message.success(t('audio.copied'))
  } catch {
    message.error(t('audio.copyFailed'))
  }
}

function handleDownload() {
  const textToDownload = rawResult.value || transcriptionResult.value?.text || ''
  if (!textToDownload) return

  let ext = 'txt'
  let mimeType = 'text/plain'
  if (form.value.responseFormat === 'json' ||
      form.value.responseFormat === 'verbose_json' ||
      form.value.responseFormat === 'diarized_json') {
    ext = 'json'
    mimeType = 'application/json'
  } else if (form.value.responseFormat === 'srt') {
    ext = 'srt'
  } else if (form.value.responseFormat === 'vtt') {
    ext = 'vtt'
  }

  const blob = new Blob([textToDownload], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `transcription-${Date.now()}.${ext}`
  a.click()
  URL.revokeObjectURL(url)
}

function formatDuration(seconds?: number): string {
  if (typeof seconds !== 'number') return ''
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  const ms = Math.floor((seconds % 1) * 100)
  return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`
}

function formatTimestamp(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = (seconds % 60).toFixed(2)
  return `${mins}:${secs.padStart(5, '0')}`
}

function getSpeakerColor(speaker: string | undefined): string {
  if (!speaker) return '#0ea5e9'
  const colors = ['#22d3ee', '#4ade80', '#a78bfa', '#fb923c', '#f87171', '#0ea5e9']
  const index = speaker.charCodeAt(speaker.length - 1) % colors.length
  return colors[index]
}

onUnmounted(() => {
  if (audioUrl.value) {
    URL.revokeObjectURL(audioUrl.value)
  }
  window.removeEventListener('resize', updateScrollbarHeight)
})
</script>

<template>
  <div class="page-container">
    <div class="page-header">
      <div class="header-row">
        <div>
          <h1 class="page-title gradient-text">{{ t('audio.title') }}</h1>
          <p class="page-subtitle">{{ t('audio.subtitle') }}</p>
        </div>
        <BatchModeSwitch v-model="isBatchMode" />
      </div>
    </div>

    <!-- Batch Mode -->
    <BatchAudioPanel v-if="isBatchMode" />

    <!-- Single Mode -->
    <div v-else class="audio-layout">
      <!-- Left: Form Section -->
      <div ref="formSectionRef" class="form-section">
        <NCard class="glass-card">
          <NForm label-placement="left" label-width="140">
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

            <!-- Audio File Upload -->
            <NFormItem :label="t('audio.audioFile')" required>
              <div class="upload-container">
                <NUpload
                  :accept="acceptedFormats"
                  :max="1"
                  :default-upload="false"
                  @change="handleAudioChange"
                >
                  <NButton>{{ t('audio.selectFile') }}</NButton>
                </NUpload>
                <NTooltip v-if="audioFileName" :style="{ maxWidth: '300px' }">
                  <template #trigger>
                    <span class="file-name">{{ audioFileName }}</span>
                  </template>
                  {{ audioFileName }}
                </NTooltip>
              </div>
            </NFormItem>

            <NDivider style="margin: 16px 0" />

            <!-- Model -->
            <NFormItem :label="t('common.model')">
              <NSpace vertical style="width: 100%">
                <NSelect
                  v-model:value="form.model"
                  :options="modelOptions"
                  :render-label="(option: any) => option.label"
                />
                <NInput v-if="isCustomModel" v-model:value="form.customModel" :placeholder="t('common.custom')" />
                <div v-if="currentModelInfo.description" class="model-description">
                  {{ currentModelInfo.description }}
                </div>
              </NSpace>
            </NFormItem>

            <!-- Response Format -->
            <NFormItem :label="t('audio.responseFormat')">
              <NSelect
                v-model:value="form.responseFormat"
                :options="responseFormatOptions"
              />
            </NFormItem>

            <!-- Language -->
            <NFormItem :label="t('audio.language')">
              <NSelect
                v-model:value="form.language"
                :options="languageOptions"
                :placeholder="t('audio.languages.auto')"
                clearable
              />
            </NFormItem>

            <!-- Timestamp Granularities -->
            <NFormItem v-if="showTimestampGranularities" :label="t('audio.timestampGranularities')">
              <NCheckboxGroup v-model:value="form.timestampGranularities">
                <NSpace>
                  <NCheckbox
                    v-for="opt in timestampGranularityOptions"
                    :key="opt.value"
                    :value="opt.value"
                    :label="opt.label"
                  />
                </NSpace>
              </NCheckboxGroup>
            </NFormItem>

            <!-- Temperature -->
            <NFormItem :label="t('audio.temperature')">
              <div class="slider-container">
                <NSlider
                  v-model:value="form.temperature"
                  :min="0"
                  :max="1"
                  :step="0.1"
                />
                <span class="slider-value">{{ form.temperature.toFixed(1) }}</span>
              </div>
            </NFormItem>

            <!-- Prompt -->
            <NFormItem v-if="supportsPrompt" :label="t('audio.prompt')">
              <NSpace vertical style="width: 100%">
                <NSelect
                  v-if="configStore.audioTemplates.length > 0"
                  v-model:value="selectedTemplate"
                  :options="templateOptions"
                  clearable
                  :placeholder="t('settings.noTemplates')"
                  size="small"
                />
                <NInput
                  v-model:value="form.prompt"
                  type="textarea"
                  :rows="2"
                  :placeholder="t('audio.promptPlaceholder')"
                />
              </NSpace>
            </NFormItem>

            <!-- Diarization Settings -->
            <template v-if="isDiarizeModel">
              <NDivider style="margin: 16px 0">
                {{ t('audio.diarization') }}
              </NDivider>

              <NFormItem :label="t('audio.chunkingStrategy')">
                <NSelect
                  v-model:value="diarizeSettings.chunkingStrategy"
                  :options="chunkingStrategyOptions"
                />
              </NFormItem>

              <template v-if="diarizeSettings.chunkingStrategy === 'vad'">
                <NFormItem :label="t('audio.vadThreshold')">
                  <div class="slider-container">
                    <NSlider
                      v-model:value="diarizeSettings.vadThreshold"
                      :min="0"
                      :max="1"
                      :step="0.05"
                    />
                    <span class="slider-value">{{ diarizeSettings.vadThreshold.toFixed(2) }}</span>
                  </div>
                </NFormItem>

                <NFormItem :label="t('audio.vadPrefixPadding')">
                  <NInputNumber
                    v-model:value="diarizeSettings.vadPrefixPadding"
                    :min="0"
                    :max="1000"
                    :step="50"
                  />
                  <span class="unit-label">ms</span>
                </NFormItem>

                <NFormItem :label="t('audio.vadSilenceDuration')">
                  <NInputNumber
                    v-model:value="diarizeSettings.vadSilenceDuration"
                    :min="100"
                    :max="2000"
                    :step="50"
                  />
                  <span class="unit-label">ms</span>
                </NFormItem>
              </template>

              <NFormItem :label="t('audio.knownSpeakers')">
                <NSpace vertical style="width: 100%">
                  <NSpace>
                    <NInput
                      v-model:value="newSpeakerName"
                      :placeholder="t('audio.speakerNamePlaceholder')"
                      size="small"
                      style="width: 150px"
                      @keyup.enter="addSpeakerName"
                    />
                    <NButton
                      size="small"
                      :disabled="diarizeSettings.knownSpeakerNames.length >= 4"
                      @click="addSpeakerName"
                    >
                      {{ t('common.add') }}
                    </NButton>
                  </NSpace>
                  <NSpace v-if="diarizeSettings.knownSpeakerNames.length > 0">
                    <NTag
                      v-for="(name, idx) in diarizeSettings.knownSpeakerNames"
                      :key="idx"
                      closable
                      @close="removeSpeakerName(idx)"
                    >
                      {{ name }}
                    </NTag>
                  </NSpace>
                  <div class="hint-text">{{ t('audio.speakerHint') }}</div>
                </NSpace>
              </NFormItem>

              <NFormItem :label="t('audio.speakerReferences')">
                <NUpload
                  :accept="acceptedFormats"
                  :max="4"
                  multiple
                  :default-upload="false"
                  @change="handleSpeakerRefChange"
                >
                  <NButton size="small">{{ t('audio.uploadReferences') }}</NButton>
                </NUpload>
              </NFormItem>
            </template>

            <!-- Submit -->
            <NFormItem label=" ">
              <NSpace>
                <NButton type="primary" :loading="isLoading" @click="handleSubmit">
                  {{ t('audio.transcribe') }}
                </NButton>
                <NButton :disabled="!isLoading" @click="handleCancel">
                  {{ t('common.cancel') }}
                </NButton>
              </NSpace>
            </NFormItem>
          </NForm>
        </NCard>

        <!-- Supported Formats Info -->
        <NCard class="glass-card info-card">
          <template #header>{{ t('audio.supportedFormats') }}</template>
          <div class="formats-info">
            <NTag v-for="fmt in ['FLAC', 'MP3', 'MP4', 'MPEG', 'M4A', 'OGG', 'WAV', 'WEBM']" :key="fmt" size="small">
              {{ fmt }}
            </NTag>
          </div>
          <p class="formats-note">{{ t('audio.maxFileSize') }}</p>
          <p v-if="currentModelInfo.supportsTimestamps" class="formats-note tip">
            {{ t('audio.syncTip') }}
          </p>
        </NCard>
      </div>

      <!-- Right: Result Section -->
      <div class="result-section">
        <!-- Error Alert -->
        <NAlert v-if="errorMessage" type="error" class="error-alert" closable @close="errorMessage = ''">
          {{ errorMessage }}
        </NAlert>

        <!-- Audio Player Card -->
        <NCard v-if="audioUrl" class="glass-card player-card">
          <template #header>
            <div class="player-header">
              <span>{{ t('audio.player') }}</span>
              <NSpace v-if="hasWordTimestamps || hasSegmentTimestamps" align="center">
                <span class="sync-label">{{ t('audio.syncSubtitles') }}</span>
                <NSwitch v-model:value="showSyncSubtitles" size="small" />
              </NSpace>
            </div>
          </template>

          <audio
            ref="audioElement"
            :src="audioUrl"
            :aria-label="t('audio.player')"
            @loadedmetadata="onAudioLoaded"
            @timeupdate="onTimeUpdate"
            @play="onPlay"
            @pause="onPause"
            @ended="onEnded"
          />

          <div class="player-controls" role="group" :aria-label="t('audio.player')">
            <NButton
              circle
              type="primary"
              size="large"
              :aria-label="isPlaying ? t('accessibility.pause') : t('accessibility.play')"
              @click="togglePlay"
            >
              <template #icon>
                <span v-if="isPlaying">⏸</span>
                <span v-else>▶</span>
              </template>
            </NButton>

            <div class="player-progress">
              <span class="time-display">{{ formatTime(currentTime) }}</span>
              <NSlider
                :value="currentTime"
                :max="duration || 100"
                :step="0.1"
                :tooltip="false"
                @update:value="onSliderChange"
              />
              <span class="time-display">{{ formatTime(duration) }}</span>
            </div>
          </div>

          <!-- Collapsible Full Text -->
          <NCollapse v-if="transcriptionResult?.text" class="text-collapse">
            <NCollapseItem :title="t('audio.fullText')" name="fulltext">
              <NScrollbar style="max-height: 150px">
                <div class="full-text">{{ transcriptionResult.text }}</div>
              </NScrollbar>
            </NCollapseItem>
          </NCollapse>
        </NCard>

        <!-- Transcription Result Card -->
        <NCard ref="resultCardRef" class="glass-card result-card">
          <template #header>
            <div class="result-header">
              <span>{{ t('audio.result') }}</span>
              <NSpace v-if="transcriptionResult">
                <NButton size="small" :aria-label="t('accessibility.copyToClipboard')" @click="handleCopy">
                  {{ t('audio.copy') }}
                </NButton>
                <NButton size="small" :aria-label="t('accessibility.downloadFile')" @click="handleDownload">
                  {{ t('common.download') }}
                </NButton>
              </NSpace>
            </div>
          </template>

          <NSpin :show="isLoading">
            <div v-if="transcriptionResult" class="transcription-result">
              <!-- Metadata -->
              <div v-if="transcriptionResult.duration || transcriptionResult.language" class="result-meta">
                <NTag v-if="transcriptionResult.language" size="small" type="info">
                  {{ t('audio.detectedLanguage') }}: {{ transcriptionResult.language }}
                </NTag>
                <NTag v-if="transcriptionResult.duration" size="small" type="info">
                  {{ t('audio.duration') }}: {{ formatDuration(transcriptionResult.duration) }}
                </NTag>
                <NTag v-if="hasWordTimestamps" size="small" type="success">
                  {{ t('audio.words') }}: {{ transcriptionResult.words?.length }}
                </NTag>
                <NTag v-if="hasDiarizedSegments" size="small" type="warning">
                  {{ t('audio.speakerLabels') }}
                </NTag>
              </div>

              <!-- Segments with Word-level Highlighting (Merged Display) -->
              <div v-if="hasSegmentTimestamps || hasDiarizedSegments" class="segments-section">
                <div class="section-title">{{ t('audio.segments') }} ({{ transcriptionResult.segments?.length }})</div>
                <NScrollbar ref="segmentScrollRef" :style="{ maxHeight: scrollbarMaxHeight + 'px' }">
                  <div class="segments-list">
                    <div
                      v-for="(segment, idx) in transcriptionResult.segments"
                      :key="idx"
                      :data-index="idx"
                      class="segment-item"
                      :class="{ 'active': idx === currentSegmentIndex, 'diarized': hasDiarizedSegments }"
                    >
                      <span
                        v-if="segment.speaker"
                        class="speaker-badge"
                        :style="{ backgroundColor: getSpeakerColor(segment.speaker) }"
                      >
                        {{ segment.speaker }}
                      </span>
                      <span class="segment-time clickable" @click="onSegmentClick(idx)">
                        {{ formatTimestamp(segment.start) }}
                      </span>
                      <!-- Merged: Show words with highlighting if word timestamps are available for this segment -->
                      <span v-if="segmentWordMap[idx]?.length > 0" class="segment-text-words">
                        <span
                          v-for="wordIdx in segmentWordMap[idx]"
                          :key="wordIdx"
                          :data-word-index="wordIdx"
                          class="inline-word clickable"
                          :class="{ 'active': isWordActive(wordIdx), 'past': isWordPast(wordIdx) }"
                          :title="formatTimestamp(getWordByIndex(wordIdx)?.start || 0)"
                          @click="onWordClick(wordIdx)"
                        >{{ getWordByIndex(wordIdx)?.word }}</span>
                      </span>
                      <!-- Fallback: Show plain text if no word mapping for this segment -->
                      <span v-else class="segment-text clickable" @click="onSegmentClick(idx)">{{ segment.text }}</span>
                    </div>
                  </div>
                </NScrollbar>
              </div>

              <!-- Words only (when no segments available) -->
              <div v-else-if="hasWordTimestamps" class="words-section words-only">
                <div class="section-title">{{ t('audio.wordTimestamps') }}</div>
                <NScrollbar ref="wordScrollRef" :style="{ maxHeight: scrollbarMaxHeight + 'px' }">
                  <div class="words-list">
                    <span
                      v-for="(word, idx) in transcriptionResult.words"
                      :key="idx"
                      :data-index="idx"
                      class="word-item clickable"
                      :class="{ 'active': idx === currentWordIndex, 'past': currentWordIndex > idx }"
                      :title="`${formatTimestamp(word.start)}`"
                      @click="onWordClick(idx)"
                    >{{ word.word }}</span>
                  </div>
                </NScrollbar>
              </div>

              <!-- Fallback: Plain text only -->
              <div v-if="!hasSegmentTimestamps && !hasWordTimestamps && transcriptionResult.text" class="plain-text-section">
                <NScrollbar :style="{ maxHeight: scrollbarMaxHeight + 'px' }">
                  <div class="result-text">{{ transcriptionResult.text }}</div>
                </NScrollbar>
              </div>
            </div>

            <div v-else class="result-placeholder">
              <div class="placeholder-icon">🎤</div>
              <div>{{ t('audio.waitingForAudio') }}</div>
            </div>
          </NSpin>
        </NCard>
      </div>
    </div>
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

.audio-layout {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
  align-items: stretch;
}

@media (max-width: 1024px) {
  .audio-layout {
    grid-template-columns: 1fr;
  }
}

.form-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.result-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-height: 0;
}

.error-alert {
  margin-bottom: 0;
}

/* Upload container fix */
.upload-container {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  min-width: 0;
}

.file-name {
  font-size: 13px;
  opacity: 0.8;
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex-shrink: 1;
  min-width: 0;
}

.model-description {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
  margin-top: 4px;
}

.hint-text {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
}

.unit-label {
  margin-left: 8px;
  font-size: 12px;
  opacity: 0.7;
}

/* Player styles */
.player-card {
  overflow: visible;
}

.player-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.sync-label {
  font-size: 12px;
  opacity: 0.8;
}

.player-controls {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 8px 0;
}

.player-progress {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 12px;
}

.player-progress :deep(.n-slider) {
  flex: 1;
}

.time-display {
  font-family: ui-monospace, monospace;
  font-size: 12px;
  min-width: 60px;
  text-align: center;
  opacity: 0.8;
}

/* Text collapse */
.text-collapse {
  margin-top: 16px;
}

.full-text {
  font-size: 14px;
  line-height: 1.8;
  white-space: pre-wrap;
  word-break: break-word;
  opacity: 0.9;
}

/* Result styles */
.result-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.result-meta {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.section-title {
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 12px;
  opacity: 0.8;
}

/* Segments section */
.segments-section {
  margin-bottom: 20px;
}

.segments-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.segment-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 8px;
  transition: all 0.2s ease;
  background: rgba(14, 165, 233, 0.05);
}

.clickable {
  cursor: pointer;
}

.segment-time.clickable:hover {
  color: #22d3ee;
}

.segment-text.clickable:hover {
  text-decoration: underline;
  text-underline-offset: 2px;
}

.segment-item.active {
  background: rgba(14, 165, 233, 0.25);
  border-left: 3px solid #0ea5e9;
}

.speaker-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  color: white;
  flex-shrink: 0;
}

.segment-time {
  font-family: ui-monospace, monospace;
  font-size: 11px;
  color: #0ea5e9;
  flex-shrink: 0;
  min-width: 50px;
}

.segment-text {
  font-size: 14px;
  line-height: 1.5;
  flex: 1;
}

/* Segment text with inline word highlighting */
.segment-text-words {
  font-size: 14px;
  line-height: 1.8;
  flex: 1;
}

.inline-word {
  display: inline;
  padding: 2px 1px;
  border-radius: 3px;
  transition: all 0.15s ease;
  cursor: pointer;
}

.inline-word:hover {
  background: rgba(14, 165, 233, 0.2);
}

.inline-word.past {
  opacity: 0.6;
}

.inline-word.active {
  background: linear-gradient(135deg, #0ea5e9, #22c55e);
  color: white;
  padding: 2px 4px;
  border-radius: 4px;
  font-weight: 600;
  opacity: 1;
  box-shadow: 0 2px 8px rgba(14, 165, 233, 0.4);
}

/* Words section (standalone, when no segments) - handled by .result-card rules */
.words-section.words-only {
  /* No extra styling needed */
}

.words-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  line-height: 2;
}

.word-item {
  display: inline-block;
  padding: 4px 8px;
  background: rgba(14, 165, 233, 0.1);
  border-radius: 6px;
  font-size: 13px;
  transition: all 0.15s ease;
  cursor: pointer;
}

.word-item:hover {
  background: rgba(14, 165, 233, 0.25);
  transform: scale(1.05);
}

.word-item.past {
  opacity: 0.5;
}

.word-item.active {
  background: linear-gradient(135deg, #0ea5e9, #22c55e);
  color: white;
  transform: scale(1.1);
  font-weight: 600;
  opacity: 1;
}

/* Plain text section - handled by .result-card rules */

.result-text {
  font-size: 14px;
  line-height: 1.8;
  white-space: pre-wrap;
  word-break: break-word;
}

.result-placeholder {
  min-height: 200px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: rgba(255, 255, 255, 0.5);
}

.placeholder-icon {
  font-size: 48px;
  opacity: 0.3;
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

.slider-value {
  min-width: 40px;
  text-align: right;
  font-family: ui-monospace, monospace;
}

.formats-info {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}

.formats-note {
  font-size: 12px;
  opacity: 0.6;
  margin: 0;
}

.formats-note.tip {
  margin-top: 8px;
  opacity: 0.8;
  color: #0ea5e9;
}

.info-card {
  font-size: 14px;
}


</style>
