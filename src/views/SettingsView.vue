<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  NCard, NForm, NFormItem, NInput, NButton, NSpace, NTabs, NTabPane,
  NList, NListItem, NThing, NPopconfirm, NModal, NSelect, NEmpty,
  NUpload, NAlert, NTag, type UploadFileInfo
} from 'naive-ui'
import { useConfigStore } from '@/stores/config'
import { message } from '@/composables/useNaiveMessage'
import type { ProviderPreset, PromptTemplate } from '@/types'

const { t } = useI18n()
const configStore = useConfigStore()

// Provider preset form
const showPresetModal = ref(false)
const editingPreset = ref<ProviderPreset | null>(null)
const presetForm = ref({
  name: '',
  baseUrl: '',
  apiKey: ''
})

function openAddPresetModal() {
  editingPreset.value = null
  presetForm.value = { name: '', baseUrl: 'https://', apiKey: '' }
  showPresetModal.value = true
}

function openEditPresetModal(preset: ProviderPreset) {
  editingPreset.value = preset
  presetForm.value = {
    name: preset.name,
    baseUrl: preset.baseUrl,
    apiKey: preset.apiKey
  }
  showPresetModal.value = true
}

function savePreset() {
  if (!presetForm.value.name || !presetForm.value.baseUrl) {
    message.error(t('settings.errors.fillRequired'))
    return
  }

  if (editingPreset.value) {
    configStore.updatePreset(editingPreset.value.id, presetForm.value)
    message.success(t('settings.presetUpdated'))
  } else {
    configStore.addPreset(presetForm.value)
    message.success(t('settings.presetAdded'))
  }
  showPresetModal.value = false
}

function deletePreset(id: string) {
  if (configStore.deletePreset(id)) {
    message.success(t('common.success'))
  } else {
    message.error(t('settings.errors.cannotDeleteLast'))
  }
}

// Prompt template form
const showTemplateModal = ref(false)
const editingTemplate = ref<PromptTemplate | null>(null)
const templateForm = ref({
  name: '',
  type: 'both' as 'video' | 'image' | 'audio' | 'both',
  prompt: ''
})

const templateTypeOptions = [
  { label: t('settings.templateTypes.video'), value: 'video' },
  { label: t('settings.templateTypes.image'), value: 'image' },
  { label: t('settings.templateTypes.audio'), value: 'audio' },
  { label: t('settings.templateTypes.both'), value: 'both' }
]

function openAddTemplateModal() {
  editingTemplate.value = null
  templateForm.value = { name: '', type: 'both', prompt: '' }
  showTemplateModal.value = true
}

function openEditTemplateModal(template: PromptTemplate) {
  editingTemplate.value = template
  templateForm.value = {
    name: template.name,
    type: template.type,
    prompt: template.prompt
  }
  showTemplateModal.value = true
}

function saveTemplate() {
  if (!templateForm.value.name || !templateForm.value.prompt) {
    message.error(t('settings.errors.fillRequired'))
    return
  }

  if (editingTemplate.value) {
    configStore.updatePromptTemplate(editingTemplate.value.id, templateForm.value)
    message.success(t('settings.templateUpdated'))
  } else {
    configStore.addPromptTemplate(templateForm.value)
    message.success(t('settings.templateAdded'))
  }
  showTemplateModal.value = false
}

function deleteTemplate(id: string) {
  if (configStore.deletePromptTemplate(id)) {
    message.success(t('common.success'))
  }
}

// Export/Import
function handleExport() {
  const json = configStore.exportSettings()
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `media-client-settings-${Date.now()}.json`
  a.click()
  URL.revokeObjectURL(url)
  message.success(t('settings.exported'))
}

function handleImport(options: { file: UploadFileInfo }) {
  const file = options.file.file
  if (!file) return

  const reader = new FileReader()
  reader.onload = (e) => {
    const content = e.target?.result as string
    if (configStore.importSettings(content)) {
      message.success(t('settings.imported'))
    } else {
      message.error(t('settings.errors.importFailed'))
    }
  }
  reader.readAsText(file)
}

