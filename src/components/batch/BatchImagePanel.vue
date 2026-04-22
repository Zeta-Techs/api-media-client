<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  NCard, NForm, NFormItem, NSelect, NSpace, NInput, NInputNumber,
  NSlider, NTooltip, NTag
} from 'naive-ui'
import { useConfigStore } from '@/stores/config'
import { useHistoryStore } from '@/stores/history'
import { message } from '@/composables/useNaiveMessage'
import { parseApiError } from '@/utils/api'
import { useBatchQueue, type TaskProcessor } from '@/composables/useBatchQueue'
import { useBatchExport } from '@/composables/useBatchExport'
import { useCloudStorage } from '@/composables/useCloudStorage'
import BatchInputArea from './BatchInputArea.vue'
import BatchTaskList from './BatchTaskList.vue'
import BatchProgressBar from './BatchProgressBar.vue'
import BatchControlBar from './BatchControlBar.vue'

interface ImageResult {
  url: string
  revisedPrompt?: string
  cloudUrl?: string
}

const GPT_IMAGE_2_SIZE_OPTIONS = [
  { label: 'auto', value: 'auto' },
  { label: '1024x1024 (Square)', value: '1024x1024' },
  { label: '1536x1024 (Landscape)', value: '1536x1024' },
  { label: '1024x1536 (Portrait)', value: '1024x1536' },
  { label: '2048x2048 (2K Square)', value: '2048x2048' },
  { label: '2048x1152 (2K Landscape)', value: '2048x1152' },
  { label: '3840x2160 (4K Landscape)', value: '3840x2160' },
  { label: '2160x3840 (4K Portrait)', value: '2160x3840' }
]

const { t } = useI18n()
const configStore = useConfigStore()
const historyStore = useHistoryStore()
const { uploadFile, autoUploadEnabled } = useCloudStorage()

// Form settings (shared for all batch tasks)
const batchSettings = ref({
  model: 'gpt-image-2',
  size: 'auto',
  customSize: '',
  quality: 'auto',
  outputFormat: 'png',
  outputCompression: 100,
  background: 'auto',
  moderation: 'auto'
})

// Concurrency setting
const concurrency = ref(2)

const batchSupportsOutputFormat = computed(() =>
  batchSettings.value.model === 'gpt-image-2' || batchSettings.value.model === 'gpt-image-1'
)

const batchSupportsCompression = computed(() =>
  batchSupportsOutputFormat.value &&
  (batchSettings.value.outputFormat === 'jpeg' || batchSettings.value.outputFormat === 'webp')
)

const batchSupportsBackground = computed(() =>
  batchSettings.value.model === 'gpt-image-2' || batchSettings.value.model === 'gpt-image-1'
)

const batchSupportsModeration = computed(() =>
  batchSettings.value.model === 'gpt-image-2' || batchSettings.value.model === 'gpt-image-1'
)

const batchSupportsQuality = computed(() =>
  batchSettings.value.model === 'gpt-image-2' ||
  batchSettings.value.model === 'gpt-image-1' ||
  batchSettings.value.model === 'dall-e-3'
)

const resolvedBatchSize = computed(() =>
  batchSettings.value.size === 'custom' ? batchSettings.value.customSize.trim() : batchSettings.value.size
)

function getBatchMimeType(outputFormat: string): string {
  if (outputFormat === 'jpeg') return 'image/jpeg'
  if (outputFormat === 'webp') return 'image/webp'
  return 'image/png'
}

function validateBatchCustomSize(size: string): string | null {
  if (!size) return t('dalle.customSizeRequired')

  const match = size.match(/^(\d+)x(\d+)$/i)
  if (!match) return t('dalle.customSizeFormatHint')

  const width = Number(match[1])
  const height = Number(match[2])

  if (width % 16 !== 0 || height % 16 !== 0) return t('dalle.customSizeMultipleOf16')
  if (Math.max(width, height) > 3840) return t('dalle.customSizeMaxEdge')

  const ratio = Math.max(width, height) / Math.min(width, height)
  if (ratio > 3) return t('dalle.customSizeAspectRatio')

  const totalPixels = width * height
  if (totalPixels < 655360 || totalPixels > 8294400) return t('dalle.customSizePixelRange')

  return null
}

