/**
 * useApiError composable
 * 提供统一的 API 错误处理功能
 */
import { ref } from 'vue'
import { isAbortError } from '@/utils/api'

export type ErrorType = 'abort' | 'network' | 'api' | 'unknown'

export interface ApiErrorResult {
  type: ErrorType
  message: string
}

export interface UseApiErrorOptions {
  /** 默认错误消息 */
  defaultMessage?: string
}

/**
 * API 错误处理 composable
 */
export function useApiError(options: UseApiErrorOptions = {}) {
  const { defaultMessage = 'An error occurred' } = options

  const errorMessage = ref('')
  const errorType = ref<ErrorType | null>(null)

  /**
   * 处理错误并更新状态
   * @param error 捕获的错误
   * @param fallbackMessage 备用错误消息
   * @returns 错误结果
   */
  function handleError(error: unknown, fallbackMessage?: string): ApiErrorResult {
    // 处理中止错误
    if (isAbortError(error)) {
      errorMessage.value = ''
      errorType.value = 'abort'
      return { type: 'abort', message: '' }
    }

    // 处理 Error 对象
    if (error instanceof Error) {
      // 网络错误检测
      if (error.message === 'Failed to fetch' || error.message.includes('NetworkError')) {
        const message = 'Network error. Please check your connection.'
        errorMessage.value = message
        errorType.value = 'network'
        return { type: 'network', message }
      }

      // Use the error message directly
      const message = error.message
      errorMessage.value = message
      errorType.value = 'api'
      return { type: 'api', message }
    }

    // 处理字符串错误
    if (typeof error === 'string') {
      errorMessage.value = error
      errorType.value = 'api'
      return { type: 'api', message: error }
    }

    // 未知错误
    const message = fallbackMessage || defaultMessage
    errorMessage.value = message
    errorType.value = 'unknown'
    return { type: 'unknown', message }
  }

  /**
   * 清除错误状态
   */
  function clearError(): void {
    errorMessage.value = ''
    errorType.value = null
  }

  /**
   * 设置错误消息
   */
  function setError(message: string, type: ErrorType = 'api'): void {
    errorMessage.value = message
    errorType.value = type
  }

  /**
   * 检查是否有错误
   */
  function hasError(): boolean {
    return errorMessage.value !== ''
  }

  return {
    errorMessage,
    errorType,
    handleError,
    clearError,
    setError,
    hasError
  }
}

export type UseApiErrorReturn = ReturnType<typeof useApiError>
