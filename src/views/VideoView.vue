<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  NCard, NForm, NFormItem, NInput, NSelect, NButton, NSpace,
  NUpload, NProgress, NAlert, NSpin, NTag, NTooltip,
  type UploadFileInfo
} from 'naive-ui'
import { useConfigStore } from '@/stores/config'
import { useHistoryStore } from '@/stores/history'
import { message } from '@/composables/useNaiveMessage'

const { t } = useI18n()
const configStore = useConfigStore()
const historyStore = useHistoryStore()

// Form state
const form = ref({
  prompt: '',
  model: 'sora-2',
  customModel: '',
  seconds: '4',
  customSeconds: '',
  size: '1280x720',
  customSize: ''
})

const referenceImage = ref<File | null>(null)
const imageWarning = ref('')

// Task state
const isLoading = ref(false)
const abortController = ref<AbortController | null>(null)
const taskId = ref('')
const taskStatus = ref('')
const taskProgress = ref(0)
const videoUrl = ref('')
const errorMessage = ref('')

// Query state
const queryTaskId = ref('')
const queryResult = ref('')

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
  ...configStore.videoTemplates.map(t => ({
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

// Model options
const modelOptions = [
  { label: 'sora-2', value: 'sora-2' },
  { label: 'sora-2-pro', value: 'sora-2-pro' },
  { label: t('common.custom'), value: 'custom' }
]

const secondsOptions = [
  { label: '4s', value: '4' },
  { label: '8s', value: '8' },
  { label: '12s', value: '12' },
  { label: t('common.custom'), value: 'custom' }
]

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
  if (form.value.model === 'custom') return []
  return sizeOptionsMap[form.value.model] || sizeOptionsMap['sora-2']
})

const isCustomModel = computed(() => form.value.model === 'custom')
const isCustomSeconds = computed(() => form.value.seconds === 'custom')

// Watch model changes to update size options
watch(() => form.value.model, (newModel) => {
  if (newModel !== 'custom') {
    const options = sizeOptionsMap[newModel] || sizeOptionsMap['sora-2']
    if (!options.find(o => o.value === form.value.size)) {
      form.value.size = options[0]?.value || ''
    }
  }
})

// Get actual values
const actualModel = computed(() =>
  isCustomModel.value ? form.value.customModel : form.value.model
)

const actualSeconds = computed(() =>
  isCustomSeconds.value ? form.value.customSeconds : form.value.seconds
)

const actualSize = computed(() =>
  isCustomModel.value ? form.value.customSize : form.value.size
)

// Image resolution check
async function checkImageResolution(file: File, expectedSize: string): Promise<{ match: boolean; actual?: string }> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(img.src)
      const [expectedW, expectedH] = expectedSize.split('x').map(Number)
      const match = img.width === expectedW && img.height === expectedH
      resolve({ match, actual: `${img.width}x${img.height}` })
    }
    img.onerror = () => {
      URL.revokeObjectURL(img.src)
      resolve({ match: false })
    }
    img.src = URL.createObjectURL(file)
  })
}

// Handle image upload
async function handleImageChange(options: { file: UploadFileInfo }) {
  const file = options.file.file
  if (!file) {
    referenceImage.value = null
    imageWarning.value = ''
    return
  }

  referenceImage.value = file
  const size = actualSize.value
  if (size) {
    const result = await checkImageResolution(file, size)
    if (!result.match && result.actual) {
      imageWarning.value = t('video.imageSizeMismatch', { actual: result.actual, expected: size })
    } else {
      imageWarning.value = ''
    }
  }
}

