<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  NCard, NForm, NFormItem, NInput, NSelect, NButton, NSpace,
  NUpload, NAlert, NSpin, NTag, NTooltip, NTabs, NTabPane,
  NProgress, NScrollbar,
  type UploadFileInfo
} from 'naive-ui'
import { useConfigStore } from '@/stores/config'
import { message } from '@/composables/useNaiveMessage'

const { t } = useI18n()
const configStore = useConfigStore()

// Local storage key
const MODERATION_SETTINGS_KEY = 'moderation-form-settings'

// Form state
const form = ref({
  model: 'omni-moderation-latest',
  customModel: '',
  textInput: '',
  imageUrl: ''
})

// Mode: text only or multimodal
const mode = ref<'text' | 'multimodal'>('text')

// Image file
const imageFile = ref<File | null>(null)

// Task state
const isLoading = ref(false)
const abortController = ref<AbortController | null>(null)
const result = ref<ModerationResult | null>(null)
const errorMessage = ref('')

// Types
interface ModerationResult {
  id: string
  model: string
  results: Array<{
    flagged: boolean
    categories: Record<string, boolean>
    category_scores: Record<string, number>
    category_applied_input_types?: Record<string, string[]>
  }>
}

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
    label: 'omni-moderation-latest',
    value: 'omni-moderation-latest',
    description: 'moderation.models.omniDesc'
  },
  {
    label: 'text-moderation-latest (Legacy)',
    value: 'text-moderation-latest',
    description: 'moderation.models.textDesc'
  },
  { label: t('common.custom'), value: 'custom' }
]

const isCustomModel = computed(() => form.value.model === 'custom')
const actualModel = computed(() =>
  isCustomModel.value ? form.value.customModel : form.value.model
)

// Check if model supports images
const supportsImages = computed(() =>
  form.value.model === 'omni-moderation-latest' || form.value.model === 'custom'
)

// Category definitions
const categoryInfo: Record<string, { label: string; textOnly: boolean }> = {
  'harassment': { label: 'Harassment', textOnly: true },
  'harassment/threatening': { label: 'Harassment/Threatening', textOnly: true },
  'hate': { label: 'Hate', textOnly: true },
  'hate/threatening': { label: 'Hate/Threatening', textOnly: true },
  'illicit': { label: 'Illicit', textOnly: true },
  'illicit/violent': { label: 'Illicit/Violent', textOnly: true },
  'self-harm': { label: 'Self-Harm', textOnly: false },
  'self-harm/intent': { label: 'Self-Harm/Intent', textOnly: false },
  'self-harm/instructions': { label: 'Self-Harm/Instructions', textOnly: false },
  'sexual': { label: 'Sexual', textOnly: false },
  'sexual/minors': { label: 'Sexual/Minors', textOnly: true },
  'violence': { label: 'Violence', textOnly: false },
  'violence/graphic': { label: 'Violence/Graphic', textOnly: false }
}

// Load settings
function loadFormSettings() {
  const saved = localStorage.getItem(MODERATION_SETTINGS_KEY)
  if (saved) {
    try {
      const settings = JSON.parse(saved)
      form.value.model = settings.model || 'omni-moderation-latest'
      form.value.customModel = settings.customModel || ''
    } catch {
      // Ignore
    }
  }
}

function saveFormSettings() {
  const settings = {
    model: form.value.model,
    customModel: form.value.customModel
  }
  localStorage.setItem(MODERATION_SETTINGS_KEY, JSON.stringify(settings))
}

onMounted(() => {
  loadFormSettings()
})

// Handle image upload
function handleImageChange(options: { file: UploadFileInfo }) {
  const file = options.file.file
  imageFile.value = file || null
}

// Convert file to base64
async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      resolve(reader.result as string)
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// Parse API error
function parseApiError(text: string, status: number): Error {
  try {
    const j = JSON.parse(text)
    if (j?.error?.message) {
      return new Error(`API ${status}: ${j.error.message}`)
    }
  } catch {/* empty */}
  return new Error(`API ${status}: ${text || 'unknown error'}`)
}

// Get score color
function getScoreColor(score: number): string {
  if (score >= 0.8) return '#ef4444'
  if (score >= 0.5) return '#f59e0b'
  if (score >= 0.2) return '#eab308'
  return '#10b981'
}

