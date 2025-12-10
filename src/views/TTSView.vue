<script setup lang="ts">
import { ref, computed, watch, onUnmounted, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  NCard, NForm, NFormItem, NInput, NSelect, NButton, NSpace,
  NAlert, NSpin, NTag, NTooltip, NSlider, NRadioGroup, NRadio
} from 'naive-ui'
import { useConfigStore } from '@/stores/config'
import { message } from '@/composables/useNaiveMessage'
import { parseApiError } from '@/utils/api'
import { BatchModeSwitch, BatchTTSPanel } from '@/components/batch'

const { t } = useI18n()
const configStore = useConfigStore()

// Batch mode toggle
const isBatchMode = ref(false)

// Local storage key for TTS settings
const TTS_SETTINGS_KEY = 'tts-form-settings'

// Form state
const form = ref({
  model: 'gpt-4o-mini-tts',
  customModel: '',
  voice: 'alloy',
  input: '',
  instructions: '',
  responseFormat: 'mp3',
  speed: 1.0
})

// Task state
const isLoading = ref(false)
const abortController = ref<AbortController | null>(null)
const audioUrl = ref('')
const audioBlob = ref<Blob | null>(null)
const errorMessage = ref('')

// Audio player state
const audioElement = ref<HTMLAudioElement | null>(null)
const isPlaying = ref(false)
const currentTime = ref(0)
const duration = ref(0)

// Provider preset options
const presetOptions = computed(() =>
  configStore.providerPresets.map(p => ({
    label: p.name,
    value: p.id
  }))
)

// Model options
const modelOptions = [
  {
    label: 'gpt-4o-mini-tts',
    value: 'gpt-4o-mini-tts',
    description: 'tts.models.gpt4oMiniTtsDesc'
  },
  {
    label: 'tts-1',
    value: 'tts-1',
    description: 'tts.models.tts1Desc'
  },
  {
    label: 'tts-1-hd',
    value: 'tts-1-hd',
    description: 'tts.models.tts1HdDesc'
  },
  { label: t('common.custom'), value: 'custom' }
]