// API functions
async function createVideo(fd: FormData, signal: AbortSignal) {
  const url = configStore.baseUrl.replace(/\/$/, '') + '/v1/videos'
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${configStore.apiKey}` },
    body: fd,
    signal
  })
  const text = await res.text()
  if (!res.ok) throw parseApiError(text, res.status)
  return JSON.parse(text)
}

async function getTaskStatus(id: string, signal?: AbortSignal) {
  const url = configStore.baseUrl.replace(/\/$/, '') + '/v1/videos/' + encodeURIComponent(id)
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${configStore.apiKey}` },
    signal
  })
  const text = await res.text()
  if (!res.ok) throw parseApiError(text, res.status)
  return JSON.parse(text)
}

async function getVideoContent(id: string, signal?: AbortSignal) {
  const url = configStore.baseUrl.replace(/\/$/, '') + '/v1/videos/' + encodeURIComponent(id) + '/content'
  let res = await fetch(url, { signal })
  if (!res.ok && res.status === 401) {
    res = await fetch(url, {
      headers: { Authorization: `Bearer ${configStore.apiKey}` },
      signal
    })
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw parseApiError(text, res.status)
  }
  return await res.blob()
}

function parseApiError(text: string, status: number): Error {
  try {
    const j = JSON.parse(text)
    if (j?.error?.message) {
      return new Error(`API ${status}: ${j.error.message} (${j.error.code || ''})`)
    }
  } catch {}
  return new Error(`API ${status}: ${text || 'unknown error'}`)
}

// Submit video generation
async function handleSubmit() {
  if (!configStore.apiKey) {
    message.error(t('errors.missingApiKey'))
    return
  }
  if (!form.value.prompt) {
    message.error(t('errors.missingPrompt'))
    return
  }
  if (isCustomModel.value && !form.value.customModel) {
    message.error(t('errors.missingModel'))
    return
  }

  if (referenceImage.value && imageWarning.value) {
    message.error(imageWarning.value)
    return
  }

  errorMessage.value = ''
  taskStatus.value = ''
  taskProgress.value = 0
  videoUrl.value = ''
  isLoading.value = true

  const ctrl = new AbortController()
  abortController.value = ctrl

  try {
    const fd = new FormData()
    fd.set('prompt', form.value.prompt)
    fd.set('model', actualModel.value)
    fd.set('seconds', actualSeconds.value)
    fd.set('size', actualSize.value)
    if (referenceImage.value) {
      fd.set('input_reference', referenceImage.value, referenceImage.value.name)
    }

    const created = await createVideo(fd, ctrl.signal)
    const id = created.id || created.task_id
    if (!id) throw new Error('No task ID returned')

    taskId.value = id
    queryTaskId.value = id
    taskStatus.value = 'processing'

    while (true) {
      const st = await getTaskStatus(id, ctrl.signal)
      const status = (st.status || '').toLowerCase()
      const pct = typeof st.progress === 'number' ? st.progress : 0

      taskStatus.value = status
      taskProgress.value = pct

      if (status === 'completed') {
        const blob = await getVideoContent(id, ctrl.signal)
        videoUrl.value = URL.createObjectURL(blob)
        historyStore.addItem({
          type: 'video',
          status: 'completed',
          params: { ...form.value, referenceImage: null },
          result: { taskId: id }
        })
        message.success(t('video.videoReady'))
        break
      }

      if (status === 'failed' || status === 'cancelled') {
        throw new Error(st?.error?.message || `Task ${status}`)
      }

      await new Promise(r => setTimeout(r, 3000))
    }
  } catch (e: any) {
    if (e.name === 'AbortError') {
      taskStatus.value = 'cancelled'
    } else {
      errorMessage.value = e.message
      taskStatus.value = 'failed'
    }
  } finally {
    isLoading.value = false
    abortController.value = null
  }
}

function handleCancel() {
  abortController.value?.abort()
}

