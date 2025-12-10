<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  NCard, NForm, NFormItem, NInput, NButton, NSpace, NTabs, NTabPane,
  NList, NListItem, NThing, NPopconfirm, NModal, NSelect, NEmpty,
  NUpload, NAlert, NTag, NSwitch,
  type UploadFileInfo
} from 'naive-ui'
import { useConfigStore } from '@/stores/config'
import { useStorageStore, type StorageProvider, type StorageProviderType } from '@/stores/storage'
import { useCloudStorage } from '@/composables/useCloudStorage'
import { message } from '@/composables/useNaiveMessage'
import type { ProviderPreset, PromptTemplate } from '@/types'

const { t } = useI18n()
const configStore = useConfigStore()
const storageStore = useStorageStore()
const { testConnection } = useCloudStorage()

// Storage provider form
const showStorageModal = ref(false)
const editingStorage = ref<StorageProvider | null>(null)
const testingConnection = ref(false)
const storageForm = ref({
  name: '',
  type: 'webdav' as StorageProviderType,
  enabled: true,
  // WebDAV config
  webdavEndpoint: '',
  webdavUsername: '',
  webdavPassword: '',
  webdavBasePath: '/uploads/ai-media',
  // S3 config
  s3Endpoint: '',
  s3Region: 'us-east-1',
  s3Bucket: '',
  s3AccessKeyId: '',
  s3SecretAccessKey: '',
  s3PathPrefix: 'ai-media',
  s3ForcePathStyle: false,
  s3PublicUrl: ''
})

const storageTypeOptions = [
  { label: 'WebDAV', value: 'webdav' },
  { label: 'S3 Compatible', value: 's3' }
]

function openAddStorageModal() {
  editingStorage.value = null
  storageForm.value = {
    name: '',
    type: 'webdav',
    enabled: true,
    webdavEndpoint: '',
    webdavUsername: '',
    webdavPassword: '',
    webdavBasePath: '/uploads/ai-media',
    s3Endpoint: '',
    s3Region: 'us-east-1',
    s3Bucket: '',
    s3AccessKeyId: '',
    s3SecretAccessKey: '',
    s3PathPrefix: 'ai-media',
    s3ForcePathStyle: false,
    s3PublicUrl: ''
  }
  showStorageModal.value = true
}

function openEditStorageModal(provider: StorageProvider) {
  editingStorage.value = provider
  storageForm.value = {
    name: provider.name,
    type: provider.type,
    enabled: provider.enabled,
    webdavEndpoint: provider.webdav?.endpoint || '',
    webdavUsername: provider.webdav?.username || '',
    webdavPassword: provider.webdav?.password || '',
    webdavBasePath: provider.webdav?.basePath || '/uploads/ai-media',
    s3Endpoint: provider.s3?.endpoint || '',
    s3Region: provider.s3?.region || 'us-east-1',
    s3Bucket: provider.s3?.bucket || '',
    s3AccessKeyId: provider.s3?.accessKeyId || '',
    s3SecretAccessKey: provider.s3?.secretAccessKey || '',
    s3PathPrefix: provider.s3?.pathPrefix || 'ai-media',
    s3ForcePathStyle: provider.s3?.forcePathStyle || false,
    s3PublicUrl: provider.s3?.publicUrl || ''
  }
  showStorageModal.value = true
}

function saveStorage() {
  if (!storageForm.value.name) {
    message.error(t('settings.errors.fillRequired'))
    return
  }

  const providerData: Omit<StorageProvider, 'id' | 'createdAt' | 'updatedAt'> = {
    name: storageForm.value.name,
    type: storageForm.value.type,
    enabled: storageForm.value.enabled
  }

  if (storageForm.value.type === 'webdav') {
    if (!storageForm.value.webdavEndpoint || !storageForm.value.webdavUsername) {
      message.error(t('settings.errors.fillRequired'))
      return
    }
    providerData.webdav = {
      endpoint: storageForm.value.webdavEndpoint,
      username: storageForm.value.webdavUsername,
      password: storageForm.value.webdavPassword,
      basePath: storageForm.value.webdavBasePath
    }
  } else {
    if (!storageForm.value.s3Endpoint || !storageForm.value.s3Bucket || !storageForm.value.s3AccessKeyId) {
      message.error(t('settings.errors.fillRequired'))
      return
    }
    providerData.s3 = {
      endpoint: storageForm.value.s3Endpoint,
      region: storageForm.value.s3Region,
      bucket: storageForm.value.s3Bucket,
      accessKeyId: storageForm.value.s3AccessKeyId,
      secretAccessKey: storageForm.value.s3SecretAccessKey,
      pathPrefix: storageForm.value.s3PathPrefix,
      forcePathStyle: storageForm.value.s3ForcePathStyle,
      publicUrl: storageForm.value.s3PublicUrl || undefined
    }
  }

  if (editingStorage.value) {
    storageStore.updateProvider(editingStorage.value.id, providerData)
    message.success(t('storage.providerUpdated'))
  } else {
    storageStore.addProvider(providerData)
    message.success(t('storage.providerAdded'))
  }
  showStorageModal.value = false
}