// Image processor function
const processImage: TaskProcessor<string, ImageResult> = async (prompt, onProgress, signal) => {
  const body: Record<string, any> = {
    model: batchSettings.value.model,
    prompt: prompt,
    n: 1
  }

  if (resolvedBatchSize.value !== 'auto') {
    body.size = resolvedBatchSize.value
  }

  if (batchSupportsQuality.value) {
    body.quality = batchSettings.value.quality
  }

  if (batchSupportsBackground.value) {
    body.background = batchSettings.value.background
  }

  if (batchSupportsOutputFormat.value) {
    body.output_format = batchSettings.value.outputFormat
    if (batchSupportsCompression.value) {
      body.output_compression = batchSettings.value.outputCompression
    }
  }

  if (batchSupportsModeration.value) {
    body.moderation = batchSettings.value.moderation
  }

  onProgress(10) // Started

  const url = configStore.baseUrl.replace(/\/$/, '') + '/v1/images/generations'
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

  const text = await res.text()
  if (!res.ok) throw parseApiError(text, res.status)
  const response = JSON.parse(text)

  onProgress(90) // Processing response

  if (response.data && response.data[0]) {
    const item = response.data[0]
    let resultUrl = ''
    let blob: Blob | null = null

    if (item.b64_json) {
      const mimeType = getBatchMimeType(batchSettings.value.outputFormat)
      blob = base64ToBlob(item.b64_json, mimeType)
      resultUrl = URL.createObjectURL(blob)
    } else if (item.url) {
      resultUrl = item.url
    }

    // Auto-upload to cloud storage if enabled
    let cloudUrl: string | undefined
    if (autoUploadEnabled.value && blob) {
      onProgress(92)
      const filename = `image-${Date.now()}.${batchSettings.value.outputFormat}`
      const uploadResult = await uploadFile(blob, filename, 'image')
      if (uploadResult.success && uploadResult.url) {
        cloudUrl = uploadResult.url
      }
    }

    // Save to history
    historyStore.addItem({
      type: 'image',
      status: 'completed',
      params: {
        prompt,
        model: batchSettings.value.model,
        customModel: '',
        format: 'gpt-image',
        mode: 'generate',
        editInputSource: 'upload',
        size: resolvedBatchSize.value,
        sizePreset: batchSettings.value.size,
        customSize: batchSettings.value.customSize,
        quality: batchSettings.value.quality,
        background: batchSettings.value.background,
        outputFormat: batchSettings.value.outputFormat,
        outputCompression: batchSettings.value.outputCompression,
        n: 1,
        moderation: batchSettings.value.moderation,
        referenceImages: [],
        referenceImageUrls: [],
        maskUrl: ''
      },
      result: { thumbnail: resultUrl.substring(0, 100) }
    })

    return {
      url: resultUrl,
      revisedPrompt: item.revised_prompt,
      cloudUrl
    }
  }

  throw new Error('No image data in response')
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
} = useBatchQueue<string, ImageResult>(processImage, {
  concurrency: concurrency.value,
  retryCount: 1,
  continueOnError: true
})

// Export functionality
const { exportAsZIP, exportTaskResults, isExporting } = useBatchExport({
  filenamePrefix: 'batch-images'
})

// Watch concurrency changes
watch(concurrency, (val) => {
  updateConfig({ concurrency: val })
})

