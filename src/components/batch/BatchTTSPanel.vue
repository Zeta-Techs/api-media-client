<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  NCard, NForm, NFormItem, NSelect, NSpace,
  NSlider, NTooltip, NTag, NRadioGroup, NRadio, NInput
} from 'naive-ui'
import { useConfigStore } from '@/stores/config'
import { message } from '@/composables/useNaiveMessage'
import { parseApiError } from '@/utils/api'
import { useBatchQueue, type TaskProcessor } from '@/composables/useBatchQueue'
import { useBatchExport } from '@/composables/useBatchExport'
import { useCloudStorage } from '@/composables/useCloudStorage'
import BatchInputArea from './BatchInputArea.vue'
import BatchTaskList from './BatchTaskList.vue'
import BatchProgressBar from './BatchProgressBar.vue'
import BatchControlBar from './BatchControlBar.vue'

interface AudioResult {
  url: string
  blob: Blob
  cloudUrl?: string
}

const { t } = useI18n()
const configStore = useConfigStore()
const { uploadFile, autoUploadEnabled } = useCloudStorage()

// Form settings (shared for all batch tasks)
const batchSettings = ref({
  model: 'gpt-4o-mini-tts',
  customModel: '',
  voice: 'alloy',
  responseFormat: 'mp3',
  speed: 1.0,
  instructions: ''
})

// Concurrency setting
const concurrency = ref(3)

// Model options
const modelOptions = [
  { label: 'gpt-4o-mini-tts', value: 'gpt-4o-mini-tts' },
  { label: 'tts-1', value: 'tts-1' },
  { label: 'tts-1-hd', value: 'tts-1-hd' },
  { label: computed(() => t('common.custom')).value, value: 'custom' }
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

// Format options
const formatOptions = [
  { label: 'MP3', value: 'mp3' },
  { label: 'Opus', value: 'opus' },
  { label: 'AAC', value: 'aac' },
  { label: 'FLAC', value: 'flac' },
  { label: 'WAV', value: 'wav' }
]

const isCustomModel = computed(() => batchSettings.value.model === 'custom')
const actualModel = computed(() =>
  isCustomModel.value ? batchSettings.value.customModel : batchSettings.value.model
)

const supportsInstructions = computed(() =>
  batchSettings.value.model === 'gpt-4o-mini-tts' || batchSettings.value.model === 'custom'
)

// TTS processor function
const processTTS: TaskProcessor<string, AudioResult> = async (text, onProgress, signal) => {
  const body: Record<string, any> = {
    model: actualModel.value,
    input: text,
    voice: batchSettings.value.voice,
    response_format: batchSettings.value.responseFormat
  }

  if (batchSettings.value.speed !== 1.0) {
    body.speed = batchSettings.value.speed
  }

  if (supportsInstructions.value && batchSettings.value.instructions) {
    body.instructions = batchSettings.value.instructions
  }

  onProgress(10) // Started

  const url = configStore.baseUrl.replace(/\/$/, '') + '/v1/audio/speech'
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${configStore.apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body),
    signal
  })

  onProgress(80) // Request complete

  if (!res.ok) {
    const text = await res.text()
    throw parseApiError(text, res.status)
  }

  const blob = await res.blob()
  onProgress(90)

  const resultUrl = URL.createObjectURL(blob)

  // Auto-upload to cloud storage if enabled
  let cloudUrl: string | undefined
  if (autoUploadEnabled.value) {
    onProgress(92)
    const ext = batchSettings.value.responseFormat === 'pcm' ? 'raw' : batchSettings.value.responseFormat
    const filename = `tts-${Date.now()}.${ext}`
    const uploadResult = await uploadFile(blob, filename, 'tts')
    if (uploadResult.success && uploadResult.url) {
      cloudUrl = uploadResult.url
    }
  }

  return {
    url: resultUrl,
    blob,
    cloudUrl
  }
}

// Initialize batch queue
const {
  tasks,
  isRunning,
  isPaused,
  totalCount,
  completedCount,
  failedCount,
  pendingCount,
  processingCount,
  overallProgress,
  addTasks,
  removeTask,
  clearTasks,
  clearCompletedTasks,
  clearFailedTasks,
  start,
  pause,
  resume,
  stop,
  cancelTask,
  retryFailed,
  retryTask,
  updateConfig
} = useBatchQueue<string, AudioResult>(processTTS, {
  concurrency: concurrency.value,
  retryCount: 1,
  continueOnError: true
})

