import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

// 存储提供商类型
export type StorageProviderType = 'webdav' | 's3'

// WebDAV 配置
export interface WebDAVConfig {
  endpoint: string       // https://dav.example.com/files/
  username: string
  password: string
  basePath: string       // /uploads/ai-media/
}

// S3 配置
export interface S3Config {
  endpoint: string       // https://s3.amazonaws.com 或自定义端点
  region: string
  bucket: string
  accessKeyId: string
  secretAccessKey: string
  pathPrefix: string     // ai-media/
  forcePathStyle: boolean // MinIO 等需要设置为 true
  publicUrl?: string     // 可选的公开访问 URL 前缀
}

// 存储提供商
export interface StorageProvider {
  id: string
  name: string
  type: StorageProviderType
  enabled: boolean
  webdav?: WebDAVConfig
  s3?: S3Config
  createdAt: number
  updatedAt: number
}

// 上传设置
export interface UploadSettings {
  autoUpload: boolean              // 任务完成后自动上传
  deleteLocalAfterUpload: boolean  // 上传成功后清理本地
  filenamePattern: string          // 文件名模板
  selectedProviderId: string       // 当前使用的存储提供商 ID
}

// 默认上传设置
const DEFAULT_UPLOAD_SETTINGS: UploadSettings = {
  autoUpload: false,
  deleteLocalAfterUpload: false,
  filenamePattern: '{type}/{date}/{filename}',
  selectedProviderId: ''
}

// 本地存储 key
const STORAGE_KEY = 'cloud-storage-config'

export const useStorageStore = defineStore('storage', () => {
  // 存储提供商列表
  const providers = ref<StorageProvider[]>([])

  // 上传设置
  const uploadSettings = ref<UploadSettings>({ ...DEFAULT_UPLOAD_SETTINGS })

  // 当前选中的提供商
  const activeProvider = computed(() => {
    return providers.value.find(p => p.id === uploadSettings.value.selectedProviderId && p.enabled)
  })

  // 是否已配置存储
  const hasConfiguredStorage = computed(() => {
    return providers.value.some(p => p.enabled)
  })

  // 可用的存储提供商（已启用的）
  const enabledProviders = computed(() => {
    return providers.value.filter(p => p.enabled)
  })

  // 加载配置
  function loadConfig() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const data = JSON.parse(saved)
        providers.value = data.providers || []
        uploadSettings.value = { ...DEFAULT_UPLOAD_SETTINGS, ...data.uploadSettings }
      }
    } catch (e) {
      console.error('Failed to load storage config:', e)
    }
  }

  // 保存配置
  function saveConfig() {
    try {
      const data = {
        providers: providers.value,
        uploadSettings: uploadSettings.value
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    } catch (e) {
      console.error('Failed to save storage config:', e)
    }
  }

  // 添加存储提供商
  function addProvider(provider: Omit<StorageProvider, 'id' | 'createdAt' | 'updatedAt'>): StorageProvider {
    const now = Date.now()
    const newProvider: StorageProvider = {
      ...provider,
      id: `provider-${now}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: now,
      updatedAt: now
    }
    providers.value.push(newProvider)

    // 如果是第一个启用的提供商，自动设为默认
    if (newProvider.enabled && !uploadSettings.value.selectedProviderId) {
      uploadSettings.value.selectedProviderId = newProvider.id
    }

    saveConfig()
    return newProvider
  }

  // 更新存储提供商
  function updateProvider(id: string, updates: Partial<Omit<StorageProvider, 'id' | 'createdAt'>>) {
    const index = providers.value.findIndex(p => p.id === id)
    if (index !== -1) {
      providers.value[index] = {
        ...providers.value[index],
        ...updates,
        updatedAt: Date.now()
      }
      saveConfig()
    }
  }

  // 删除存储提供商
  function removeProvider(id: string) {
    const index = providers.value.findIndex(p => p.id === id)
    if (index !== -1) {
      providers.value.splice(index, 1)

      // 如果删除的是当前选中的，清空选择
      if (uploadSettings.value.selectedProviderId === id) {
        uploadSettings.value.selectedProviderId = enabledProviders.value[0]?.id || ''
      }

      saveConfig()
    }
  }

  // 设置活动提供商
  function setActiveProvider(id: string) {
    const provider = providers.value.find(p => p.id === id && p.enabled)
    if (provider) {
      uploadSettings.value.selectedProviderId = id
      saveConfig()
    }
  }

  // 更新上传设置
  function updateUploadSettings(settings: Partial<UploadSettings>) {
    uploadSettings.value = { ...uploadSettings.value, ...settings }
    saveConfig()
  }

  // 生成文件名
  function generateFilename(
    originalFilename: string,
    type: 'image' | 'video' | 'audio' | 'tts',
    taskId?: string
  ): string {
    const now = new Date()
    const date = now.toISOString().slice(0, 10) // YYYY-MM-DD
    const time = now.toISOString().slice(11, 19).replace(/:/g, '-') // HH-MM-SS
    const ext = originalFilename.split('.').pop() || 'bin'
    const name = originalFilename.replace(/\.[^.]+$/, '')

    let filename = uploadSettings.value.filenamePattern
      .replace('{type}', type)
      .replace('{date}', date)
      .replace('{time}', time)
      .replace('{filename}', name)
      .replace('{ext}', ext)
      .replace('{id}', taskId || `${Date.now()}`)
      .replace('{random}', Math.random().toString(36).slice(2, 8))

    // 确保有扩展名
    if (!filename.includes('.')) {
      filename += `.${ext}`
    }

    return filename
  }

  // 导出配置
  function exportConfig(): string {
    return JSON.stringify({
      providers: providers.value,
      uploadSettings: uploadSettings.value
    }, null, 2)
  }

  // 导入配置
  function importConfig(jsonStr: string): boolean {
    try {
      const data = JSON.parse(jsonStr)
      if (data.providers) {
        providers.value = data.providers
      }
      if (data.uploadSettings) {
        uploadSettings.value = { ...DEFAULT_UPLOAD_SETTINGS, ...data.uploadSettings }
      }
      saveConfig()
      return true
    } catch (e) {
      console.error('Failed to import storage config:', e)
      return false
    }
  }

  // 初始化时加载配置
  loadConfig()

  return {
    providers,
    uploadSettings,
    activeProvider,
    hasConfiguredStorage,
    enabledProviders,
    addProvider,
    updateProvider,
    removeProvider,
    setActiveProvider,
    updateUploadSettings,
    generateFilename,
    exportConfig,
    importConfig,
    loadConfig,
    saveConfig
  }
})
