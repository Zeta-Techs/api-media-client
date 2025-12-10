<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  NInput, NButton, NSpace, NUpload, NPopover, NInputNumber,
  type UploadFileInfo
} from 'naive-ui'
import { CloudUploadOutline, AddOutline } from '@vicons/ionicons5'
import { useBatchImport } from '@/composables/useBatchImport'

const props = withDefaults(defineProps<{
  placeholder?: string
  disabled?: boolean
  maxItems?: number
  acceptFiles?: string
  inputType?: 'text' | 'file' | 'both'
}>(), {
  placeholder: '',
  disabled: false,
  maxItems: 100,
  acceptFiles: '.txt,.csv',
  inputType: 'both'
})

const emit = defineEmits<{
  (e: 'add', items: string[]): void
  (e: 'addFiles', files: File[]): void
}>()

const { t } = useI18n()
const { importFromList, config: importConfig, updateConfig } = useBatchImport()

const textInput = ref('')

const inputLines = computed(() => {
  if (!textInput.value.trim()) return 0
  return textInput.value.split('\n').filter(line => line.trim()).length
})

function handleAddFromText() {
  if (!textInput.value.trim()) return

  const items = importFromList(textInput.value)
  if (items.length > props.maxItems) {
    items.splice(props.maxItems)
  }

  emit('add', items)
  textInput.value = ''
}

function handleFileChange(options: { fileList: UploadFileInfo[] }) {
  const files = options.fileList
    .map(f => f.file)
    .filter((f): f is File => !!f)

  if (files.length === 0) return

  // 对于文本文件，解析内容
  const textFiles = files.filter(f => f.name.endsWith('.txt') || f.name.endsWith('.csv'))
  const otherFiles = files.filter(f => !f.name.endsWith('.txt') && !f.name.endsWith('.csv'))

  // 处理文本文件
  if (textFiles.length > 0) {
    Promise.all(textFiles.map(f => f.text())).then(contents => {
      const allItems: string[] = []
      for (const content of contents) {
        const items = importFromList(content)
        allItems.push(...items)
      }
      if (allItems.length > 0) {
        emit('add', allItems.slice(0, props.maxItems))
      }
    })
  }

  // 处理其他文件（如音频文件）
  if (otherFiles.length > 0) {
    emit('addFiles', otherFiles.slice(0, props.maxItems))
  }
}

function clearInput() {
  textInput.value = ''
}
</script>

<template>
  <div class="batch-input-area">
    <!-- 文本输入区域 -->
    <div v-if="inputType !== 'file'" class="text-input-section">
      <NInput
        v-model:value="textInput"
        type="textarea"
        :rows="4"
        :placeholder="placeholder || t('batch.inputPlaceholder')"
        :disabled="disabled"
      />
      <div class="input-footer">
        <NSpace align="center" :size="8">
          <span class="line-count">
            {{ t('batch.lineCount', { count: inputLines }) }}
          </span>

          <NPopover trigger="click" placement="bottom">
            <template #trigger>
              <NButton quaternary size="tiny" :disabled="disabled">
                {{ t('batch.importSettings') }}
              </NButton>
            </template>
            <div class="import-settings">
              <div class="setting-row">
                <span>{{ t('batch.skipEmpty') }}</span>
                <NButton
                  size="tiny"
                  :type="importConfig.skipEmpty ? 'primary' : 'default'"
                  @click="updateConfig({ skipEmpty: !importConfig.skipEmpty })"
                >
                  {{ importConfig.skipEmpty ? t('common.yes') : t('common.no') }}
                </NButton>
              </div>
              <div class="setting-row">
                <span>{{ t('batch.maxRows') }}</span>
                <NInputNumber
                  :value="importConfig.maxRows"
                  :min="1"
                  :max="1000"
                  size="tiny"
                  style="width: 80px"
                  @update:value="updateConfig({ maxRows: $event || 100 })"
                />
              </div>
            </div>
          </NPopover>
        </NSpace>

        <NSpace :size="8">
          <NButton
            size="small"
            :disabled="disabled || !textInput.trim()"
            @click="clearInput"
          >
            {{ t('batch.clear') }}
          </NButton>
          <NButton
            type="primary"
            size="small"
            :disabled="disabled || !textInput.trim()"
            @click="handleAddFromText"
          >
            <template #icon>
              <AddOutline />
            </template>
            {{ t('batch.addToQueue') }}
          </NButton>
        </NSpace>
      </div>
    </div>

    <!-- 文件上传区域 -->
    <div v-if="inputType !== 'text'" class="file-input-section">
      <NUpload
        multiple
        directory-dnd
        :accept="acceptFiles"
        :disabled="disabled"
        :show-file-list="false"
        @change="handleFileChange"
      >
        <div class="upload-area">
          <CloudUploadOutline class="upload-icon" />
          <div class="upload-text">
            {{ t('batch.dropFiles') }}
          </div>
          <div class="upload-hint">
            {{ t('batch.supportedFormats') }}: {{ acceptFiles }}
          </div>
        </div>
      </NUpload>
    </div>

    <!-- 分隔符 -->
    <div v-if="inputType === 'both'" class="divider">
      <span>{{ t('batch.or') }}</span>
    </div>
  </div>
</template>

<style scoped>
.batch-input-area {
  width: 100%;
}

.text-input-section {
  margin-bottom: 12px;
}

.input-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 8px;
}

.line-count {
  font-size: 12px;
  opacity: 0.6;
}

.import-settings {
  padding: 8px;
  min-width: 200px;
}

.setting-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  font-size: 13px;
}

.setting-row:last-child {
  margin-bottom: 0;
}

.file-input-section {
  margin-top: 12px;
}

.upload-area {
  padding: 24px;
  border: 2px dashed rgba(124, 58, 237, 0.3);
  border-radius: 12px;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s;
}

.upload-area:hover {
  border-color: rgba(124, 58, 237, 0.6);
  background: rgba(124, 58, 237, 0.05);
}

.upload-icon {
  font-size: 32px;
  color: #7c3aed;
  opacity: 0.6;
  margin-bottom: 8px;
}

.upload-text {
  font-size: 14px;
  margin-bottom: 4px;
}

.upload-hint {
  font-size: 12px;
  opacity: 0.5;
}

.divider {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 16px 0;
}

.divider::before,
.divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: rgba(255, 255, 255, 0.1);
}

.divider span {
  font-size: 12px;
  opacity: 0.5;
}
</style>
