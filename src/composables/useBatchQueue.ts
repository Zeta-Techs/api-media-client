import { ref, computed, shallowRef } from 'vue'

// 批量任务状态
export type BatchTaskStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'

// 批量任务接口
export interface BatchTask<T = any, R = any> {
  id: string
  input: T
  status: BatchTaskStatus
  progress: number
  result?: R
  error?: string
  startTime?: Date
  endTime?: Date
}

// 批量队列配置
export interface BatchQueueConfig {
  /** 最大并发数 */
  concurrency: number
  /** 失败后重试次数 */
  retryCount: number
  /** 重试延迟 (ms) */
  retryDelay: number
  /** 任务超时时间 (ms)，0 表示不限制 */
  timeout: number
  /** 失败后是否继续处理其他任务 */
  continueOnError: boolean
}

// 默认配置
const DEFAULT_CONFIG: BatchQueueConfig = {
  concurrency: 3,
  retryCount: 2,
  retryDelay: 1000,
  timeout: 0,
  continueOnError: true
}

// 任务处理函数类型
export type TaskProcessor<T, R> = (
  input: T,
  onProgress: (progress: number) => void,
  signal: AbortSignal
) => Promise<R>

/**
 * 批量任务队列 composable
 */
export function useBatchQueue<T = any, R = any>(
  processor: TaskProcessor<T, R>,
  initialConfig: Partial<BatchQueueConfig> = {}
) {
  // 配置
  const config = ref<BatchQueueConfig>({ ...DEFAULT_CONFIG, ...initialConfig })

  // 任务列表
  const tasks = shallowRef<BatchTask<T, R>[]>([])

  // 队列状态
  const isRunning = ref(false)
  const isPaused = ref(false)

  // 中止控制器映射
  const abortControllers = new Map<string, AbortController>()

  // 当前正在处理的任务数
  const activeCount = ref(0)

  // 计算属性
  const totalCount = computed(() => tasks.value.length)
  const completedCount = computed(() => tasks.value.filter(t => t.status === 'completed').length)
  const failedCount = computed(() => tasks.value.filter(t => t.status === 'failed').length)
  const pendingCount = computed(() => tasks.value.filter(t => t.status === 'pending').length)
  const processingCount = computed(() => tasks.value.filter(t => t.status === 'processing').length)

  const overallProgress = computed(() => {
    if (totalCount.value === 0) return 0
    const completed = completedCount.value + failedCount.value
    const processing = tasks.value
      .filter(t => t.status === 'processing')
      .reduce((sum, t) => sum + t.progress, 0) / 100
    return Math.round(((completed + processing) / totalCount.value) * 100)
  })

  const isComplete = computed(() =>
    totalCount.value > 0 &&
    pendingCount.value === 0 &&
    processingCount.value === 0
  )

  // 生成唯一 ID
  function generateId(): string {
    return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  // 添加任务
  function addTask(input: T): string {
    const id = generateId()
    const task: BatchTask<T, R> = {
      id,
      input,
      status: 'pending',
      progress: 0
    }
    tasks.value = [...tasks.value, task]
    return id
  }

  // 批量添加任务
  function addTasks(inputs: T[]): string[] {
    const ids: string[] = []
    const newTasks: BatchTask<T, R>[] = inputs.map(input => {
      const id = generateId()
      ids.push(id)
      return {
        id,
        input,
        status: 'pending' as const,
        progress: 0
      }
    })
    tasks.value = [...tasks.value, ...newTasks]
    return ids
  }

  // 移除任务
  function removeTask(id: string): boolean {
    const task = tasks.value.find(t => t.id === id)
    if (!task) return false

    // 如果正在处理，先取消
    if (task.status === 'processing') {
      cancelTask(id)
    }

    tasks.value = tasks.value.filter(t => t.id !== id)
    return true
  }

  // 清空任务
  function clearTasks(): void {
    // 取消所有正在处理的任务
    tasks.value.forEach(task => {
      if (task.status === 'processing') {
        const controller = abortControllers.get(task.id)
        controller?.abort()
      }
    })
    abortControllers.clear()
    tasks.value = []
    activeCount.value = 0
  }

  // 清空已完成的任务
  function clearCompletedTasks(): void {
    tasks.value = tasks.value.filter(t => t.status !== 'completed')
  }

  // 清空失败的任务
  function clearFailedTasks(): void {
    tasks.value = tasks.value.filter(t => t.status !== 'failed')
  }

  // 更新任务
  function updateTask(id: string, updates: Partial<BatchTask<T, R>>): void {
    tasks.value = tasks.value.map(t =>
      t.id === id ? { ...t, ...updates } : t
    )
  }

  // 处理单个任务
  async function processTask(task: BatchTask<T, R>, retryLeft: number = config.value.retryCount): Promise<void> {
    const controller = new AbortController()
    abortControllers.set(task.id, controller)

    // 超时处理
    let timeoutId: ReturnType<typeof setTimeout> | undefined
    if (config.value.timeout > 0) {
      timeoutId = setTimeout(() => {
        controller.abort()
      }, config.value.timeout)
    }

    try {
      updateTask(task.id, {
        status: 'processing',
        progress: 0,
        startTime: new Date(),
        error: undefined
      })

      const result = await processor(
        task.input,
        (progress) => updateTask(task.id, { progress }),
        controller.signal
      )

      updateTask(task.id, {
        status: 'completed',
        progress: 100,
        result,
        endTime: new Date()
      })
    } catch (e: any) {
      if (e.name === 'AbortError') {
        // 被取消
        updateTask(task.id, {
          status: 'cancelled',
          error: 'Cancelled',
          endTime: new Date()
        })
      } else if (retryLeft > 0) {
        // 重试
        await new Promise(resolve => setTimeout(resolve, config.value.retryDelay))
        await processTask(task, retryLeft - 1)
      } else {
        // 失败
        updateTask(task.id, {
          status: 'failed',
          error: e.message || 'Unknown error',
          endTime: new Date()
        })
      }
    } finally {
      if (timeoutId) clearTimeout(timeoutId)
      abortControllers.delete(task.id)
      activeCount.value--
    }
  }

  // 处理队列
  async function processQueue(): Promise<void> {
    while (isRunning.value && !isPaused.value) {
      // 获取下一个待处理的任务
      const pendingTask = tasks.value.find(t => t.status === 'pending')

      if (!pendingTask) {
        // 没有待处理任务，检查是否还有正在处理的
        if (activeCount.value === 0) {
          isRunning.value = false
        }
        break
      }

      // 检查并发限制
      if (activeCount.value >= config.value.concurrency) {
        // 等待一个任务完成
        await new Promise(resolve => setTimeout(resolve, 100))
        continue
      }

      activeCount.value++
      processTask(pendingTask).catch(() => {
        // 错误已在 processTask 中处理
      })

      // 短暂延迟避免同时启动过多任务
      await new Promise(resolve => setTimeout(resolve, 50))
    }
  }

  // 开始处理
  function start(): void {
    if (isRunning.value && !isPaused.value) return

    isRunning.value = true
    isPaused.value = false
    processQueue()
  }

  // 暂停处理
  function pause(): void {
    isPaused.value = true
  }

  // 恢复处理
  function resume(): void {
    if (!isRunning.value) {
      start()
    } else {
      isPaused.value = false
      processQueue()
    }
  }

  // 停止处理（取消所有任务）
  function stop(): void {
    isRunning.value = false
    isPaused.value = false

    // 取消所有正在处理的任务
    tasks.value.forEach(task => {
      if (task.status === 'processing') {
        cancelTask(task.id)
      }
    })
  }

  // 取消单个任务
  function cancelTask(id: string): boolean {
    const controller = abortControllers.get(id)
    if (controller) {
      controller.abort()
      return true
    }
    return false
  }

  // 重试失败的任务
  function retryFailed(): void {
    tasks.value = tasks.value.map(t =>
      t.status === 'failed'
        ? { ...t, status: 'pending' as const, progress: 0, error: undefined }
        : t
    )

    if (!isRunning.value) {
      start()
    }
  }

  // 重试单个任务
  function retryTask(id: string): void {
    const task = tasks.value.find(t => t.id === id)
    if (task && (task.status === 'failed' || task.status === 'cancelled')) {
      updateTask(id, { status: 'pending', progress: 0, error: undefined })
      if (!isRunning.value) {
        start()
      }
    }
  }

  // 获取任务
  function getTask(id: string): BatchTask<T, R> | undefined {
    return tasks.value.find(t => t.id === id)
  }

  // 更新配置
  function updateConfig(newConfig: Partial<BatchQueueConfig>): void {
    config.value = { ...config.value, ...newConfig }
  }

  return {
    // 状态
    tasks,
    config,
    isRunning,
    isPaused,

    // 计算属性
    totalCount,
    completedCount,
    failedCount,
    pendingCount,
    processingCount,
    overallProgress,
    isComplete,

    // 任务管理
    addTask,
    addTasks,
    removeTask,
    clearTasks,
    clearCompletedTasks,
    clearFailedTasks,
    getTask,

    // 队列控制
    start,
    pause,
    resume,
    stop,
    cancelTask,
    retryFailed,
    retryTask,

    // 配置
    updateConfig
  }
}
