<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { NButton, NTooltip, NProgress, NSpace, NPopover, NTag } from 'naive-ui'
import { CloudUploadOutline, CheckmarkCircleOutline, CloseCircleOutline } from '@vicons/ionicons5'
import { useCloudStorage } from '@/composables/useCloudStorage'
import { message } from '@/composables/useNaiveMessage'

interface Props {
  /** Blob data to upload */
  blob: Blob | null
  /** Original filename */
  filename: string
  /** Content type: image, video, audio, tts */
  type: 'image' | 'video' | 'audio' | 'tts'
  /** Button size */
  size?: 'tiny' | 'small' | 'medium' | 'large'
  /** Disabled state */
  disabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  size: 'small',
  disabled: false
})

const emit = defineEmits<{
  (e: 'success', url: string): void
  (e: 'error', error: string): void
}>()

const { t } = useI18n()
const { hasStorage, activeProvider, uploadFile } = useCloudStorage()

// Upload state
const uploadProgress = ref(0)
const uploadStatus = ref<'idle' | 'uploading' | 'success' | 'error'>('idle')
const uploadedUrl = ref('')
const uploadError = ref('')

// Computed states
const canUpload = computed(() =>
  hasStorage.value && props.blob && !props.disabled && uploadStatus.value !== 'uploading'
)

const buttonType = computed(() => {
  switch (uploadStatus.value) {
    case 'success': return 'success'
    case 'error': return 'error'
    default: return 'default'
  }
})

const statusIcon = computed(() => {
  switch (uploadStatus.value) {
    case 'success': return CheckmarkCircleOutline
    case 'error': return CloseCircleOutline
    default: return CloudUploadOutline
  }
})

// Upload handler
async function handleUpload() {
  if (!props.blob || !canUpload.value) return

  uploadStatus.value = 'uploading'
  uploadProgress.value = 0
  uploadError.value = ''

  const result = await uploadFile(props.blob, props.filename, props.type, {
    onProgress: (progress) => {
      uploadProgress.value = progress
    }
  })

  if (result.success && result.url) {
    uploadStatus.value = 'success'
    uploadedUrl.value = result.url
    message.success(t('storage.uploadSuccess'))
    emit('success', result.url)
  } else {
    uploadStatus.value = 'error'
    uploadError.value = result.error || 'Upload failed'
    message.error(result.error || t('storage.uploadFailed'))
    emit('error', result.error || 'Upload failed')
  }
}

// Reset state
function resetStatus() {
  uploadStatus.value = 'idle'
  uploadProgress.value = 0
  uploadedUrl.value = ''
  uploadError.value = ''
}

// Copy URL to clipboard
async function copyUrl() {
  if (uploadedUrl.value) {
    try {
      await navigator.clipboard.writeText(uploadedUrl.value)
      message.success(t('audio.copied'))
    } catch {
      message.error(t('audio.copyFailed'))
    }
  }
}
</script>

<template>
  <div class="cloud-upload-button">
    <NPopover v-if="uploadStatus === 'success'" placement="top" trigger="hover">
      <template #trigger>
        <NSpace :size="4">
          <NButton
            :size="size"
            :type="buttonType"
            :disabled="!canUpload && uploadStatus !== 'success'"
            @click="copyUrl"
          >
            <template #icon>
              <component :is="statusIcon" />
            </template>
          </NButton>
          <NButton
            :size="size"
            quaternary
            @click="resetStatus"
          >
            <template #icon>
              <CloseCircleOutline />
            </template>
          </NButton>
        </NSpace>
      </template>
      <div class="upload-success-info">
        <div class="success-label">{{ t('storage.uploadSuccess') }}</div>
        <NTag size="small" type="info">{{ uploadedUrl }}</NTag>
      </div>
    </NPopover>

    <NTooltip v-else-if="uploadStatus === 'uploading'" placement="top">
      <template #trigger>
        <NButton :size="size" :loading="true" disabled>
          <template #icon>
            <CloudUploadOutline />
          </template>
        </NButton>
      </template>
      <div class="upload-progress">
        <div>{{ t('storage.uploading') }}</div>
        <NProgress
          type="line"
          :percentage="uploadProgress"
          :height="4"
          :show-indicator="false"
        />
        <div class="progress-text">{{ uploadProgress }}%</div>
      </div>
    </NTooltip>

    <NTooltip v-else-if="uploadStatus === 'error'" placement="top">
      <template #trigger>
        <NButton
          :size="size"
          type="error"
          @click="handleUpload"
        >
          <template #icon>
            <CloseCircleOutline />
          </template>
        </NButton>
      </template>
      <div class="upload-error">
        <div>{{ uploadError }}</div>
        <div class="retry-hint">{{ t('batch.retry') }}</div>
      </div>
    </NTooltip>

    <NTooltip v-else placement="top">
      <template #trigger>
        <NButton
          :size="size"
          :type="buttonType"
          :disabled="!canUpload"
          @click="handleUpload"
        >
          <template #icon>
            <component :is="statusIcon" />
          </template>
        </NButton>
      </template>
      <div v-if="hasStorage">
        {{ t('storage.uploadTo') }} {{ activeProvider?.name || 'Cloud' }}
      </div>
      <div v-else>
        {{ t('storage.noProviderConfigured') }}
      </div>
    </NTooltip>
  </div>
</template>

<style scoped>
.cloud-upload-button {
  display: inline-flex;
  align-items: center;
}

.upload-progress {
  min-width: 120px;
}

.progress-text {
  font-size: 12px;
  text-align: center;
  margin-top: 4px;
}

.upload-success-info {
  max-width: 300px;
}

.success-label {
  font-size: 12px;
  margin-bottom: 4px;
  color: #10b981;
}

.upload-error {
  max-width: 200px;
}

.retry-hint {
  font-size: 11px;
  opacity: 0.7;
  margin-top: 4px;
}
</style>
