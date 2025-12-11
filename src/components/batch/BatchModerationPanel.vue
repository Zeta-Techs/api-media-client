<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  NCard, NForm, NFormItem, NSelect, NSlider, NSpace,
  NTooltip, NTag, NProgress, NScrollbar
} from 'naive-ui'
import { useConfigStore } from '@/stores/config'
import { message } from '@/composables/useNaiveMessage'
import { parseApiError } from '@/utils/api'
import { useBatchQueue, type TaskProcessor } from '@/composables/useBatchQueue'
import BatchInputArea from './BatchInputArea.vue'
import BatchTaskList from './BatchTaskList.vue'
import BatchProgressBar from './BatchProgressBar.vue'
import BatchControlBar from './BatchControlBar.vue'

// Moderation result type
interface ModerationResult {
  flagged: boolean
  categories: Record<string, boolean>
  category_scores: Record<string, number>
}

// Task input type
interface ModerationInput {
  type: 'text' | 'image'
  content: string
  preview: string
}

const { t } = useI18n()
const configStore = useConfigStore()

// Form settings
const batchSettings = ref({
  model: 'omni-moderation-latest',
  customModel: ''
})

// Concurrency setting
const concurrency = ref(3)

// Model options
const modelOptions = [
  { label: 'omni-moderation-latest', value: 'omni-moderation-latest' },
  { label: 'text-moderation-latest', value: 'text-moderation-latest' },
  { label: computed(() => t('common.custom')).value, value: 'custom' }
]

const isCustomModel = computed(() => batchSettings.value.model === 'custom')
const actualModel = computed(() =>
  isCustomModel.value ? batchSettings.value.customModel : batchSettings.value.model
)

// Category definitions
const categoryLabels: Record<string, string> = {
  'harassment': 'Harassment',
  'harassment/threatening': 'Harassment/Threatening',
  'hate': 'Hate',
  'hate/threatening': 'Hate/Threatening',
  'illicit': 'Illicit',
  'illicit/violent': 'Illicit/Violent',
  'self-harm': 'Self-Harm',
  'self-harm/intent': 'Self-Harm/Intent',
  'self-harm/instructions': 'Self-Harm/Instructions',
  'sexual': 'Sexual',
  'sexual/minors': 'Sexual/Minors',
  'violence': 'Violence',
  'violence/graphic': 'Violence/Graphic'
}

// Moderation processor function
const processModeration: TaskProcessor<ModerationInput, ModerationResult> = async (input, onProgress, signal) => {
  onProgress(10)

  let requestInput: string | Array<{ type: string; text?: string; image_url?: { url: string } }>

  if (input.type === 'text') {
    requestInput = input.content
  } else {
    requestInput = [{
      type: 'image_url',
      image_url: { url: input.content }
    }]
  }

  const body = {
    model: actualModel.value,
    input: requestInput
  }

  const url = configStore.baseUrl.replace(/\/$/, '') + '/v1/moderations'
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${configStore.apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body),
    signal
  })

  onProgress(80)

  const text = await res.text()
  if (!res.ok) throw parseApiError(text, res.status)

  onProgress(90)

  const data = JSON.parse(text)
  const result = data.results[0]

  return {
    flagged: result.flagged,
    categories: result.categories,
    category_scores: result.category_scores
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
} = useBatchQueue<ModerationInput, ModerationResult>(processModeration, {
  concurrency: concurrency.value,
  retryCount: 1,
  continueOnError: true
})

// Watch concurrency changes
watch(concurrency, (val) => {
  updateConfig({ concurrency: val })
})

// Statistics
const flaggedCount = computed(() =>
  tasks.value.filter(t => t.status === 'completed' && t.result?.flagged).length
)

const passedCount = computed(() =>
  tasks.value.filter(t => t.status === 'completed' && !t.result?.flagged).length
)

const categoryStats = computed(() => {
  const stats: Record<string, number> = {}
  tasks.value.forEach(task => {
    if (task.status === 'completed' && task.result?.categories) {
      Object.entries(task.result.categories).forEach(([cat, flagged]) => {
        if (flagged) {
          stats[cat] = (stats[cat] || 0) + 1
        }
      })
    }
  })
  return stats
})

// Add text items to queue
function handleAddTexts(texts: string[]) {
  if (!configStore.apiKey) {
    message.error(t('errors.missingApiKey'))
    return
  }

  const inputs: ModerationInput[] = texts.map(text => ({
    type: 'text',
    content: text,
    preview: text.length > 50 ? text.slice(0, 50) + '...' : text
  }))

  addTasks(inputs)
  message.success(t('batch.addToQueue') + `: ${texts.length}`)
}

// Add image URLs to queue
function handleAddImages(urls: string[]) {
  if (!configStore.apiKey) {
    message.error(t('errors.missingApiKey'))
    return
  }

  const inputs: ModerationInput[] = urls.map(url => ({
    type: 'image',
    content: url,
    preview: url.length > 50 ? url.slice(0, 50) + '...' : url
  }))

  addTasks(inputs)
  message.success(t('batch.addToQueue') + `: ${urls.length}`)
}