async function handleQueryStatus() {
  if (!configStore.apiKey) {
    message.error(t('errors.missingApiKey'))
    return
  }
  if (!queryTaskId.value) {
    message.error(t('errors.missingTaskId'))
    return
  }

  isLoading.value = true
  queryResult.value = ''

  try {
    const st = await getTaskStatus(queryTaskId.value)
    const status = (st.status || '').toLowerCase()
    const pct = typeof st.progress === 'number' ? st.progress : undefined

    let result = `${t('common.status')}: ${status}`
    if (typeof pct === 'number') result += ` | ${t('common.progress')}: ${pct}%`
    if (st.error?.message) result += `\n${t('common.error')}: ${st.error.message}`

    queryResult.value = result
    taskStatus.value = status
    if (typeof pct === 'number') taskProgress.value = pct
  } catch (e: any) {
    queryResult.value = `${t('common.error')}: ${e.message}`
  } finally {
    isLoading.value = false
  }
}

async function handleFetchVideo() {
  if (!configStore.apiKey) {
    message.error(t('errors.missingApiKey'))
    return
  }
  if (!queryTaskId.value) {
    message.error(t('errors.missingTaskId'))
    return
  }

  isLoading.value = true
  videoUrl.value = ''

  try {
    const blob = await getVideoContent(queryTaskId.value)
    videoUrl.value = URL.createObjectURL(blob)
    taskId.value = queryTaskId.value
    message.success(t('video.videoReady'))
  } catch (e: any) {
    errorMessage.value = e.message
  } finally {
    isLoading.value = false
  }
}

function handleDownload() {
  if (!videoUrl.value) return
  const a = document.createElement('a')
  a.href = videoUrl.value
  a.download = `video-${taskId.value || Date.now()}.mp4`
  a.click()
}

onUnmounted(() => {
  abortController.value?.abort()
  if (videoUrl.value) URL.revokeObjectURL(videoUrl.value)
})
</script>

