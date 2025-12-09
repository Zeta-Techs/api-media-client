/**
 * useApi composable
 * 提供统一的 API 请求逻辑，包括请求取消、错误处理等
 */
import { ref } from 'vue'
import { useConfigStore } from '@/stores/config'
import { parseApiError, buildApiUrl, isAbortError } from '@/utils/api'

interface UseApiOptions {
  /** 是否在请求时自动设置 loading 状态 */
  autoLoading?: boolean
}

interface ApiRequestOptions extends Omit<RequestInit, 'signal'> {
  /** 请求超时时间（毫秒） */
  timeout?: number
}

export function useApi(options: UseApiOptions = {}) {
  const { autoLoading = true } = options
  const configStore = useConfigStore()

  const isLoading = ref(false)
  const errorMessage = ref('')
  const abortController = ref<AbortController | null>(null)

  /**
   * 检查 API Key 是否已配置
   */
  function checkApiKey(): boolean {
    return !!configStore.apiKey
  }

  /**
   * 获取完整的 API URL
   */
  function getUrl(endpoint: string): string {
    return buildApiUrl(configStore.baseUrl, endpoint)
  }

  /**
   * 获取请求头（包含 Authorization）
   */
  function getHeaders(additionalHeaders?: HeadersInit): Headers {
    const headers = new Headers(additionalHeaders)
    if (configStore.apiKey) {
      headers.set('Authorization', `Bearer ${configStore.apiKey}`)
    }
    return headers
  }

  /**
   * 发起 API 请求
   */
  async function request<T>(
    endpoint: string,
    requestOptions: ApiRequestOptions = {}
  ): Promise<T> {
    const { timeout = 30000, ...fetchOptions } = requestOptions

    // 取消之前的请求
    cancel()

    // 创建新的 AbortController
    const controller = new AbortController()
    abortController.value = controller

    // 设置超时
    const timeoutId = timeout > 0 ? setTimeout(() => controller.abort(), timeout) : null

    if (autoLoading) {
      isLoading.value = true
      errorMessage.value = ''
    }

    try {
      const url = getUrl(endpoint)
      const headers = getHeaders(fetchOptions.headers)

      const response = await fetch(url, {
        ...fetchOptions,
        headers,
        signal: controller.signal
      })

      const text = await response.text()

      if (!response.ok) {
        throw parseApiError(text, response.status)
      }

      // 尝试解析 JSON，如果失败则返回原始文本
      try {
        return JSON.parse(text) as T
      } catch {
        return text as unknown as T
      }
    } catch (error) {
      if (isAbortError(error)) {
        throw error // 让调用者处理取消
      }

      const message = error instanceof Error ? error.message : String(error)
      if (autoLoading) {
        errorMessage.value = message
      }
      throw error
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
      if (autoLoading) {
        isLoading.value = false
      }
      abortController.value = null
    }
  }

  /**
   * 发起 JSON POST 请求
   */
  async function postJson<T>(
    endpoint: string,
    body: unknown,
    options: ApiRequestOptions = {}
  ): Promise<T> {
    return request<T>(endpoint, {
      ...options,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      body: JSON.stringify(body)
    })
  }

  /**
   * 发起 FormData POST 请求
   */
  async function postForm<T>(
    endpoint: string,
    formData: FormData,
    options: ApiRequestOptions = {}
  ): Promise<T> {
    return request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: formData
    })
  }

  /**
   * 发起 GET 请求
   */
  async function get<T>(
    endpoint: string,
    options: ApiRequestOptions = {}
  ): Promise<T> {
    return request<T>(endpoint, {
      ...options,
      method: 'GET'
    })
  }

  /**
   * 获取 Blob 响应（用于文件下载）
   */
  async function getBlob(
    endpoint: string,
    options: ApiRequestOptions = {}
  ): Promise<Blob> {
    const { timeout = 60000, ...fetchOptions } = options

    cancel()

    const controller = new AbortController()
    abortController.value = controller

    const timeoutId = timeout > 0 ? setTimeout(() => controller.abort(), timeout) : null

    if (autoLoading) {
      isLoading.value = true
      errorMessage.value = ''
    }

    try {
      const url = getUrl(endpoint)
      const headers = getHeaders(fetchOptions.headers)

      const response = await fetch(url, {
        ...fetchOptions,
        headers,
        signal: controller.signal
      })

      if (!response.ok) {
        const text = await response.text().catch(() => '')
        throw parseApiError(text, response.status)
      }

      return await response.blob()
    } catch (error) {
      if (isAbortError(error)) {
        throw error
      }

      const message = error instanceof Error ? error.message : String(error)
      if (autoLoading) {
        errorMessage.value = message
      }
      throw error
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
      if (autoLoading) {
        isLoading.value = false
      }
      abortController.value = null
    }
  }

  /**
   * 取消当前请求
   */
  function cancel() {
    if (abortController.value) {
      abortController.value.abort()
      abortController.value = null
    }
  }

  /**
   * 清除错误信息
   */
  function clearError() {
    errorMessage.value = ''
  }

  return {
    // 状态
    isLoading,
    errorMessage,
    abortController,

    // 工具方法
    checkApiKey,
    getUrl,
    getHeaders,

    // 请求方法
    request,
    postJson,
    postForm,
    get,
    getBlob,

    // 控制方法
    cancel,
    clearError
  }
}

export type UseApiReturn = ReturnType<typeof useApi>