// Export functionality
const { exportAsZIP, exportTaskResults, isExporting } = useBatchExport({
  filenamePrefix: 'batch-tts'
})

// Watch concurrency changes
watch(concurrency, (val) => {
  updateConfig({ concurrency: val })
})

// Add texts to queue
function handleAddTexts(texts: string[]) {
  if (!configStore.apiKey) {
    message.error(t('errors.missingApiKey'))
    return
  }
  addTasks(texts)
  message.success(t('batch.addToQueue') + `: ${texts.length}`)
}

// Export handlers
async function handleExport(format: 'json' | 'csv' | 'zip') {
  const completedTasks = tasks.value.filter(t => t.status === 'completed' && t.result)

  if (completedTasks.length === 0) {
    message.warning(t('batch.noTasks'))
    return
  }

  if (format === 'zip') {
    // Export audio files as ZIP
    const ext = batchSettings.value.responseFormat === 'pcm' ? 'raw' : batchSettings.value.responseFormat
    const items = completedTasks.map((task, idx) => ({
      id: task.id,
      filename: `audio-${idx + 1}.${ext}`,
      data: task.result!.blob
    }))

    await exportAsZIP(items)
    message.success(t('batch.export') + ' ZIP')
  } else {
    exportTaskResults(tasks.value as any, format)
    message.success(t('batch.export') + ` ${format.toUpperCase()}`)
  }
}

// Format input for display
function formatInput(input: string): string {
  return input.length > 60 ? input.slice(0, 60) + '...' : input
}

// Play audio
function playAudio(url: string) {
  const audio = new Audio(url)
  audio.play()
}

// Cleanup on unmount
onUnmounted(() => {
  stop()
  // Revoke all blob URLs
  tasks.value.forEach(task => {
    if (task.result?.url?.startsWith('blob:')) {
      URL.revokeObjectURL(task.result.url)
    }
  })
})
</script>