watch(() => batchSettings.value.model, (model) => {
  if (model === 'gpt-image-2') {
    const presetValues = new Set(GPT_IMAGE_2_SIZE_OPTIONS.map(option => option.value))
    if (!presetValues.has(batchSettings.value.size) && batchSettings.value.size !== 'custom') {
      batchSettings.value.customSize = batchSettings.value.size
      batchSettings.value.size = 'custom'
    }
  } else {
    const sizeMap: Record<string, string> = {
      'gpt-image-1': '1024x1024',
      'dall-e-3': '1024x1024',
      'dall-e-2': '1024x1024'
    }
    const allowedSizes: Record<string, string[]> = {
      'gpt-image-1': ['1024x1024', '1536x1024', '1024x1536', 'auto'],
      'dall-e-3': ['1024x1024', '1792x1024', '1024x1792'],
      'dall-e-2': ['1024x1024', '512x512', '256x256']
    }
    if (!allowedSizes[model]?.includes(batchSettings.value.size)) {
      batchSettings.value.size = sizeMap[model] || '1024x1024'
    }
    batchSettings.value.background = 'auto'
    batchSettings.value.moderation = 'auto'
    if (model !== 'gpt-image-1') {
      batchSettings.value.outputFormat = 'png'
      batchSettings.value.outputCompression = 100
    }
  }
})

// Model options
const modelOptions = [
  { label: 'gpt-image-2 (GPT Image 2)', value: 'gpt-image-2' },
  { label: 'gpt-image-1 (GPT Image)', value: 'gpt-image-1' },
  { label: 'dall-e-3', value: 'dall-e-3' },
  { label: 'dall-e-2', value: 'dall-e-2' }
]

const sizeOptions = computed(() => {
  const map: Record<string, Array<{ label: string; value: string }>> = {
    'gpt-image-2': [
      ...GPT_IMAGE_2_SIZE_OPTIONS,
      { label: t('dalle.customSizeOption'), value: 'custom' }
    ],
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
  return map[batchSettings.value.model] || map['gpt-image-2']
})

const qualityOptions = computed(() => [
  { label: t('dalle.qualityOptions.auto'), value: 'auto' },
  { label: t('dalle.qualityOptions.low'), value: 'low' },
  { label: t('dalle.qualityOptions.medium'), value: 'medium' },
  { label: t('dalle.qualityOptions.high'), value: 'high' }
])

const outputFormatOptions = [
  { label: 'PNG', value: 'png' },
  { label: 'JPEG', value: 'jpeg' },
  { label: 'WebP', value: 'webp' }
]

const backgroundOptions = computed(() => [
  { label: t('dalle.backgroundOptions.auto'), value: 'auto' },
  { label: t('dalle.backgroundOptions.opaque'), value: 'opaque' }
])

const moderationOptions = computed(() => [
  { label: t('dalle.moderationOptions.auto'), value: 'auto' },
  { label: t('dalle.moderationOptions.low'), value: 'low' }
])

// Helper function
function base64ToBlob(base64: string, mimeType: string): Blob {
  const byteCharacters = atob(base64)
  const byteNumbers = new Array(byteCharacters.length)
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i)
  }
  const byteArray = new Uint8Array(byteNumbers)
  return new Blob([byteArray], { type: mimeType })
}

// Add prompts to queue
function handleAddPrompts(prompts: string[]) {
  if (!configStore.apiKey) {
    message.error(t('errors.missingApiKey'))
    return
  }
  if (batchSettings.value.model === 'gpt-image-2' && resolvedBatchSize.value !== 'auto') {
    const sizeError = validateBatchCustomSize(resolvedBatchSize.value)
    if (sizeError) {
      message.error(sizeError)
      return
    }
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
    // Export images as ZIP
    const items = completedTasks.map((task, idx) => ({
      id: task.id,
      filename: `image-${idx + 1}.${batchSettings.value.outputFormat}`,
      data: task.result!.url
    }))

    // Fetch all blob URLs and create ZIP
    const blobs: Array<{ blob: Blob; filename: string }> = []
    for (const item of items) {
      try {
        const res = await fetch(item.data)
        const blob = await res.blob()
        blobs.push({ blob, filename: item.filename })
      } catch (e) {
        console.error('Failed to fetch image:', e)
      }
    }

    if (blobs.length > 0) {
      await exportAsZIP(blobs.map(b => ({
        id: b.filename,
        filename: b.filename,
        data: b.blob
      })))
      message.success(t('batch.export') + ' ZIP')
    }
  } else {
    exportTaskResults(tasks.value as any, format)
    message.success(t('batch.export') + ` ${format.toUpperCase()}`)
  }
}

