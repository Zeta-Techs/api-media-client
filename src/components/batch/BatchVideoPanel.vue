<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  NCard, NForm, NFormItem, NSelect, NSpace,
  NTooltip, NTag, NSlider
} from 'naive-ui'
import { useConfigStore } from '@/stores/config'
import { message } from '@/composables/useNaiveMessage'
import { useBatchQueue, type TaskProcessor } from '@/composables/useBatchQueue'
import { useBatchExport } from '@/composables/useBatchExport'
import { useCloudStorage } from '@/composables/useCloudStorage'
import BatchInputArea from './BatchInputArea.vue'
import BatchTaskList from './BatchTaskList.vue'
import BatchProgressBar from './BatchProgressBar.vue'
import BatchControlBar from './BatchControlBar.vue'

interface VideoResult {
  taskId: string
  url: string
  blob: Blob
  cloudUrl?: string
}

const { t } = useI18n()
const configStore = useConfigStore()
const { uploadFile, autoUploadEnabled } = useCloudStorage()

// Form settings (shared for all batch tasks)
const batchSettings = ref({
  model: 'sora-2',
  customModel: '',
  seconds: '4',
  customSeconds: '',
  size: '1280x720'
})

// Concurrency setting (lower for video due to heavy processing)
const concurrency = ref(1)

// Model options
const modelOptions = [
  { label: 'sora-2', value: 'sora-2' },
  { label: 'sora-2-pro', value: 'sora-2-pro' },
  { label: computed(() => t('common.custom')).value, value: 'custom' }
]

// Seconds options
const secondsOptions = [
  { label: '4s', value: '4' },
  { label: '8s', value: '8' },
  { label: '12s', value: '12' },
  { label: computed(() => t('common.custom')).value, value: 'custom' }
]

// Size options based on model
const sizeOptionsMap: Record<string, Array<{ label: string; value: string }>> = {
  'sora-2': [
    { label: 'Portrait: 720x1280', value: '720x1280' },
    { label: 'Landscape: 1280x720', value: '1280x720' }
  ],
  'sora-2-pro': [
    { label: 'Portrait: 720x1280', value: '720x1280' },
    { label: 'Landscape: 1280x720', value: '1280x720' },
    { label: 'Portrait: 1024x1792', value: '1024x1792' },
    { label: 'Landscape: 1792x1024', value: '1792x1024' }
  ]
}

const sizeOptions = computed(() => {
  if (batchSettings.value.model === 'custom') return []
  return sizeOptionsMap[batchSettings.value.model] || sizeOptionsMap['sora-2']
})

const isCustomModel = computed(() => batchSettings.value.model === 'custom')
const isCustomSeconds = computed(() => batchSettings.value.seconds === 'custom')

const actualModel = computed(() =>
  isCustomModel.value ? batchSettings.value.customModel : batchSettings.value.model
)
const actualSeconds = computed(() =>
  isCustomSeconds.value ? batchSettings.value.customSeconds : batchSettings.value.seconds
)

// Watch model changes to update size options
watch(() => batchSettings.value.model, (newModel) => {
  if (newModel !== 'custom') {
    const options = sizeOptionsMap[newModel] || sizeOptionsMap['sora-2']
    if (!options.find(o => o.value === batchSettings.value.size)) {
      batchSettings.value.size = options[0]?.value || ''
    }
  }
})

// Parse API error
function parseApiError(text: string, status: number): Error {
  try {
    const j = JSON.parse(text)
    if (j?.error?.message) {
      return new Error(`API ${status}: ${j.error.message} (${j.error.code || ''})`)
    }
  } catch {
    // ignore
  }
  return new Error(`API ${status}: ${text || 'unknown error'}`)
}

// Sleep utility
function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms))
}

