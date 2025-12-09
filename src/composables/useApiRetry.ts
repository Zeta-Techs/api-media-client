/**
 * useApiRetry composable
 * 提供 API 请求重试机制，支持指数退避
 */
import { ref } from 'vue'

export interface RetryOptions {
  /** 最大重试次数，默认 3 */
  maxRetries?: number
  /** 初始延迟时间（毫秒），默认 1000 */
  initialDelay?: number
  /** 最大延迟时间（毫秒），默认 30000 */
  maxDelay?: number
  /** 退避倍数，默认 2 */
  backoffMultiplier?: number
  /** 是否添加随机抖动，默认 true */
  jitter?: boolean
  /** 判断是否应该重试的函数 */
  shouldRetry?: (error: unknown, attempt: number) => boolean
  /** 重试前的回调 */
  onRetry?: (attempt: number, delay: number, error: unknown) => void
}

export interface RetryState {
  /** 当前重试次数 */
  attempt: number
  /** 是否正在重试 */
  isRetrying: boolean
  /** 最后一次错误 */
  lastError: unknown | null
}

/**
 * 默认的重试判断函数
 * 只对网络错误和 5xx 错误进行重试
 */
export function defaultShouldRetry(error: unknown): boolean {
  // 网络错误
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return true
  }

  // HTTP 错误
  if (error instanceof Error) {
    const message = error.message.toLowerCase()
    // 5xx 服务器错误
    if (/5\d{2}/.test(message) || message.includes('server error')) {
      return true
    }
    // 网络相关错误
    if (
      message.includes('network') ||
      message.includes('timeout') ||
      message.includes('connection') ||
      message.includes('econnreset') ||
      message.includes('econnrefused')
    ) {
      return true
    }
    // 429 Too Many Requests
    if (message.includes('429') || message.includes('rate limit')) {
      return true
    }
  }

  return false
}

/**
 * 计算延迟时间（指数退避 + 抖动）
 */
export function calculateDelay(
  attempt: number,
  initialDelay: number,
  maxDelay: number,
  backoffMultiplier: number,
  jitter: boolean
): number {
  // 指数退避
  let delay = initialDelay * Math.pow(backoffMultiplier, attempt - 1)

  // 添加随机抖动（-25% ~ +25%）
  if (jitter) {
    const jitterFactor = 0.25
    const jitterRange = delay * jitterFactor
    delay = delay - jitterRange + Math.random() * jitterRange * 2
  }

  // 限制最大延迟
  return Math.min(delay, maxDelay)
}

/**
 * 延迟执行
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * 带重试的请求执行器
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 30000,
    backoffMultiplier = 2,
    jitter = true,
    shouldRetry = defaultShouldRetry,
    onRetry
  } = options

  let lastError: unknown

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error

      // 检查是否是被取消的请求
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw error
      }

      // 检查是否应该重试
      if (attempt > maxRetries || !shouldRetry(error, attempt)) {
        throw error
      }

      // 计算延迟
      const delay = calculateDelay(attempt, initialDelay, maxDelay, backoffMultiplier, jitter)

      // 触发重试回调
      onRetry?.(attempt, delay, error)

      // 等待后重试
      await sleep(delay)
    }
  }

  throw lastError
}

/**
 * useApiRetry composable
 */
export function useApiRetry(defaultOptions: RetryOptions = {}) {
  const state = ref<RetryState>({
    attempt: 0,
    isRetrying: false,
    lastError: null
  })

  /**
   * 执行带重试的异步操作
   */
  async function execute<T>(
    fn: () => Promise<T>,
    options: RetryOptions = {}
  ): Promise<T> {
    const mergedOptions: RetryOptions = {
      ...defaultOptions,
      ...options,
      onRetry: (attempt, delay, error) => {
        state.value = {
          attempt,
          isRetrying: true,
          lastError: error
        }
        options.onRetry?.(attempt, delay, error)
        defaultOptions.onRetry?.(attempt, delay, error)
      }
    }

    state.value = {
      attempt: 0,
      isRetrying: false,
      lastError: null
    }

    try {
      return await withRetry(fn, mergedOptions)
    } finally {
      state.value.isRetrying = false
    }
  }

  /**
   * 重置状态
   */
  function reset() {
    state.value = {
      attempt: 0,
      isRetrying: false,
      lastError: null
    }
  }

  return {
    state,
    execute,
    reset
  }
}

export type UseApiRetryReturn = ReturnType<typeof useApiRetry>
