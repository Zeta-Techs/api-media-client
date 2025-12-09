/**
 * useWebSocketReconnect composable
 * 提供 WebSocket 重连和心跳机制
 */
import { ref, onUnmounted } from 'vue'

export interface WebSocketReconnectOptions {
  /** 最大重连次数，默认 5 */
  maxReconnects?: number
  /** 初始重连延迟（毫秒），默认 1000 */
  initialDelay?: number
  /** 最大重连延迟（毫秒），默认 30000 */
  maxDelay?: number
  /** 心跳间隔（毫秒），默认 30000，设为 0 禁用心跳 */
  heartbeatInterval?: number
  /** 心跳超时（毫秒），默认 10000 */
  heartbeatTimeout?: number
  /** 心跳消息生成函数 */
  heartbeatMessage?: () => string | ArrayBuffer
  /** 连接成功回调 */
  onOpen?: (event: Event) => void
  /** 消息回调 */
  onMessage?: (event: MessageEvent) => void
  /** 连接关闭回调 */
  onClose?: (event: CloseEvent) => void
  /** 错误回调 */
  onError?: (event: Event) => void
  /** 重连尝试回调 */
  onReconnectAttempt?: (attempt: number, delay: number) => void
  /** 重连失败回调 */
  onReconnectFailed?: () => void
}

export interface WebSocketState {
  /** 是否已连接 */
  isConnected: boolean
  /** 是否正在连接 */
  isConnecting: boolean
  /** 是否正在重连 */
  isReconnecting: boolean
  /** 当前重连次数 */
  reconnectAttempt: number
  /** 最后一次错误 */
  lastError: string | null
}