// Export handlers
function handleExport(format: 'json' | 'csv' | 'zip') {
  // Moderation doesn't support zip export
  if (format === 'zip') return
  const completedTasks = tasks.value.filter(t => t.status === 'completed' && t.result)

  if (completedTasks.length === 0) {
    message.warning(t('batch.noTasks'))
    return
  }

  const exportData = completedTasks.map((task) => ({
    type: task.input.type,
    content: task.input.content.slice(0, 100),
    flagged: task.result!.flagged,
    ...task.result!.category_scores
  }))

  if (format === 'csv') {
    const headers = ['type', 'content', 'flagged', ...Object.keys(categoryLabels)]
    const rows = exportData.map(d => [
      d.type,
      `"${d.content.replace(/"/g, '""')}"`,
      d.flagged,
      ...Object.keys(categoryLabels).map(cat => (d as any)[cat]?.toFixed(4) ?? '')
    ].join(','))
    const csv = [headers.join(','), ...rows].join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `batch-moderation-${Date.now()}.csv`
    a.click()
    URL.revokeObjectURL(url)
    message.success(t('batch.export') + ' CSV')
  } else {
    const json = JSON.stringify(exportData, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `batch-moderation-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
    message.success(t('batch.export') + ' JSON')
  }
}

// Format input for display
function formatInput(input: ModerationInput): string {
  return `[${input.type}] ${input.preview}`
}

// Cleanup on unmount
onUnmounted(() => {
  stop()
})
</script>

<template>
  <div class="batch-moderation-panel">
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

    <!-- Text Input Area -->
    <NCard class="glass-card" size="small">
      <template #header>
        <span class="card-title">{{ t('moderation.textInput') }}</span>
      </template>

      <BatchInputArea
        :placeholder="t('batch.moderationTextPlaceholder')"
        :disabled="isRunning"
        input-type="text"
        @add-texts="handleAddTexts"
      />
    </NCard>

    <!-- Image URL Input Area -->
    <NCard class="glass-card" size="small">
      <template #header>
        <span class="card-title">{{ t('moderation.imageUrl') }}</span>
      </template>

      <BatchInputArea
        :placeholder="t('batch.moderationImagePlaceholder')"
        :disabled="isRunning"
        input-type="text"
        @add-texts="handleAddImages"
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
            <NTag type="success" size="small">{{ passedCount }} {{ t('moderation.passed') }}</NTag>
            <NTag v-if="flaggedCount > 0" type="error" size="small">{{ flaggedCount }} {{ t('moderation.flagged') }}</NTag>
            <NTag v-if="pendingCount > 0" type="default" size="small">{{ pendingCount }} {{ t('common.pending') }}</NTag>
          </NSpace>
        </NSpace>
      </template>

      <BatchTaskList
        :tasks="tasks"
        :show-input="true"
        :input-formatter="formatInput"
        max-height="300px"
        @retry="retryTask"
        @cancel="cancelTask"
        @remove="removeTask"
      >
        <!-- Custom result display for moderation -->
        <template #result="{ task }">
          <div v-if="task.result" class="moderation-result">
            <NTag :type="task.result.flagged ? 'error' : 'success'" size="small">
              {{ task.result.flagged ? t('moderation.flagged') : t('moderation.passed') }}
            </NTag>
          </div>
        </template>
      </BatchTaskList>
    </NCard>

    <!-- Statistics Card -->
    <NCard v-if="completedCount > 0" class="glass-card stats-card" size="small">
      <template #header>
        <span class="card-title">{{ t('moderation.categories') }}</span>
      </template>

      <NScrollbar style="max-height: 250px">
        <div class="category-stats">
          <div
            v-for="(label, key) in categoryLabels"
            :key="key"
            class="category-stat-item"
          >
            <div class="stat-header">
              <span class="category-name">{{ label }}</span>
              <NTag v-if="categoryStats[key]" type="error" size="tiny">{{ categoryStats[key] }}</NTag>
            </div>
            <div class="stat-bar">
              <NProgress
                type="line"
                :percentage="categoryStats[key] ? (categoryStats[key] / completedCount) * 100 : 0"
                :color="categoryStats[key] ? '#ef4444' : '#10b981'"
                :show-indicator="false"
                :height="4"
              />
            </div>
          </div>
        </div>
      </NScrollbar>
    </NCard>
  </div>
</template>

<style scoped>
.batch-moderation-panel {
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

.moderation-result {
  display: flex;
  align-items: center;
  gap: 8px;
}

.stats-card {
  margin-top: 8px;
}

.category-stats {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.category-stat-item {
  padding: 8px;
  background: rgba(255, 255, 255, 0.02);
  border-radius: 6px;
}

.stat-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.category-name {
  font-size: 12px;
  opacity: 0.8;
}

.stat-bar {
  opacity: 0.8;
}
</style>
