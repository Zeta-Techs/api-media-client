/**
 * useAudioPlayer composable
 * 提供音频播放控制功能
 */
import { ref, computed, onUnmounted } from 'vue'

export interface UseAudioPlayerOptions {
  /** 是否自动播放 */
  autoPlay?: boolean
  /** 循环播放 */
  loop?: boolean
}

export function useAudioPlayer(options: UseAudioPlayerOptions = {}) {
  const { autoPlay = false, loop = false } = options

  // 音频元素引用
  const audioElement = ref<HTMLAudioElement | null>(null)

  // 状态
  const isPlaying = ref(false)
  const currentTime = ref(0)
  const duration = ref(0)
  const volume = ref(1)
  const isMuted = ref(false)
  const isLoaded = ref(false)
  const error = ref<string | null>(null)

  // 音频源 URL
  const audioUrl = ref('')

  // 计算属性
  const progress = computed(() => {
    if (duration.value === 0) return 0
    return (currentTime.value / duration.value) * 100
  })

  const remainingTime = computed(() => {
    return duration.value - currentTime.value
  })

  /**
   * 设置音频元素引用
   */
  function setAudioElement(element: HTMLAudioElement | null) {
    // 移除旧元素的事件监听
    if (audioElement.value) {
      removeEventListeners(audioElement.value)
    }

    audioElement.value = element

    // 添加新元素的事件监听
    if (element) {
      addEventListeners(element)
      element.loop = loop
      element.volume = volume.value
    }
  }

  /**
   * 设置音频 URL
   */
  function setUrl(url: string) {
    audioUrl.value = url
    isLoaded.value = false
    error.value = null
    currentTime.value = 0
    duration.value = 0
    isPlaying.value = false
  }

  /**
   * 添加事件监听
   */
  function addEventListeners(element: HTMLAudioElement) {
    element.addEventListener('loadedmetadata', onLoadedMetadata)
    element.addEventListener('timeupdate', onTimeUpdate)
    element.addEventListener('play', onPlay)
    element.addEventListener('pause', onPause)
    element.addEventListener('ended', onEnded)
    element.addEventListener('error', onError)
    element.addEventListener('volumechange', onVolumeChange)
  }

  /**
   * 移除事件监听
   */
  function removeEventListeners(element: HTMLAudioElement) {
    element.removeEventListener('loadedmetadata', onLoadedMetadata)
    element.removeEventListener('timeupdate', onTimeUpdate)
    element.removeEventListener('play', onPlay)
    element.removeEventListener('pause', onPause)
    element.removeEventListener('ended', onEnded)
    element.removeEventListener('error', onError)
    element.removeEventListener('volumechange', onVolumeChange)
  }

  // 事件处理函数
  function onLoadedMetadata() {
    if (audioElement.value) {
      duration.value = audioElement.value.duration
      isLoaded.value = true
      if (autoPlay) {
        play()
      }
    }
  }

  function onTimeUpdate() {
    if (audioElement.value) {
      currentTime.value = audioElement.value.currentTime
    }
  }

  function onPlay() {
    isPlaying.value = true
  }

  function onPause() {
    isPlaying.value = false
  }

  function onEnded() {
    isPlaying.value = false
    if (!loop) {
      currentTime.value = 0
    }
  }

  function onError() {
    error.value = 'Failed to load audio'
    isPlaying.value = false
  }

  function onVolumeChange() {
    if (audioElement.value) {
      volume.value = audioElement.value.volume
      isMuted.value = audioElement.value.muted
    }
  }

  /**
   * 播放
   */
  async function play(): Promise<void> {
    if (audioElement.value) {
      try {
        await audioElement.value.play()
      } catch (e) {
        error.value = 'Failed to play audio'
      }
    }
  }

  /**
   * 暂停
   */
  function pause(): void {
    if (audioElement.value) {
      audioElement.value.pause()
    }
  }

  /**
   * 切换播放/暂停
   */
  function togglePlay(): void {
    if (isPlaying.value) {
      pause()
    } else {
      play()
    }
  }

  /**
   * 停止播放
   */
  function stop(): void {
    if (audioElement.value) {
      audioElement.value.pause()
      audioElement.value.currentTime = 0
    }
    isPlaying.value = false
    currentTime.value = 0
  }

  /**
   * 跳转到指定时间
   */
  function seekTo(time: number): void {
    if (audioElement.value) {
      audioElement.value.currentTime = Math.max(0, Math.min(time, duration.value))
    }
  }

  /**
   * 跳转到指定进度（百分比）
   */
  function seekToPercent(percent: number): void {
    const time = (percent / 100) * duration.value
    seekTo(time)
  }

  /**
   * 快进
   */
  function forward(seconds: number = 10): void {
    seekTo(currentTime.value + seconds)
  }

  /**
   * 快退
   */
  function backward(seconds: number = 10): void {
    seekTo(currentTime.value - seconds)
  }

  /**
   * 设置音量
   */
  function setVolume(value: number): void {
    if (audioElement.value) {
      audioElement.value.volume = Math.max(0, Math.min(1, value))
    }
    volume.value = Math.max(0, Math.min(1, value))
  }

  /**
   * 静音切换
   */
  function toggleMute(): void {
    if (audioElement.value) {
      audioElement.value.muted = !audioElement.value.muted
    }
  }

  /**
   * 格式化时间（秒 -> MM:SS 或 HH:MM:SS）
   */
  function formatTime(seconds: number, showMilliseconds = false): string {
    if (!isFinite(seconds) || seconds < 0) {
      return showMilliseconds ? '0:00.00' : '0:00'
    }

    const hours = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    const secs = Math.floor(seconds % 60)
    const ms = Math.floor((seconds % 1) * 100)

    let result = ''
    if (hours > 0) {
      result = `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    } else {
      result = `${mins}:${secs.toString().padStart(2, '0')}`
    }

    if (showMilliseconds) {
      result += `.${ms.toString().padStart(2, '0')}`
    }

    return result
  }

  // 组件卸载时清理
  onUnmounted(() => {
    if (audioElement.value) {
      removeEventListeners(audioElement.value)
    }
  })

  return {
    // 引用
    audioElement,
    audioUrl,

    // 状态
    isPlaying,
    currentTime,
    duration,
    volume,
    isMuted,
    isLoaded,
    error,

    // 计算属性
    progress,
    remainingTime,

    // 方法
    setAudioElement,
    setUrl,
    play,
    pause,
    togglePlay,
    stop,
    seekTo,
    seekToPercent,
    forward,
    backward,
    setVolume,
    toggleMute,
    formatTime
  }
}

export type UseAudioPlayerReturn = ReturnType<typeof useAudioPlayer>