<template>
  <div class="batch-tts-panel">
    <!-- Settings Card -->
    <NCard class="glass-card settings-card" size="small">
      <template #header>
        <span class="card-title">{{ t('batch.queueConfig') }}</span>
      </template>

      <NForm label-placement="left" label-width="120" size="small">
        <div class="settings-grid">
          <NFormItem :label="t('common.model')">
            <NSpace vertical style="width: 100%">
              <NSelect
                v-model:value="batchSettings.model"
                :options="modelOptions"
                :disabled="isRunning"
              />
              <NInput
                v-if="isCustomModel"
                v-model:value="batchSettings.customModel"
                :placeholder="t('common.custom')"
                :disabled="isRunning"
              />
            </NSpace>
          </NFormItem>

          <NFormItem :label="t('tts.voice')">
            <NSelect
              v-model:value="batchSettings.voice"
              :options="voiceOptions"
              :disabled="isRunning"
            />
          </NFormItem>

          <NFormItem :label="t('tts.outputFormat')">
            <NRadioGroup v-model:value="batchSettings.responseFormat" :disabled="isRunning">
              <NSpace>
                <NRadio v-for="opt in formatOptions" :key="opt.value" :value="opt.value">
                  {{ opt.label }}
                </NRadio>
              </NSpace>
            </NRadioGroup>
          </NFormItem>

          <NFormItem :label="t('tts.speed')">
            <NTooltip>
              <template #trigger>
                <div class="slider-row">
                  <NSlider
                    v-model:value="batchSettings.speed"
                    :min="0.25"
                    :max="4.0"
                    :step="0.05"
                    :disabled="isRunning"
                    style="flex: 1"
                  />
                  <span class="slider-value">{{ batchSettings.speed.toFixed(2) }}x</span>
                </div>
              </template>
              {{ t('tts.speedHint') }}
            </NTooltip>
          </NFormItem>

          <NFormItem :label="t('batch.concurrency')">
            <NTooltip>
              <template #trigger>
                <div class="slider-row">
                  <NSlider
                    v-model:value="concurrency"
                    :min="1"
                    :max="5"
                    :step="1"
                    style="flex: 1"
                  />
                  <span class="slider-value">{{ concurrency }}</span>
                </div>
              </template>
              {{ t('batch.concurrencyHint') }}
            </NTooltip>
          </NFormItem>

          <NFormItem v-if="supportsInstructions" :label="t('tts.instructions')">
            <NInput
              v-model:value="batchSettings.instructions"
              type="textarea"
              :rows="2"
              :placeholder="t('tts.instructionsPlaceholder')"
              :disabled="isRunning"
            />
          </NFormItem>
        </div>
      </NForm>
    </NCard>

    <!-- Input Area -->
    <NCard class="glass-card" size="small">
      <template #header>
        <span class="card-title">{{ t('batch.ttsTexts') }}</span>
      </template>

      <BatchInputArea
        :placeholder="t('batch.ttsInputPlaceholder')"
        :disabled="isRunning"
        input-type="text"
        @add="handleAddTexts"
      />
    </NCard>

    <!-- Progress and Controls -->
    <NCard v-if="totalCount > 0" class="glass-card" size="small">
      <BatchProgressBar
        :total="totalCount"
        :completed="completedCount"
        :failed="failedCount"
        :processing="processingCount"
        :progress="overallProgress"
        :is-running="isRunning"
        :is-paused="isPaused"
      />

      <BatchControlBar
        :is-running="isRunning"
        :is-paused="isPaused"
        :has-items="totalCount > 0"
        :has-failed="failedCount > 0"
        :has-completed="completedCount > 0"
        :disabled="isExporting"
        @start="start"
        @pause="pause"
        @resume="resume"
        @stop="stop"
        @retry-failed="retryFailed"
        @clear-all="clearTasks"
        @clear-completed="clearCompletedTasks"
        @clear-failed="clearFailedTasks"
        @export="handleExport"
      />
    </NCard>

    <!-- Task List -->
    <NCard v-if="totalCount > 0" class="glass-card task-list-card" size="small">
      <template #header>
        <NSpace justify="space-between" align="center" style="width: 100%">
          <span class="card-title">{{ t('common.status') }}</span>
          <NSpace :size="8">
            <NTag type="success" size="small">{{ completedCount }} {{ t('common.completed') }}</NTag>
            <NTag v-if="failedCount > 0" type="error" size="small">{{ failedCount }} {{ t('common.failed') }}</NTag>
            <NTag v-if="pendingCount > 0" type="default" size="small">{{ pendingCount }} {{ t('common.pending') }}</NTag>
          </NSpace>
        </NSpace>
      </template>

      <BatchTaskList
        :tasks="tasks"
        :show-input="true"
        :input-formatter="formatInput"
        max-height="350px"
        @retry="retryTask"
        @cancel="cancelTask"
        @remove="removeTask"
      />

      <!-- Completed Audio Preview -->
      <div v-if="completedCount > 0" class="completed-preview">
        <div class="preview-title">{{ t('tts.result') }}</div>
        <div class="audio-list">
          <div
            v-for="task in tasks.filter(t => t.status === 'completed' && t.result)"
            :key="task.id"
            class="audio-item"
          >
            <div class="audio-text">{{ formatInput(task.input) }}</div>
            <div class="audio-controls">
              <NTag size="tiny" type="info">{{ batchSettings.voice }}</NTag>
              <button class="play-btn" @click="playAudio(task.result!.url)">▶</button>
            </div>
          </div>
        </div>
      </div>
    </NCard>
  </div>
</template>

<style scoped>
.batch-tts-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.card-title {
  font-size: 14px;
  font-weight: 600;
}

.settings-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px 24px;
}

@media (max-width: 768px) {
  .settings-grid {
    grid-template-columns: 1fr;
  }
}

.slider-row {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
}

.slider-value {
  min-width: 40px;
  text-align: right;
  font-family: ui-monospace, monospace;
  font-size: 13px;
}

.task-list-card :deep(.n-card__content) {
  padding-top: 0;
}

.completed-preview {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.preview-title {
  font-size: 13px;
  font-weight: 500;
  margin-bottom: 12px;
  opacity: 0.8;
}

.audio-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 200px;
  overflow-y: auto;
}

.audio-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 8px;
  gap: 12px;
}

.audio-text {
  flex: 1;
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.audio-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.play-btn {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: none;
  background: linear-gradient(135deg, #7c3aed, #06b6d4);
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  transition: transform 0.2s;
}

.play-btn:hover {
  transform: scale(1.1);
}
</style>
