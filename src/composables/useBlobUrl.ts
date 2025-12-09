/**
 * useBlobUrl composable
 * 管理 Blob URL 的创建和清理，防止内存泄漏
 */
import { ref, onUnmounted } from 'vue'

export interface UseBlobUrlOptions {
  /** 是否在组件卸载时自动清理 */
  autoCleanup?: boolean
}

export function useBlobUrl(options: UseBlobUrlOptions = {}) {
  const { autoCleanup = true } = options

  // 存储所有创建的 Blob URL
  const urls = ref<string[]>([])

  /**
   * 从 Blob 创建 URL 并追踪
   */
  function createUrl(blob: Blob): string {
    const url = URL.createObjectURL(blob)
    urls.value.push(url)
    return url
  }

  /**
   * 释放单个 URL
   */
  function revokeUrl(url: string): void {
    const index = urls.value.indexOf(url)
    if (index !== -1) {
      URL.revokeObjectURL(url)
      urls.value.splice(index, 1)
    }
  }

  /**
   * 释放所有 URL
   */
  function revokeAll(): void {
    urls.value.forEach(url => URL.revokeObjectURL(url))
    urls.value = []
  }

  /**
   * 替换 URL（先释放旧的，再创建新的）
   */
  function replaceUrl(oldUrl: string | null, blob: Blob): string {
    if (oldUrl) {
      revokeUrl(oldUrl)
    }
    return createUrl(blob)
  }

  /**
   * 替换所有 URL（释放所有旧的，创建新的）
   */
  function replaceAllUrls(blobs: Blob[]): string[] {
    revokeAll()
    return blobs.map(blob => createUrl(blob))
  }

  // 自动清理
  if (autoCleanup) {
    onUnmounted(() => {
      revokeAll()
    })
  }

  return {
    urls,
    createUrl,
    revokeUrl,
    revokeAll,
    replaceUrl,
    replaceAllUrls
  }
}

/**
 * 用于管理单个 Blob URL 的简化版本
 */
export function useSingleBlobUrl(options: UseBlobUrlOptions = {}) {
  const { autoCleanup = true } = options

  const url = ref<string>('')

  /**
   * 设置新的 URL（自动释放旧的）
   */
  function setUrl(blob: Blob): string {
    if (url.value) {
      URL.revokeObjectURL(url.value)
    }
    url.value = URL.createObjectURL(blob)
    return url.value
  }

  /**
   * 清除 URL
   */
  function clearUrl(): void {
    if (url.value) {
      URL.revokeObjectURL(url.value)
      url.value = ''
    }
  }

  // 自动清理
  if (autoCleanup) {
    onUnmounted(() => {
      clearUrl()
    })
  }

  return {
    url,
    setUrl,
    clearUrl
  }
}

export type UseBlobUrlReturn = ReturnType<typeof useBlobUrl>
export type UseSingleBlobUrlReturn = ReturnType<typeof useSingleBlobUrl>