export function useWebSocketReconnect(options: WebSocketReconnectOptions = {}) {
  const {
    maxReconnects = 5,
    initialDelay = 1000,
    maxDelay = 30000,
    heartbeatInterval = 30000,
    heartbeatTimeout = 10000,
    heartbeatMessage = () => JSON.stringify({ type: 'ping' }),
    onOpen,
    onMessage,
    onClose,
    onError,
    onReconnectAttempt,
    onReconnectFailed
  } = options

  const state = ref<WebSocketState>({
    isConnected: false,
    isConnecting: false,
    isReconnecting: false,
    reconnectAttempt: 0,
    lastError: null
  })

  let ws: WebSocket | null = null
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null
  let heartbeatTimeoutTimer: ReturnType<typeof setTimeout> | null = null
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null
  let currentUrl: string | null = null
  let currentProtocols: string | string[] | undefined = undefined
  let shouldReconnect = false
  let lastPongReceived = 0

  /**
   * 计算重连延迟（指数退避）
   */
  function calculateDelay(attempt: number): number {
    const delay = initialDelay * Math.pow(2, attempt - 1)
    // 添加随机抖动
    const jitter = delay * 0.25 * (Math.random() * 2 - 1)
    return Math.min(delay + jitter, maxDelay)
  }

  /**
   * 启动心跳
   */
  function startHeartbeat() {
    if (heartbeatInterval <= 0) return

    stopHeartbeat()
    lastPongReceived = Date.now()

    heartbeatTimer = setInterval(() => {
      if (!ws || ws.readyState !== WebSocket.OPEN) return

      // 检查上次 pong 是否超时
      if (Date.now() - lastPongReceived > heartbeatInterval + heartbeatTimeout) {
        console.warn('WebSocket heartbeat timeout, reconnecting...')
        handleDisconnect(true)
        return
      }

      // 发送心跳
      try {
        const msg = heartbeatMessage()
        ws.send(msg)
      } catch (e) {
        console.error('Failed to send heartbeat:', e)
      }
    }, heartbeatInterval)
  }

  /**
   * 停止心跳
   */
  function stopHeartbeat() {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer)
      heartbeatTimer = null
    }
    if (heartbeatTimeoutTimer) {
      clearTimeout(heartbeatTimeoutTimer)
      heartbeatTimeoutTimer = null
    }
  }

  /**
   * 处理 pong 响应
   */
  function handlePong() {
    lastPongReceived = Date.now()
  }

  /**
   * 处理断开连接
   */
  function handleDisconnect(forceReconnect = false) {
    stopHeartbeat()

    if (ws) {
      ws.onopen = null
      ws.onmessage = null
      ws.onerror = null
      ws.onclose = null

      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close(1000)
      }
      ws = null
    }

    state.value.isConnected = false
    state.value.isConnecting = false

    if ((shouldReconnect || forceReconnect) && state.value.reconnectAttempt < maxReconnects) {
      scheduleReconnect()
    }
  }

  /**
   * 安排重连
   */
  function scheduleReconnect() {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
    }

    state.value.reconnectAttempt++
    state.value.isReconnecting = true

    const delay = calculateDelay(state.value.reconnectAttempt)

    onReconnectAttempt?.(state.value.reconnectAttempt, delay)

    reconnectTimer = setTimeout(() => {
      if (currentUrl) {
        doConnect(currentUrl, currentProtocols)
      }
    }, delay)
  }

  /**
   * 内部连接函数
   */
  function doConnect(url: string, protocols?: string | string[]) {
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
      return
    }

    state.value.isConnecting = true
    state.value.lastError = null

    try {
      ws = protocols ? new WebSocket(url, protocols) : new WebSocket(url)

      ws.onopen = (event) => {
        state.value.isConnected = true
        state.value.isConnecting = false
        state.value.isReconnecting = false
        state.value.reconnectAttempt = 0
        state.value.lastError = null

        startHeartbeat()
        onOpen?.(event)
      }

      ws.onmessage = (event) => {
        // 检查是否是 pong 消息
        try {
          const data = JSON.parse(event.data)
          if (data.type === 'pong' || data.type === 'session.created' || data.type === 'session.updated') {
            handlePong()
          }
        } catch {
          // 非 JSON 消息也视为有效响应
          handlePong()
        }

        onMessage?.(event)
      }

      ws.onerror = (event) => {
        state.value.lastError = 'Connection error'
        onError?.(event)
      }

      ws.onclose = (event) => {
        state.value.isConnected = false
        state.value.isConnecting = false

        onClose?.(event)

        // 非正常关闭时尝试重连
        if (event.code !== 1000 && shouldReconnect && state.value.reconnectAttempt < maxReconnects) {
          scheduleReconnect()
        } else if (state.value.reconnectAttempt >= maxReconnects) {
          state.value.isReconnecting = false
          onReconnectFailed?.()
        }
      }
    } catch (e: any) {
      state.value.isConnecting = false
      state.value.lastError = e.message
      onError?.(e)
    }
  }

  /**
   * 连接 WebSocket
   */
  function connect(url: string, protocols?: string | string[]) {
    currentUrl = url
    currentProtocols = protocols
    shouldReconnect = true
    state.value.reconnectAttempt = 0

    doConnect(url, protocols)
  }

  /**
   * 断开连接
   */
  function disconnect() {
    shouldReconnect = false
    state.value.isReconnecting = false
    state.value.reconnectAttempt = 0

    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }

    handleDisconnect(false)
  }

  /**
   * 发送消息
   */
  function send(data: string | ArrayBuffer | Blob) {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket is not connected')
    }
    ws.send(data)
  }

  /**
   * 重置重连计数
   */
  function resetReconnectCount() {
    state.value.reconnectAttempt = 0
  }

  /**
   * 获取原始 WebSocket 实例
   */
  function getSocket(): WebSocket | null {
    return ws
  }

  // 组件卸载时清理
  onUnmounted(() => {
    disconnect()
  })

  return {
    state,
    connect,
    disconnect,
    send,
    getSocket,
    resetReconnectCount,
    handlePong
  }
}

export type UseWebSocketReconnectReturn = ReturnType<typeof useWebSocketReconnect>