<template>
  <div class="page-container">
    <div class="page-header">
      <h1 class="page-title gradient-text">{{ t('video.title') }}</h1>
      <p class="page-subtitle">{{ t('video.subtitle') }}</p>
    </div>

    <div class="video-layout">
      <!-- Form Section -->
      <NCard class="glass-card form-card">
        <NForm label-placement="left" label-width="100">
          <!-- Provider Preset -->
          <NFormItem :label="t('settings.providerPresets')">
            <NSpace align="center" style="width: 100%">
              <NSelect
                :value="configStore.activePresetId"
                :options="presetOptions"
                @update:value="configStore.setActivePreset"
                style="flex: 1"
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
          <NFormItem v-if="configStore.videoTemplates.length > 0" :label="t('settings.promptTemplates')">
            <NSelect
              v-model:value="selectedTemplate"
              :options="templateOptions"
              clearable
              :placeholder="t('settings.noTemplates')"
            />
          </NFormItem>

          <!-- Prompt -->
          <NFormItem :label="t('video.prompt')">
            <NInput
              v-model:value="form.prompt"
              type="textarea"
              :rows="3"
              :placeholder="t('video.promptPlaceholder')"
            />
          </NFormItem>

          <!-- Model -->
          <NFormItem :label="t('common.model')">
            <NSpace vertical style="width: 100%">
              <NSelect v-model:value="form.model" :options="modelOptions" />
              <NInput v-if="isCustomModel" v-model:value="form.customModel" :placeholder="t('common.custom')" />
            </NSpace>
          </NFormItem>

          <!-- Seconds -->
          <NFormItem :label="t('video.seconds')">
            <NSpace>
              <NSelect v-model:value="form.seconds" :options="secondsOptions" style="width: 120px" />
              <NInput v-if="isCustomSeconds" v-model:value="form.customSeconds" placeholder="s" style="width: 100px" />
            </NSpace>
          </NFormItem>

          <!-- Size -->
          <NFormItem :label="t('video.size')">
            <NSpace vertical style="width: 100%">
              <NSelect v-if="!isCustomModel" v-model:value="form.size" :options="sizeOptions" />
              <NInput v-else v-model:value="form.customSize" placeholder="1920x1080" />
            </NSpace>
          </NFormItem>

          <!-- Reference Image -->
          <NFormItem :label="t('video.referenceImage')">
            <NUpload accept="image/*" :max="1" :default-upload="false" @change="handleImageChange">
              <NButton>{{ t('common.custom') }}</NButton>
            </NUpload>
          </NFormItem>

          <NAlert v-if="imageWarning" type="warning" style="margin-bottom: 16px">
            {{ imageWarning }}
          </NAlert>

          <!-- Submit -->
          <NFormItem label=" ">
            <NSpace>
              <NButton type="primary" :loading="isLoading" @click="handleSubmit">
                {{ t('video.generate') }}
              </NButton>
              <NButton :disabled="!isLoading" @click="handleCancel">
                {{ t('common.cancel') }}
              </NButton>
            </NSpace>
          </NFormItem>
        </NForm>
      </NCard>

      <!-- Status & Preview Section -->
      <div class="preview-section">
        <!-- Query Card -->
        <NCard class="glass-card">
          <template #header>{{ t('video.queryStatus') }}</template>
          <NSpace vertical>
            <NInput v-model:value="queryTaskId" :placeholder="t('common.placeholder.taskId')" />
            <NSpace>
              <NButton @click="handleQueryStatus" :loading="isLoading">{{ t('common.query') }}</NButton>
              <NButton @click="handleFetchVideo" :loading="isLoading">{{ t('video.fetchVideo') }}</NButton>
            </NSpace>
            <div v-if="queryResult" class="query-result">{{ queryResult }}</div>
          </NSpace>
        </NCard>

        <!-- Status Card -->
        <NCard class="glass-card">
          <div class="status-header">
            <span>{{ t('common.status') }}:</span>
            <span :class="['status-badge', `status-${taskStatus}`]">
              {{ taskStatus || t('common.pending') }}
            </span>
          </div>
          <div v-if="taskId" class="task-id">Task ID: <code>{{ taskId }}</code></div>
          <NProgress v-if="taskStatus === 'processing'" type="line" :percentage="taskProgress" style="margin: 16px 0" />
          <NAlert v-if="errorMessage" type="error" style="margin-top: 16px">{{ errorMessage }}</NAlert>
        </NCard>

        <!-- Video Preview -->
        <NCard class="glass-card">
          <NSpin :show="isLoading && !videoUrl">
            <div class="video-container">
              <video v-if="videoUrl" :src="videoUrl" controls autoplay class="video-player" />
              <div v-else class="video-placeholder">
                <div class="placeholder-icon">▶</div>
                <div>{{ t('video.generating') }}</div>
              </div>
            </div>
          </NSpin>
          <NButton v-if="videoUrl" type="primary" block style="margin-top: 16px" @click="handleDownload">
            {{ t('common.download') }}
          </NButton>
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

.video-layout {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
  align-items: stretch;
}

@media (max-width: 1024px) {
  .video-layout {
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

.query-result {
  font-family: ui-monospace, monospace;
  font-size: 13px;
  padding: 12px;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.2);
  white-space: pre-wrap;
}

.status-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-badge {
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 13px;
}

.status-pending { background: rgba(245, 158, 11, 0.2); color: #f59e0b; }
.status-processing { background: rgba(59, 130, 246, 0.2); color: #3b82f6; }
.status-completed { background: rgba(16, 185, 129, 0.2); color: #10b981; }
.status-failed { background: rgba(239, 68, 68, 0.2); color: #ef4444; }

.task-id {
  margin-top: 12px;
  font-size: 13px;
  opacity: 0.8;
}

.task-id code {
  font-family: ui-monospace, monospace;
  padding: 2px 6px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.1);
}

.video-container {
  aspect-ratio: 16/9;
  border-radius: 12px;
  overflow: hidden;
  background: rgba(0, 0, 0, 0.3);
}

.video-player {
  width: 100%;
  height: 100%;
}

.video-placeholder {
  width: 100%;
  height: 100%;
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
</style>
