<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  NCard, NForm, NFormItem, NSelect, NSpace,
  NSlider, NTooltip, NTag
} from 'naive-ui'
import { useConfigStore } from '@/stores/config'
import { message } from '@/composables/useNaiveMessage'
import { parseApiError } from '@/utils/api'
import { useBatchQueue, type TaskProcessor } from '@/composables/useBatchQueue'
import { useBatchExport } from '@/composables/useBatchExport'
import BatchInputArea from './BatchInputArea.vue'
import BatchTaskList from './BatchTaskList.vue'
import BatchProgressBar from './BatchProgressBar.vue'
import BatchControlBar from './BatchControlBar.vue'

interface TranscriptionResult {
  text: string
  duration?: number
  language?: string
}

const { t } = useI18n()
const configStore = useConfigStore()

// Form settings (shared for all batch tasks)
const batchSettings = ref({
  model: 'whisper-1',
  customModel: '',
  language: '',
  responseFormat: 'json',
  temperature: 0
})

// Concurrency setting
const concurrency = ref(2)

// Model options
const modelOptions = [
  { label: 'whisper-1', value: 'whisper-1' },
  { label: 'gpt-4o-transcribe', value: 'gpt-4o-transcribe' },
  { label: 'gpt-4o-mini-transcribe', value: 'gpt-4o-mini-transcribe' },
  { label: computed(() => t('common.custom')).value, value: 'custom' }
]

// Language options
const languageOptions = [
  { label: computed(() => t('audio.languages.auto')).value, value: '' },
  { label: 'English', value: 'en' },
  { label: '简体中文', value: 'zh' },
  { label: '日本語', value: 'ja' },
  { label: '한국어', value: 'ko' },
  { label: 'Español', value: 'es' },
  { label: 'Français', value: 'fr' },
  { label: 'Deutsch', value: 'de' }
]

// Format options
const formatOptions = [
  { label: 'JSON', value: 'json' },
  { label: 'Text', value: 'text' },
  { label: 'SRT', value: 'srt' },
  { label: 'VTT', value: 'vtt' }
]

const isCustomModel = computed(() => batchSettings.value.model === 'custom')
const actualModel = computed(() =>
  isCustomModel.value ? batchSettings.value.customModel : batchSettings.value.model
)