// Get score percentage
function getScorePercentage(score: number): number {
  return Math.min(score * 100, 100)
}

// Submit moderation
async function handleSubmit() {
  if (!configStore.apiKey) {
    message.error(t('errors.missingApiKey'))
    return
  }

  const hasText = form.value.textInput.trim()
  const hasImage = imageFile.value || form.value.imageUrl.trim()

  if (!hasText && !hasImage) {
    message.error(t('moderation.errors.missingInput'))
    return
  }

  if (isCustomModel.value && !form.value.customModel) {
    message.error(t('errors.missingModel'))
    return
  }

  errorMessage.value = ''
  result.value = null
  isLoading.value = true

  const ctrl = new AbortController()
  abortController.value = ctrl

  try {
    let input: any

    if (mode.value === 'text' || !supportsImages.value) {
      // Text only
      input = form.value.textInput
    } else {
      // Multimodal
      const parts: any[] = []

      if (form.value.textInput.trim()) {
        parts.push({
          type: 'text',
          text: form.value.textInput
        })
      }

      if (imageFile.value) {
        const base64 = await fileToBase64(imageFile.value)
        parts.push({
          type: 'image_url',
          image_url: { url: base64 }
        })
      } else if (form.value.imageUrl.trim()) {
        parts.push({
          type: 'image_url',
          image_url: { url: form.value.imageUrl }
        })
      }

      input = parts
    }

    const body = {
      model: actualModel.value,
      input
    }

    const url = configStore.baseUrl.replace(/\/$/, '') + '/v1/moderations'
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

    result.value = JSON.parse(text)
    saveFormSettings()

    if (result.value?.results[0]?.flagged) {
      message.warning(t('moderation.flagged'))
    } else {
      message.success(t('moderation.passed'))
    }
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

function clearResult() {
  result.value = null
  form.value.textInput = ''
  form.value.imageUrl = ''
  imageFile.value = null
}
</script>

<template>
  <div class="page-container">
    <div class="page-header">
      <h1 class="page-title gradient-text">{{ t('moderation.title') }}</h1>
      <p class="page-subtitle">{{ t('moderation.subtitle') }}</p>
    </div>

    <div class="moderation-layout">
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

            <!-- Model -->
            <NFormItem :label="t('common.model')">
              <NSpace vertical style="width: 100%">
                <NSelect v-model:value="form.model" :options="modelOptions" />
                <NInput v-if="isCustomModel" v-model:value="form.customModel" :placeholder="t('common.custom')" />
              </NSpace>
            </NFormItem>

            <!-- Input Mode -->
            <NFormItem v-if="supportsImages" :label="t('moderation.inputMode')">
              <NTabs v-model:value="mode" type="segment" size="small">
                <NTabPane name="text" :tab="t('moderation.textOnly')" />
                <NTabPane name="multimodal" :tab="t('moderation.multimodal')" />
              </NTabs>
            </NFormItem>

            <!-- Text Input -->
            <NFormItem :label="t('moderation.textInput')">
              <NInput
                v-model:value="form.textInput"
                type="textarea"
                :rows="6"
                :placeholder="t('moderation.textPlaceholder')"
              />
            </NFormItem>

            <!-- Image Input (Multimodal) -->
            <template v-if="mode === 'multimodal' && supportsImages">
              <NFormItem :label="t('moderation.imageUrl')">
                <NInput
                  v-model:value="form.imageUrl"
                  :placeholder="t('moderation.imageUrlPlaceholder')"
                  :disabled="!!imageFile"
                />
              </NFormItem>

              <NFormItem :label="t('moderation.uploadImage')">
                <NUpload
                  accept="image/*"
                  :max="1"
                  :default-upload="false"
                  @change="handleImageChange"
                  :disabled="!!form.imageUrl.trim()"
                >
                  <NButton :disabled="!!form.imageUrl.trim()">{{ t('moderation.selectImage') }}</NButton>
                </NUpload>
              </NFormItem>
            </template>

            <!-- Submit -->
            <NFormItem label=" ">
              <NSpace>
                <NButton type="primary" :loading="isLoading" @click="handleSubmit">
                  {{ t('moderation.analyze') }}
                </NButton>
                <NButton :disabled="!isLoading" @click="handleCancel">
                  {{ t('common.cancel') }}
                </NButton>
                <NButton v-if="result" @click="clearResult">
                  {{ t('moderation.clear') }}
                </NButton>
              </NSpace>
            </NFormItem>
          </NForm>
        </NCard>

        <!-- Info Card -->
        <NCard class="glass-card info-card">
          <template #header>{{ t('moderation.categories') }}</template>
          <NScrollbar style="max-height: 200px">
            <div class="categories-info">
              <div v-for="(info, key) in categoryInfo" :key="key" class="category-info-item">
                <span class="category-name">{{ info.label }}</span>
                <NTag v-if="info.textOnly" size="tiny" type="info">Text only</NTag>
              </div>
            </div>
          </NScrollbar>
        </NCard>
      </div>

      <!-- Right: Result Section -->
      <div class="result-section">
        <!-- Error Alert -->
        <NAlert v-if="errorMessage" type="error" class="error-alert" closable @close="errorMessage = ''">
          {{ errorMessage }}
        </NAlert>

        <!-- Results Card -->
        <NCard class="glass-card result-card">
          <template #header>
            <div class="result-header">
              <span>{{ t('moderation.result') }}</span>
              <NTag v-if="result" :type="result.results[0]?.flagged ? 'error' : 'success'" size="small">
                {{ result.results[0]?.flagged ? t('moderation.flagged') : t('moderation.passed') }}
              </NTag>
            </div>
          </template>

          <NSpin :show="isLoading">
            <div v-if="result" class="result-content">
              <!-- Summary -->
              <div class="result-summary">
                <NTag type="info" size="small">Model: {{ result.model }}</NTag>
                <NTag type="info" size="small">ID: {{ result.id }}</NTag>
              </div>

              <!-- Categories -->
              <NScrollbar style="max-height: 400px">
                <div class="categories-result">
                  <div
                    v-for="(flagged, category) in result.results[0]?.categories"
                    :key="category"
                    class="category-item"
                    :class="{ flagged }"
                  >
                    <div class="category-header">
                      <span class="category-label">{{ categoryInfo[category]?.label || category }}</span>
                      <NTag :type="flagged ? 'error' : 'success'" size="tiny">
                        {{ flagged ? 'Flagged' : 'OK' }}
                      </NTag>
                    </div>
                    <div class="category-score">
                      <NProgress
                        type="line"
                        :percentage="getScorePercentage(result.results[0]?.category_scores[category] || 0)"
                        :color="getScoreColor(result.results[0]?.category_scores[category] || 0)"
                        :show-indicator="false"
                        :height="6"
                      />
                      <span class="score-value">
                        {{ (result.results[0]?.category_scores[category] || 0).toFixed(4) }}
                      </span>
                    </div>
                    <div
                      v-if="result.results[0]?.category_applied_input_types?.[category]?.length"
                      class="input-types"
                    >
                      <NTag
                        v-for="type in result.results[0].category_applied_input_types[category]"
                        :key="type"
                        size="tiny"
                      >
                        {{ type }}
                      </NTag>
                    </div>
                  </div>
                </div>
              </NScrollbar>
            </div>

            <div v-else class="result-placeholder">
              <div class="placeholder-icon">🛡️</div>
              <div>{{ t('moderation.waitingForInput') }}</div>
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

.moderation-layout {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
  align-items: stretch;
}

@media (max-width: 1200px) {
  .moderation-layout {
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

/* Info card */
.info-card {
  font-size: 14px;
}

.categories-info {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.category-info-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 0;
}

.category-name {
  font-size: 13px;
}

/* Result card */
.result-card {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.result-card :deep(.n-card__content) {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.result-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.result-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.result-summary {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.categories-result {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.category-item {
  padding: 12px;
  border-radius: 8px;
  background: rgba(124, 58, 237, 0.05);
  transition: background 0.2s ease;
}

.category-item.flagged {
  background: rgba(239, 68, 68, 0.1);
  border-left: 3px solid #ef4444;
}

.category-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.category-label {
  font-weight: 500;
  font-size: 13px;
}

.category-score {
  display: flex;
  align-items: center;
  gap: 12px;
}

.category-score :deep(.n-progress) {
  flex: 1;
}

.score-value {
  font-family: ui-monospace, monospace;
  font-size: 12px;
  min-width: 60px;
  text-align: right;
  opacity: 0.8;
}

.input-types {
  display: flex;
  gap: 4px;
  margin-top: 8px;
}

.result-placeholder {
  min-height: 300px;
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