function deleteStorage(id: string) {
  storageStore.removeProvider(id)
  message.success(t('common.success'))
}

async function handleTestConnection() {
  testingConnection.value = true

  // 构建临时 provider 对象用于测试
  const tempProvider: StorageProvider = {
    id: 'test',
    name: storageForm.value.name,
    type: storageForm.value.type,
    enabled: true,
    createdAt: Date.now(),
    updatedAt: Date.now()
  }

  if (storageForm.value.type === 'webdav') {
    tempProvider.webdav = {
      endpoint: storageForm.value.webdavEndpoint,
      username: storageForm.value.webdavUsername,
      password: storageForm.value.webdavPassword,
      basePath: storageForm.value.webdavBasePath
    }
  } else {
    tempProvider.s3 = {
      endpoint: storageForm.value.s3Endpoint,
      region: storageForm.value.s3Region,
      bucket: storageForm.value.s3Bucket,
      accessKeyId: storageForm.value.s3AccessKeyId,
      secretAccessKey: storageForm.value.s3SecretAccessKey,
      pathPrefix: storageForm.value.s3PathPrefix,
      forcePathStyle: storageForm.value.s3ForcePathStyle,
      publicUrl: storageForm.value.s3PublicUrl || undefined
    }
  }

  try {
    const result = await testConnection(tempProvider)
    if (result.success) {
      message.success(t('storage.connectionSuccess'))
    } else {
      message.error(`${t('storage.connectionFailed')}: ${result.message}`)
    }
  } catch (e: any) {
    message.error(`${t('storage.connectionFailed')}: ${e.message}`)
  } finally {
    testingConnection.value = false
  }
}

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

      <!-- Cloud Storage Tab -->
      <NTabPane name="storage" :tab="t('settings.tabs.storage')">
        <NCard class="glass-card">
          <template #header>
            <div class="card-header">
              <span>{{ t('storage.providers') }}</span>
              <NButton type="primary" size="small" @click="openAddStorageModal">
                {{ t('storage.addProvider') }}
              </NButton>
            </div>
          </template>

          <NAlert type="info" style="margin-bottom: 16px">
            {{ t('storage.description') }}
          </NAlert>

          <NEmpty v-if="storageStore.providers.length === 0" :description="t('storage.noProviders')" />

          <NList v-else hoverable>
            <NListItem v-for="provider in storageStore.providers" :key="provider.id">
              <NThing>
                <template #header>
                  <NSpace align="center">
                    <span>{{ provider.name }}</span>
                    <NTag :type="provider.type === 'webdav' ? 'info' : 'warning'" size="small">
                      {{ provider.type.toUpperCase() }}
                    </NTag>
                    <NTag v-if="provider.enabled" type="success" size="small">
                      {{ t('common.enabled') }}
                    </NTag>
                    <NTag v-if="provider.id === storageStore.uploadSettings.selectedProviderId" type="primary" size="small">
                      {{ t('storage.active') }}
                    </NTag>
                  </NSpace>
                </template>
                <template #description>
                  <div class="storage-info">
                    <template v-if="provider.type === 'webdav'">
                      {{ provider.webdav?.endpoint }}
                    </template>
                    <template v-else>
                      {{ provider.s3?.endpoint }} / {{ provider.s3?.bucket }}
                    </template>
                  </div>
                </template>
                <template #header-extra>
                  <NSpace>
                    <NButton
                      v-if="provider.id !== storageStore.uploadSettings.selectedProviderId && provider.enabled"
                      size="small"
                      @click="storageStore.setActiveProvider(provider.id)"
                    >
                      {{ t('storage.setActive') }}
                    </NButton>
                    <NButton size="small" @click="openEditStorageModal(provider)">
                      {{ t('common.edit') }}
                    </NButton>
                    <NPopconfirm @positive-click="deleteStorage(provider.id)">
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

        <!-- Upload Settings Card -->
        <NCard class="glass-card" style="margin-top: 16px">
          <template #header>{{ t('storage.uploadSettings') }}</template>

          <NForm label-placement="left" label-width="140">
            <NFormItem :label="t('storage.autoUpload')">
              <NSwitch
                :value="storageStore.uploadSettings.autoUpload"
                @update:value="storageStore.updateUploadSettings({ autoUpload: $event })"
              />
            </NFormItem>
            <NFormItem :label="t('storage.filenamePattern')">
              <NInput
                :value="storageStore.uploadSettings.filenamePattern"
                @update:value="storageStore.updateUploadSettings({ filenamePattern: $event })"
                placeholder="{type}/{date}/{filename}"
              />
            </NFormItem>
            <NFormItem :label="t('storage.activeProvider')">
              <NSelect
                :value="storageStore.uploadSettings.selectedProviderId"
                :options="storageStore.enabledProviders.map(p => ({ label: p.name, value: p.id }))"
                @update:value="storageStore.setActiveProvider($event)"
                clearable
                :placeholder="t('storage.selectProvider')"
              />
            </NFormItem>
          </NForm>

          <NAlert type="warning" style="margin-top: 12px">
            {{ t('storage.corsWarning') }}
          </NAlert>
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

    <!-- Add/Edit Storage Provider Modal -->
    <NModal
      v-model:show="showStorageModal"
      preset="card"
      style="max-width: 600px"
      :title="editingStorage ? t('storage.editProvider') : t('storage.addProvider')"
    >
      <NForm label-placement="left" label-width="140">
        <NFormItem :label="t('storage.providerName')" required>
          <NInput v-model:value="storageForm.name" :placeholder="t('storage.placeholders.name')" />
        </NFormItem>
        <NFormItem :label="t('storage.providerType')">
          <NSelect v-model:value="storageForm.type" :options="storageTypeOptions" />
        </NFormItem>
        <NFormItem :label="t('common.enabled')">
          <NSwitch v-model:value="storageForm.enabled" />
        </NFormItem>

        <!-- WebDAV Configuration -->
        <template v-if="storageForm.type === 'webdav'">
          <NFormItem label="Endpoint" required>
            <NInput v-model:value="storageForm.webdavEndpoint" placeholder="https://webdav.example.com" />
          </NFormItem>
          <NFormItem :label="t('storage.username')" required>
            <NInput v-model:value="storageForm.webdavUsername" />
          </NFormItem>
          <NFormItem :label="t('storage.password')">
            <NInput
              v-model:value="storageForm.webdavPassword"
              type="password"
              show-password-on="click"
            />
          </NFormItem>
          <NFormItem :label="t('storage.basePath')">
            <NInput v-model:value="storageForm.webdavBasePath" placeholder="/uploads/ai-media" />
          </NFormItem>
        </template>

        <!-- S3 Configuration -->
        <template v-if="storageForm.type === 's3'">
          <NFormItem label="Endpoint" required>
            <NInput v-model:value="storageForm.s3Endpoint" placeholder="https://s3.amazonaws.com" />
          </NFormItem>
          <NFormItem label="Region">
            <NInput v-model:value="storageForm.s3Region" placeholder="us-east-1" />
          </NFormItem>
          <NFormItem label="Bucket" required>
            <NInput v-model:value="storageForm.s3Bucket" />
          </NFormItem>
          <NFormItem label="Access Key ID" required>
            <NInput v-model:value="storageForm.s3AccessKeyId" />
          </NFormItem>
          <NFormItem label="Secret Access Key">
            <NInput
              v-model:value="storageForm.s3SecretAccessKey"
              type="password"
              show-password-on="click"
            />
          </NFormItem>
          <NFormItem :label="t('storage.pathPrefix')">
            <NInput v-model:value="storageForm.s3PathPrefix" placeholder="ai-media" />
          </NFormItem>
          <NFormItem :label="t('storage.forcePathStyle')">
            <NSwitch v-model:value="storageForm.s3ForcePathStyle" />
          </NFormItem>
          <NFormItem :label="t('storage.publicUrl')">
            <NInput v-model:value="storageForm.s3PublicUrl" placeholder="https://cdn.example.com" />
          </NFormItem>
        </template>

        <NFormItem label=" ">
          <NSpace>
            <NButton type="primary" @click="saveStorage">{{ t('common.save') }}</NButton>
            <NButton @click="handleTestConnection" :loading="testingConnection">
              {{ t('storage.testConnection') }}
            </NButton>
            <NButton @click="showStorageModal = false">{{ t('common.cancel') }}</NButton>
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