// Audio processor function
const processAudio: TaskProcessor<File, TranscriptionResult> = async (file, onProgress, signal) => {
  onProgress(10) // Started

  const fd = new FormData()
  fd.set('file', file, file.name)
  fd.set('model', actualModel.value)

  if (batchSettings.value.language) {
    fd.set('language', batchSettings.value.language)
  }
  if (batchSettings.value.responseFormat) {
    fd.set('response_format', batchSettings.value.responseFormat)
  }
  if (batchSettings.value.temperature > 0) {
    fd.set('temperature', batchSettings.value.temperature.toString())
  }

  const url = configStore.baseUrl.replace(/\/$/, '') + '/v1/audio/transcriptions'
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${configStore.apiKey}`
    },
    body: fd,
    signal
  })

  onProgress(80) // Request complete

  const text = await res.text()
  if (!res.ok) throw parseApiError(text, res.status)

  onProgress(90)

  // Parse based on format
  if (batchSettings.value.responseFormat === 'json') {
    const data = JSON.parse(text)
    return {
      text: data.text,
      duration: data.duration,
      language: data.language
    }
  }

  return { text }
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
} = useBatchQueue<File, TranscriptionResult>(processAudio, {
  concurrency: concurrency.value,
  retryCount: 1,
  continueOnError: true
})

// Export functionality
const { isExporting } = useBatchExport({
  filenamePrefix: 'batch-transcriptions'
})

// Watch concurrency changes
watch(concurrency, (val) => {
  updateConfig({ concurrency: val })
})

// Add files to queue
function handleAddFiles(files: File[]) {
  if (!configStore.apiKey) {
    message.error(t('errors.missingApiKey'))
    return
  }
  addTasks(files)
  message.success(t('batch.addToQueue') + `: ${files.length}`)
}

// Export handlers
function handleExport(format: 'json' | 'csv' | 'zip') {
  const completedTasks = tasks.value.filter(t => t.status === 'completed' && t.result)

  if (completedTasks.length === 0) {
    message.warning(t('batch.noTasks'))
    return
  }

  // Prepare data for export
  const exportData = completedTasks.map((task) => ({
    filename: task.input.name,
    text: task.result!.text,
    duration: task.result!.duration,
    language: task.result!.language
  }))

  if (format === 'csv') {
    // Build CSV manually
    const headers = ['filename', 'text', 'duration', 'language']
    const rows = exportData.map(d => [
      `"${d.filename}"`,
      `"${d.text.replace(/"/g, '""')}"`,
      d.duration ?? '',
      d.language ?? ''
    ].join(','))
    const csv = [headers.join(','), ...rows].join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `batch-transcriptions-${Date.now()}.csv`
    a.click()
    URL.revokeObjectURL(url)
    message.success(t('batch.export') + ' CSV')
  } else {
    // JSON export
    const json = JSON.stringify(exportData, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `batch-transcriptions-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
    message.success(t('batch.export') + ' JSON')
  }
}

// Format input for display
function formatInput(file: File): string {
  return file.name.length > 40 ? file.name.slice(0, 40) + '...' : file.name
}

// Cleanup on unmount
onUnmounted(() => {
  stop()
})
</script>

<template>
  <div class="batch-audio-panel">
    <!-- Settings Card -->
    <NCard class="glass-card settings-card" size="small">
      <template #header>
        <span class="card-title">{{ t('batch.queueConfig') }}</span>
      </template>

      <NForm label-placement="left" label-width="120" size="small">
        <div class="settings-grid">
          <NFormItem :label="t('common.model')">
            <NSelect
              v-model:value="batchSettings.model"
              :options="modelOptions"
              :disabled="isRunning"
            />
          </NFormItem>

          <NFormItem :label="t('audio.language')">
            <NSelect
              v-model:value="batchSettings.language"
              :options="languageOptions"
              :disabled="isRunning"
              clearable
            />
          </NFormItem>

          <NFormItem :label="t('audio.responseFormat')">
            <NSelect
              v-model:value="batchSettings.responseFormat"
              :options="formatOptions"
              :disabled="isRunning"
            />
          </NFormItem>

          <NFormItem :label="t('audio.temperature')">
            <NTooltip>
              <template #trigger>
                <div class="slider-row">
                  <NSlider
                    v-model:value="batchSettings.temperature"
                    :min="0"
                    :max="1"
                    :step="0.1"
                    :disabled="isRunning"
                    style="flex: 1"
                  />
                  <span class="slider-value">{{ batchSettings.temperature.toFixed(1) }}</span>
                </div>
              </template>
              {{ t('audio.temperatureHint') }}
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
        </div>
      </NForm>
    </NCard>

    <!-- Input Area -->
    <NCard class="glass-card" size="small">
      <template #header>
        <span class="card-title">{{ t('batch.audioFiles') }}</span>
      </template>

      <BatchInputArea
        :placeholder="t('batch.audioInputPlaceholder')"
        :disabled="isRunning"
        input-type="file"
        accept-files=".flac,.mp3,.mp4,.mpeg,.mpga,.m4a,.ogg,.wav,.webm"
        @add-files="handleAddFiles"
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
        :show-zip="false"
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

      <!-- Completed Transcriptions Preview -->
      <div v-if="completedCount > 0" class="completed-preview">
        <div class="preview-title">{{ t('audio.result') }}</div>
        <div class="transcription-list">
          <div
            v-for="task in tasks.filter(t => t.status === 'completed' && t.result)"
            :key="task.id"
            class="transcription-item"
          >
            <div class="transcription-header">
              <span class="file-name">{{ task.input.name }}</span>
              <NSpace :size="4">
                <NTag v-if="task.result?.language" size="tiny" type="info">{{ task.result.language }}</NTag>
                <NTag v-if="task.result?.duration" size="tiny">{{ Math.round(task.result.duration) }}s</NTag>
              </NSpace>
            </div>
            <div class="transcription-text">{{ task.result?.text?.slice(0, 200) }}{{ (task.result?.text?.length || 0) > 200 ? '...' : '' }}</div>
          </div>
        </div>
      </div>
    </NCard>
  </div>
</template>

<style scoped>
.batch-audio-panel {
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
  min-width: 30px;
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

.transcription-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: 300px;
  overflow-y: auto;
}

.transcription-item {
  padding: 12px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 8px;
}

.transcription-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.file-name {
  font-size: 13px;
  font-weight: 500;
  color: #7c3aed;
}

.transcription-text {
  font-size: 13px;
  line-height: 1.5;
  opacity: 0.8;
}
</style>