// Format date
function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString()
}

// Template type badge color
function getTypeColor(type: string) {
  if (type === 'video') return 'info' as const
  if (type === 'image') return 'success' as const
  return 'default' as const
}
</script>

<template>
  <div class="page-container">
    <div class="page-header">
      <h1 class="page-title gradient-text">{{ t('settings.title') }}</h1>
      <p class="page-subtitle">{{ t('settings.subtitle') }}</p>
    </div>

    <NTabs type="line" animated>
      <!-- Provider Presets Tab -->
      <NTabPane name="providers" :tab="t('settings.tabs.providers')">
        <NCard class="glass-card">
          <template #header>
            <div class="card-header">
              <span>{{ t('settings.providerPresets') }}</span>
              <NButton type="primary" size="small" @click="openAddPresetModal">
                {{ t('settings.addPreset') }}
              </NButton>
            </div>
          </template>

          <NEmpty v-if="configStore.providerPresets.length === 0" :description="t('settings.noPresets')" />

          <NList v-else hoverable clickable>
            <NListItem v-for="preset in configStore.providerPresets" :key="preset.id">
              <NThing>
                <template #header>
                  <NSpace align="center">
                    <span>{{ preset.name }}</span>
                    <NTag v-if="preset.id === configStore.activePresetId" type="success" size="small">
                      {{ t('settings.active') }}
                    </NTag>
                  </NSpace>
                </template>
                <template #description>
                  <div class="preset-url">{{ preset.baseUrl }}</div>
                  <div class="preset-key">
                    API Key: {{ preset.apiKey ? '••••••••' + preset.apiKey.slice(-4) : t('settings.notSet') }}
                  </div>
                </template>
                <template #header-extra>
                  <NSpace>
                    <NButton
                      v-if="preset.id !== configStore.activePresetId"
                      size="small"
                      @click="configStore.setActivePreset(preset.id)"
                    >
                      {{ t('settings.activate') }}
                    </NButton>
                    <NButton size="small" @click="openEditPresetModal(preset)">
                      {{ t('common.edit') }}
                    </NButton>
                    <NPopconfirm @positive-click="deletePreset(preset.id)">
                      <template #trigger>
                        <NButton size="small" type="error" secondary>
                          {{ t('common.delete') }}
                        </NButton>
                      </template>
                      {{ t('settings.confirmDelete') }}
                    </NPopconfirm>
                  </NSpace>
                </template>
              </NThing>
            </NListItem>
          </NList>
        </NCard>
      </NTabPane>

      <!-- Prompt Templates Tab -->
      <NTabPane name="templates" :tab="t('settings.tabs.templates')">
        <NCard class="glass-card">
          <template #header>
            <div class="card-header">
              <span>{{ t('settings.promptTemplates') }}</span>
              <NButton type="primary" size="small" @click="openAddTemplateModal">
                {{ t('settings.addTemplate') }}
              </NButton>
            </div>
          </template>

          <NEmpty v-if="configStore.promptTemplates.length === 0" :description="t('settings.noTemplates')" />

          <NList v-else hoverable>
            <NListItem v-for="template in configStore.promptTemplates" :key="template.id">
              <NThing>
                <template #header>
                  <NSpace align="center">
                    <span>{{ template.name }}</span>
                    <NTag :type="getTypeColor(template.type)" size="small">
                      {{ t(`settings.templateTypes.${template.type}`) }}
                    </NTag>
                  </NSpace>
                </template>
                <template #description>
                  <div class="template-prompt">{{ template.prompt }}</div>
                  <div class="template-date">{{ formatDate(template.createdAt) }}</div>
                </template>
                <template #header-extra>
                  <NSpace>
                    <NButton size="small" @click="openEditTemplateModal(template)">
                      {{ t('common.edit') }}
                    </NButton>
                    <NPopconfirm @positive-click="deleteTemplate(template.id)">
                      <template #trigger>
                        <NButton size="small" type="error" secondary>
                          {{ t('common.delete') }}
                        </NButton>
                      </template>
                      {{ t('settings.confirmDelete') }}
                    </NPopconfirm>
                  </NSpace>
                </template>
              </NThing>
            </NListItem>
          </NList>
        </NCard>
      </NTabPane>

      <!-- Import/Export Tab -->
      <NTabPane name="backup" :tab="t('settings.tabs.backup')">
        <NCard class="glass-card">
          <template #header>{{ t('settings.importExport') }}</template>

          <NSpace vertical size="large">
            <NAlert type="info">
              {{ t('settings.backupDescription') }}
            </NAlert>

            <NSpace>
              <NButton type="primary" @click="handleExport">
                {{ t('settings.export') }}
              </NButton>

              <NUpload
                accept=".json"
                :show-file-list="false"
                :default-upload="false"
                @change="handleImport"
              >
                <NButton>{{ t('settings.import') }}</NButton>
              </NUpload>
            </NSpace>
          </NSpace>
        </NCard>
      </NTabPane>
    </NTabs>

    <!-- Add/Edit Preset Modal -->
    <NModal
      v-model:show="showPresetModal"
      preset="card"
      style="max-width: 500px"
      :title="editingPreset ? t('settings.editPreset') : t('settings.addPreset')"
    >
      <NForm label-placement="left" label-width="100">
        <NFormItem :label="t('settings.presetName')" required>
          <NInput v-model:value="presetForm.name" :placeholder="t('settings.placeholders.presetName')" />
        </NFormItem>
        <NFormItem label="Base URL" required>
          <NInput v-model:value="presetForm.baseUrl" placeholder="https://api.example.com" />
        </NFormItem>
        <NFormItem label="API Key">
          <NInput
            v-model:value="presetForm.apiKey"
            type="password"
            show-password-on="click"
            :placeholder="t('common.placeholder.apiKey')"
          />
        </NFormItem>
        <NFormItem label=" ">
          <NSpace>
            <NButton type="primary" @click="savePreset">{{ t('common.save') }}</NButton>
            <NButton @click="showPresetModal = false">{{ t('common.cancel') }}</NButton>
          </NSpace>
        </NFormItem>
      </NForm>
    </NModal>

    <!-- Add/Edit Template Modal -->
    <NModal
      v-model:show="showTemplateModal"
      preset="card"
      style="max-width: 600px"
      :title="editingTemplate ? t('settings.editTemplate') : t('settings.addTemplate')"
    >
      <NForm label-placement="left" label-width="100">
        <NFormItem :label="t('settings.templateName')" required>
          <NInput v-model:value="templateForm.name" :placeholder="t('settings.placeholders.templateName')" />
        </NFormItem>
        <NFormItem :label="t('settings.templateType')">
          <NSelect v-model:value="templateForm.type" :options="templateTypeOptions" />
        </NFormItem>
        <NFormItem :label="t('image.prompt')" required>
          <NInput
            v-model:value="templateForm.prompt"
            type="textarea"
            :rows="4"
            :placeholder="t('settings.placeholders.templatePrompt')"
          />
        </NFormItem>
        <NFormItem label=" ">
          <NSpace>
            <NButton type="primary" @click="saveTemplate">{{ t('common.save') }}</NButton>
            <NButton @click="showTemplateModal = false">{{ t('common.cancel') }}</NButton>
          </NSpace>
        </NFormItem>
      </NForm>
    </NModal>
  </div>
</template>

<style scoped>
.page-container {
  max-width: 1400px;
  margin: 0 auto;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.preset-url {
  font-family: ui-monospace, monospace;
  font-size: 13px;
  opacity: 0.8;
}

.preset-key {
  font-size: 12px;
  opacity: 0.6;
  margin-top: 4px;
}

.template-prompt {
  font-size: 13px;
  opacity: 0.8;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.template-date {
  font-size: 12px;
  opacity: 0.5;
  margin-top: 4px;
}
</style>