// Format input for display
function formatInput(input: string): string {
  return input.length > 60 ? input.slice(0, 60) + '...' : input
}

// Preview completed image
function previewImage(url: string) {
  window.open(url, '_blank')
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
  <div class="batch-image-panel">
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

          <NFormItem :label="t('dalle.size')">
            <NSpace vertical style="width: 100%">
              <NSelect
                v-model:value="batchSettings.size"
                :options="sizeOptions"
                :disabled="isRunning"
              />
              <NInput
                v-if="batchSettings.model === 'gpt-image-2' && batchSettings.size === 'custom'"
                v-model:value="batchSettings.customSize"
                :disabled="isRunning"
                :placeholder="t('dalle.customSizePlaceholder')"
              />
              <div v-if="batchSettings.model === 'gpt-image-2'" class="setting-hint">
                {{ t('dalle.customSizeHint') }}
              </div>
            </NSpace>
          </NFormItem>

          <NFormItem v-if="batchSupportsQuality" :label="t('dalle.quality')">
            <NSelect
              v-model:value="batchSettings.quality"
              :options="qualityOptions"
              :disabled="isRunning"
            />
          </NFormItem>

          <NFormItem v-if="batchSupportsBackground" :label="t('dalle.background')">
            <NSelect
              v-model:value="batchSettings.background"
              :options="backgroundOptions"
              :disabled="isRunning"
            />
          </NFormItem>

          <NFormItem v-if="batchSupportsOutputFormat" :label="t('dalle.outputFormat')">
            <NSelect
              v-model:value="batchSettings.outputFormat"
              :options="outputFormatOptions"
              :disabled="isRunning"
            />
          </NFormItem>

          <NFormItem v-if="batchSupportsCompression" :label="t('dalle.compression')">
            <NInputNumber
              v-model:value="batchSettings.outputCompression"
              :min="0"
              :max="100"
              :disabled="isRunning"
              style="width: 100%"
            />
          </NFormItem>

          <NFormItem v-if="batchSupportsModeration" :label="t('dalle.moderation')">
            <NSelect
              v-model:value="batchSettings.moderation"
              :options="moderationOptions"
              :disabled="isRunning"
            />
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
        <span class="card-title">{{ t('batch.imagePrompts') }}</span>
      </template>

      <BatchInputArea
        :placeholder="t('batch.inputPlaceholder')"
        :disabled="isRunning"
        input-type="text"
        @add="handleAddPrompts"
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

      <!-- Completed Images Preview -->
      <div v-if="completedCount > 0" class="completed-preview">
        <div class="preview-title">{{ t('dalle.result') }}</div>
        <div class="preview-grid">
          <div
            v-for="task in tasks.filter(t => t.status === 'completed' && t.result)"
            :key="task.id"
            class="preview-item"
            @click="previewImage(task.result!.url)"
          >
            <img :src="task.result!.url" :alt="task.input" />
          </div>
        </div>
      </div>
    </NCard>
  </div>
</template>

<style scoped>
.batch-image-panel {
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
  min-width: 24px;
  text-align: right;
  font-family: ui-monospace, monospace;
  font-size: 13px;
}

.setting-hint {
  font-size: 12px;
  opacity: 0.65;
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

.preview-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 12px;
}

.preview-item {
  aspect-ratio: 1;
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  transition: transform 0.2s;
}

.preview-item:hover {
  transform: scale(1.05);
}

.preview-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
</style>
