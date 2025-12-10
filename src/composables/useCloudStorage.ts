import { ref, computed } from 'vue'
import { useStorageStore, type StorageProvider } from '@/stores/storage'
import { createWebDAVService, type WebDAVService } from '@/services/storage/webdav'
import { createS3Service, type S3Service } from '@/services/storage/s3'

export interface UploadTask {
  id: string
  filename: string
  status: 'pending' | 'uploading' | 'completed' | 'failed'
  progress: number
  url?: string
  error?: string
}

export interface UploadOptions {
  onProgress?: (progress: number) => void
  signal?: AbortSignal
  contentType?: string
}

/**
 * 云存储上传 composable
 */
export function useCloudStorage() {
  const storageStore = useStorageStore()

  // 上传状态
  const isUploading = ref(false)
  const uploadQueue = ref<UploadTask[]>([])
  const currentUpload = ref<UploadTask | null>(null)

  // 是否已配置存储
  const hasStorage = computed(() => storageStore.hasConfiguredStorage)

  // 当前活动的提供商
  const activeProvider = computed(() => storageStore.activeProvider)

  // 是否启用自动上传
  const autoUploadEnabled = computed(() =>
    storageStore.uploadSettings.autoUpload && hasStorage.value
  )

  /**
   * 创建存储服务实例
   */
  function createService(provider: StorageProvider): WebDAVService | S3Service | null {
    if (provider.type === 'webdav' && provider.webdav) {
      return createWebDAVService(provider.webdav)
    } else if (provider.type === 's3' && provider.s3) {
      return createS3Service(provider.s3)
    }
    return null
  }

  /**
   * 上传单个文件
   */
  async function uploadFile(
    blob: Blob,
    originalFilename: string,
    type: 'image' | 'video' | 'audio' | 'tts',
    options: UploadOptions = {}
  ): Promise<{ success: boolean; url?: string; error?: string }> {
    const provider = activeProvider.value
    if (!provider) {
      return { success: false, error: 'No storage provider configured' }
    }

    const service = createService(provider)
    if (!service) {
      return { success: false, error: 'Failed to create storage service' }
    }

    // 生成目标文件名
    const filename = storageStore.generateFilename(originalFilename, type)

    // 创建上传任务
    const task: UploadTask = {
      id: `upload-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      filename,
      status: 'uploading',
      progress: 0
    }

    currentUpload.value = task
    isUploading.value = true

    try {
      const result = await service.upload(blob, filename, {
        onProgress: (progress) => {
          task.progress = progress
          options.onProgress?.(progress)
        },
        signal: options.signal,
        contentType: options.contentType
      })

      if (result.success) {
        task.status = 'completed'
        task.url = result.url
        return { success: true, url: result.url }
      } else {
        task.status = 'failed'
        task.error = result.error
        return { success: false, error: result.error }
      }
    } catch (e: any) {
      task.status = 'failed'
      task.error = e.message
      return { success: false, error: e.message }
    } finally {
      isUploading.value = false
      currentUpload.value = null
    }
  }

  /**
   * 批量上传文件
   */
  async function uploadFiles(
    files: Array<{
      blob: Blob
      filename: string
      type: 'image' | 'video' | 'audio' | 'tts'
    }>,
    options: {
      onProgress?: (completed: number, total: number) => void
      onFileProgress?: (index: number, progress: number) => void
      signal?: AbortSignal
    } = {}
  ): Promise<Array<{ success: boolean; url?: string; error?: string }>> {
    const results: Array<{ success: boolean; url?: string; error?: string }> = []

    for (let i = 0; i < files.length; i++) {
      if (options.signal?.aborted) {
        results.push({ success: false, error: 'Upload cancelled' })
        continue
      }

      const file = files[i]
      const result = await uploadFile(file.blob, file.filename, file.type, {
        onProgress: (progress) => options.onFileProgress?.(i, progress),
        signal: options.signal
      })

      results.push(result)
      options.onProgress?.(i + 1, files.length)
    }

    return results
  }

  /**
   * 测试存储连接
   */
  async function testConnection(provider?: StorageProvider): Promise<{ success: boolean; message: string }> {
    const targetProvider = provider || activeProvider.value
    if (!targetProvider) {
      return { success: false, message: 'No storage provider specified' }
    }

    const service = createService(targetProvider)
    if (!service) {
      return { success: false, message: 'Failed to create storage service' }
    }

    return service.testConnection()
  }

  /**
   * 获取文件的 MIME 类型
   */
  function getMimeType(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase()
    const mimeTypes: Record<string, string> = {
      // Images
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'webp': 'image/webp',
      'svg': 'image/svg+xml',
      // Video
      'mp4': 'video/mp4',
      'webm': 'video/webm',
      'mov': 'video/quicktime',
      'avi': 'video/x-msvideo',
      // Audio
      'mp3': 'audio/mpeg',
      'wav': 'audio/wav',
      'ogg': 'audio/ogg',
      'flac': 'audio/flac',
      'm4a': 'audio/mp4',
      'aac': 'audio/aac',
      // Text
      'txt': 'text/plain',
      'json': 'application/json',
      'csv': 'text/csv'
    }
    return mimeTypes[ext || ''] || 'application/octet-stream'
  }

  return {
    // State
    isUploading,
    uploadQueue,
    currentUpload,

    // Computed
    hasStorage,
    activeProvider,
    autoUploadEnabled,

    // Methods
    uploadFile,
    uploadFiles,
    testConnection,
    getMimeType,

    // Store access
    storageStore
  }
}