// Voice options
const voiceOptions = [
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

// Response format options
const formatOptions = [
  { label: 'MP3', value: 'mp3' },
  { label: 'Opus', value: 'opus' },
  { label: 'AAC', value: 'aac' },
  { label: 'FLAC', value: 'flac' },
  { label: 'WAV', value: 'wav' },
  { label: 'PCM', value: 'pcm' }
]

const isCustomModel = computed(() => form.value.model === 'custom')
const actualModel = computed(() =>
  isCustomModel.value ? form.value.customModel : form.value.model
)

// Current model info
const currentModelInfo = computed(() => {
  return modelOptions.find(m => m.value === form.value.model)
})

// Check if model supports instructions
const supportsInstructions = computed(() =>
  form.value.model === 'gpt-4o-mini-tts' || form.value.model === 'custom'
)

// Watch form changes to persist
watch(form, () => {
  saveFormSettings()
}, { deep: true })

// Save form settings to localStorage
function saveFormSettings() {
  const settings = {
    model: form.value.model,
    customModel: form.value.customModel,
    voice: form.value.voice,
    responseFormat: form.value.responseFormat,
    speed: form.value.speed
  }
  localStorage.setItem(TTS_SETTINGS_KEY, JSON.stringify(settings))
}

// Load form settings from localStorage
function loadFormSettings() {
  const saved = localStorage.getItem(TTS_SETTINGS_KEY)
  if (saved) {
    try {
      const settings = JSON.parse(saved)
      form.value.model = settings.model || 'gpt-4o-mini-tts'
      form.value.customModel = settings.customModel || ''
      form.value.voice = settings.voice || 'alloy'
      form.value.responseFormat = settings.responseFormat || 'mp3'
      form.value.speed = settings.speed ?? 1.0
    } catch {
      // Ignore parse errors
    }
  }
}

// Load settings on mount
onMounted(() => {
  loadFormSettings()
})

// Audio player functions
function onAudioLoaded() {
  if (audioElement.value) {
    duration.value = audioElement.value.duration
  }
}

function onTimeUpdate() {
  if (!audioElement.value) return
  currentTime.value = audioElement.value.currentTime
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
}

function seekTo(time: number) {
  if (audioElement.value) {
    audioElement.value.currentTime = time
  }
}

function onSliderChange(value: number) {
  seekTo(value)
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  const ms = Math.floor((seconds % 1) * 100)
  return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`
}

// Submit TTS
async function handleSubmit() {
  if (!configStore.apiKey) {
    message.error(t('errors.missingApiKey'))
    return
  }
  if (!form.value.input) {
    message.error(t('tts.errors.missingInput'))
    return
  }
  if (isCustomModel.value && !form.value.customModel) {
    message.error(t('errors.missingModel'))
    return
  }

  errorMessage.value = ''
  if (audioUrl.value) {
    URL.revokeObjectURL(audioUrl.value)
    audioUrl.value = ''
  }
  audioBlob.value = null
  isLoading.value = true

  const ctrl = new AbortController()
  abortController.value = ctrl

  try {
    const body: Record<string, any> = {
      model: actualModel.value,
      input: form.value.input,
      voice: form.value.voice,
      response_format: form.value.responseFormat
    }

    if (form.value.speed !== 1.0) {
      body.speed = form.value.speed
    }

    if (supportsInstructions.value && form.value.instructions) {
      body.instructions = form.value.instructions
    }

    const url = configStore.baseUrl.replace(/\/$/, '') + '/v1/audio/speech'
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${configStore.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body),
      signal: ctrl.signal
    })

    if (!res.ok) {
      const text = await res.text()
      throw parseApiError(text, res.status)
    }

    const blob = await res.blob()
    audioBlob.value = blob
    audioUrl.value = URL.createObjectURL(blob)

    message.success(t('tts.speechReady'))
  } catch (e: any) {
    if (e.name === 'AbortError') {
      message.warning(t('common.cancel'))
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

function handleDownload() {
  if (!audioUrl.value || !audioBlob.value) return

  const ext = form.value.responseFormat === 'pcm' ? 'raw' : form.value.responseFormat
  const a = document.createElement('a')
  a.href = audioUrl.value
  a.download = `speech-${Date.now()}.${ext}`
  a.click()
}

onUnmounted(() => {
  abortController.value?.abort()
  if (audioUrl.value) {
    URL.revokeObjectURL(audioUrl.value)
  }
})
</script>

<template>
  <div class="page-container">
    <div class="page-header">
      <div class="header-row">
        <div>
          <h1 class="page-title gradient-text">{{ t('tts.title') }}</h1>
          <p class="page-subtitle">{{ t('tts.subtitle') }}</p>
        </div>
        <BatchModeSwitch v-model="isBatchMode" />
      </div>
    </div>

    <!-- Batch Mode -->
    <BatchTTSPanel v-if="isBatchMode" />

    <!-- Single Mode -->
    <div v-else class="tts-layout">
      <!-- Left: Form Section -->
      <div class="form-section">
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
              </NSpace>
            </NFormItem>

            <!-- Model -->
            <NFormItem :label="t('common.model')">
              <NSpace vertical style="width: 100%">
                <NSelect v-model:value="form.model" :options="modelOptions" />
                <NInput v-if="isCustomModel" v-model:value="form.customModel" :placeholder="t('common.custom')" />
                <div v-if="currentModelInfo?.description" class="model-description">
                  {{ t(currentModelInfo.description) }}
                </div>
              </NSpace>
            </NFormItem>

            <!-- Voice -->
            <NFormItem :label="t('tts.voice')">
              <NSelect v-model:value="form.voice" :options="voiceOptions" />
            </NFormItem>

            <!-- Input Text -->
            <NFormItem :label="t('tts.inputText')" required>
              <NInput
                v-model:value="form.input"
                type="textarea"
                :rows="6"
                :placeholder="t('tts.inputPlaceholder')"
                :maxlength="4096"
                show-count
              />
            </NFormItem>

            <!-- Instructions (only for gpt-4o-mini-tts) -->
            <NFormItem v-if="supportsInstructions" :label="t('tts.instructions')">
              <NInput
                v-model:value="form.instructions"
                type="textarea"
                :rows="2"
                :placeholder="t('tts.instructionsPlaceholder')"
              />
            </NFormItem>

            <!-- Response Format -->
            <NFormItem :label="t('tts.outputFormat')">
              <NRadioGroup v-model:value="form.responseFormat">
                <NSpace>
                  <NRadio v-for="opt in formatOptions" :key="opt.value" :value="opt.value">
                    {{ opt.label }}
                  </NRadio>
                </NSpace>
              </NRadioGroup>
            </NFormItem>

            <!-- Speed -->
            <NFormItem :label="t('tts.speed')">
              <div class="slider-container">
                <NSlider
                  v-model:value="form.speed"
                  :min="0.25"
                  :max="4.0"
                  :step="0.05"
                />
                <span class="slider-value">{{ form.speed.toFixed(2) }}x</span>
              </div>
            </NFormItem>

            <!-- Submit -->
            <NFormItem label=" ">
              <NSpace>
                <NButton type="primary" :loading="isLoading" @click="handleSubmit">
                  {{ t('tts.generate') }}
                </NButton>
                <NButton :disabled="!isLoading" @click="handleCancel">
                  {{ t('common.cancel') }}
                </NButton>
              </NSpace>
            </NFormItem>
          </NForm>
        </NCard>

        <!-- Info Card -->
        <NCard class="glass-card info-card">
          <template #header>{{ t('tts.voiceInfo') }}</template>
          <div class="voice-info">
            <p>{{ t('tts.voiceInfoText') }}</p>
            <div class="voices-list">
              <NTag v-for="v in voiceOptions" :key="v.value" size="small">
                {{ v.label }}
              </NTag>
            </div>
          </div>
        </NCard>
      </div>

      <!-- Right: Result Section -->
      <div class="result-section">
        <!-- Error Alert -->
        <NAlert v-if="errorMessage" type="error" class="error-alert" closable @close="errorMessage = ''">
          {{ errorMessage }}
        </NAlert>

        <!-- Audio Player Card -->
        <NCard class="glass-card player-card">
          <template #header>
            <div class="player-header">
              <span>{{ t('tts.player') }}</span>
              <NSpace v-if="audioUrl">
                <NButton size="small" :aria-label="t('accessibility.downloadFile')" @click="handleDownload">
                  {{ t('common.download') }}
                </NButton>
              </NSpace>
            </div>
          </template>

          <NSpin :show="isLoading">
            <div v-if="audioUrl" class="player-content">
              <audio
                ref="audioElement"
                :src="audioUrl"
                :aria-label="t('tts.player')"
                @loadedmetadata="onAudioLoaded"
                @timeupdate="onTimeUpdate"
                @play="onPlay"
                @pause="onPause"
                @ended="onEnded"
              />

              <div class="player-controls" role="group" :aria-label="t('tts.player')">
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

              <div class="audio-info">
                <NTag size="small" type="info">{{ form.voice }}</NTag>
                <NTag size="small" type="info">{{ form.responseFormat.toUpperCase() }}</NTag>
                <NTag v-if="form.speed !== 1.0" size="small" type="info">{{ form.speed }}x</NTag>
              </div>
            </div>

            <div v-else class="player-placeholder">
              <div class="placeholder-icon">🔊</div>
              <div>{{ t('tts.waitingForInput') }}</div>
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

.tts-layout {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
  align-items: stretch;
}

@media (max-width: 1024px) {
  .tts-layout {
    grid-template-columns: 1fr;
  }
}

.form-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-section > :last-child {
  flex: 1;
}

.result-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.result-section > :last-child {
  flex: 1;
}

.error-alert {
  margin-bottom: 0;
}

.model-description {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
  margin-top: 4px;
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
  min-width: 50px;
  text-align: right;
  font-family: ui-monospace, monospace;
}

/* Player styles */
.player-card {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.player-card :deep(.n-card__content) {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.player-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.player-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
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

.audio-info {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.player-placeholder {
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

.info-card {
  font-size: 14px;
}

.voice-info p {
  margin: 0 0 12px 0;
  opacity: 0.8;
}

.voices-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
</style>