// Video processor function with polling
const processVideo: TaskProcessor<string, VideoResult> = async (prompt, onProgress, signal) => {
  onProgress(5) // Started

  const baseURL = configStore.baseUrl.replace(/\/$/, '')

  // Step 1: Create video task
  const fd = new FormData()
  fd.set('prompt', prompt)
  fd.set('model', actualModel.value)
  fd.set('seconds', String(actualSeconds.value))
  fd.set('size', batchSettings.value.size)

  const createRes = await fetch(baseURL + '/v1/videos', {
    method: 'POST',
    headers: { Authorization: `Bearer ${configStore.apiKey}` },
    body: fd,
    signal
  })

  const createText = await createRes.text()
  if (!createRes.ok) throw parseApiError(createText, createRes.status)

  let created: { id?: string; task_id?: string }
  try {
    created = JSON.parse(createText)
  } catch {
    throw new Error('Invalid JSON from create')
  }

  const taskId = created.id || created.task_id
  if (!taskId) throw new Error('No task ID returned')

  onProgress(10) // Task created

  // Step 2: Poll for completion
  let attempts = 0
  const maxAttempts = 200 // ~10 minutes with 3s interval

  while (attempts < maxAttempts) {
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError')

    const statusRes = await fetch(baseURL + '/v1/videos/' + encodeURIComponent(taskId), {
      headers: { Authorization: `Bearer ${configStore.apiKey}` },
      signal
    })

    const statusText = await statusRes.text()
    if (!statusRes.ok) throw parseApiError(statusText, statusRes.status)

    let st: { status?: string; progress?: number; error?: { message?: string } }
    try {
      st = JSON.parse(statusText)
    } catch {
      throw new Error('Invalid JSON from status')
    }

    const status = (st.status || '').toLowerCase()
    const pct = typeof st.progress === 'number' ? st.progress : undefined

    // Update progress (10-80 range for polling)
    if (typeof pct === 'number') {
      onProgress(10 + Math.floor(pct * 0.7))
    }

    if (status === 'completed') {
      break
    }

    if (status === 'failed' || status === 'cancelled') {
      throw new Error(st.error?.message || `Task ${status}`)
    }

    await sleep(3000)
    attempts++
  }

  if (attempts >= maxAttempts) {
    throw new Error(t('video.errors.timeout'))
  }

  onProgress(85) // Downloading

  // Step 3: Fetch video content
  let contentRes = await fetch(baseURL + '/v1/videos/' + encodeURIComponent(taskId) + '/content', { signal })
  if (!contentRes.ok && contentRes.status === 401) {
    contentRes = await fetch(baseURL + '/v1/videos/' + encodeURIComponent(taskId) + '/content', {
      headers: { Authorization: `Bearer ${configStore.apiKey}` },
      signal
    })
  }

  if (!contentRes.ok) {
    const errText = await contentRes.text().catch(() => '')
    throw parseApiError(errText, contentRes.status)
  }

  const blob = await contentRes.blob()
  onProgress(95)

  const localUrl = URL.createObjectURL(blob)

  // Auto-upload to cloud storage if enabled
  let cloudUrl: string | undefined
  if (autoUploadEnabled.value) {
    onProgress(97)
    const filename = `video-${Date.now()}.mp4`
    const uploadResult = await uploadFile(blob, filename, 'video')
    if (uploadResult.success && uploadResult.url) {
      cloudUrl = uploadResult.url
    }
  }

  onProgress(100)

  return {
    taskId,
    url: localUrl,
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
} = useBatchQueue<string, VideoResult>(processVideo, {
  concurrency: concurrency.value,
  retryCount: 1,
  continueOnError: true
})

// Export functionality
const { exportBlobsAsZIP, isExporting } = useBatchExport({
  filenamePrefix: 'batch-videos'
})

// Watch concurrency changes
watch(concurrency, (val) => {
  updateConfig({ concurrency: val })
})

// Add prompts to queue
function handleAddPrompts(prompts: string[]) {
  if (!configStore.apiKey) {
    message.error(t('errors.missingApiKey'))
    return
  }
  addTasks(prompts)
  message.success(t('batch.addToQueue') + `: ${prompts.length}`)
}

// Export handlers
async function handleExport(format: 'json' | 'csv' | 'zip') {
  const completedTasks = tasks.value.filter(t => t.status === 'completed' && t.result)

  if (completedTasks.length === 0) {
    message.warning(t('batch.noTasks'))
    return
  }

  if (format === 'zip') {
    // Export as ZIP with all videos
    const files = completedTasks.map((task, idx) => ({
      filename: `video-${idx + 1}-${task.result!.taskId}.mp4`,
      blob: task.result!.blob
    }))
    await exportBlobsAsZIP(files)
    message.success(t('batch.export') + ' ZIP')
  } else {
    // Export metadata as JSON/CSV
    const exportData = completedTasks.map((task) => ({
      prompt: task.input,
      taskId: task.result!.taskId
    }))

    if (format === 'csv') {
      const headers = ['prompt', 'taskId']
      const rows = exportData.map(d => [
        `"${d.prompt.replace(/"/g, '""')}"`,
        d.taskId
      ].join(','))
      const csv = [headers.join(','), ...rows].join('\n')

      const blob = new Blob([csv], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `batch-videos-${Date.now()}.csv`
      a.click()
      URL.revokeObjectURL(url)
      message.success(t('batch.export') + ' CSV')
    } else {
      const json = JSON.stringify(exportData, null, 2)
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `batch-videos-${Date.now()}.json`
      a.click()
      URL.revokeObjectURL(url)
      message.success(t('batch.export') + ' JSON')
    }
  }
}

// Format input for display
function formatInput(prompt: string): string {
  return prompt.length > 50 ? prompt.slice(0, 50) + '...' : prompt
}

// Cleanup on unmount
onUnmounted(() => {
  stop()
  // Revoke all video URLs
  tasks.value.forEach(task => {
    if (task.result?.url) {
      URL.revokeObjectURL(task.result.url)
    }
  })
})
</script>

<template>
  <div class="batch-video-panel">
    <!-- Settings Card -->
    <NCard class="glass-card settings-card" size="small">
      <template #header>
        <span class="card-title">{{ t('batch.queueConfig') }}</span>
      </template>

      <NForm label-placement="left" label-width="100" size="small">
        <div class="settings-grid">
          <NFormItem :label="t('common.model')">
            <NSelect
              v-model:value="batchSettings.model"
              :options="modelOptions"
              :disabled="isRunning"
            />
          </NFormItem>

          <NFormItem :label="t('video.seconds')">
            <NSelect
              v-model:value="batchSettings.seconds"
              :options="secondsOptions"
              :disabled="isRunning"
            />
          </NFormItem>

          <NFormItem :label="t('video.size')">
            <NSelect
              v-model:value="batchSettings.size"
              :options="sizeOptions"
              :disabled="isRunning || isCustomModel"
            />
          </NFormItem>

          <NFormItem :label="t('batch.concurrency')">
            <NTooltip>
              <template #trigger>
                <div class="slider-row">
                  <NSlider
                    v-model:value="concurrency"
                    :min="1"
                    :max="3"
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
        <span class="card-title">{{ t('batch.videoPrompts') }}</span>
      </template>

      <BatchInputArea
        :placeholder="t('batch.videoInputPlaceholder')"
        :disabled="isRunning"
        input-type="text"
        @add-prompts="handleAddPrompts"
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
        :show-zip="true"
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

      <!-- Completed Videos Preview -->
      <div v-if="completedCount > 0" class="completed-preview">
        <div class="preview-title">{{ t('video.videoReady') }}</div>
        <div class="video-grid">
          <div
            v-for="task in tasks.filter(t => t.status === 'completed' && t.result)"
            :key="task.id"
            class="video-item"
          >
            <video :src="task.result?.url" controls class="video-thumbnail" />
            <div class="video-info">
              <NTooltip>
                <template #trigger>
                  <span class="video-prompt">{{ task.input.slice(0, 30) }}{{ task.input.length > 30 ? '...' : '' }}</span>
                </template>
                {{ task.input }}
              </NTooltip>
              <NTag size="tiny" type="info">{{ task.result?.taskId?.slice(0, 8) }}...</NTag>
            </div>
          </div>
        </div>
      </div>
    </NCard>
  </div>
</template>

<style scoped>
.batch-video-panel {
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

.video-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px;
}

.video-item {
  background: rgba(255, 255, 255, 0.03);
  border-radius: 8px;
  overflow: hidden;
}

.video-thumbnail {
  width: 100%;
  aspect-ratio: 16/9;
  object-fit: cover;
  background: #000;
}

.video-info {
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.video-prompt {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.8);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
