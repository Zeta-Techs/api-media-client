import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import type { HistoryItem } from '@/types'

const STORAGE_KEY = 'media_client_history'

export const useHistoryStore = defineStore('history', () => {
  // 初始化时从 localStorage 加载数据
  const items = ref<HistoryItem[]>([])

  // 当前选中要重新加载的历史记录
  const pendingReload = ref<HistoryItem | null>(null)

  // 初始化函数
  function initialize() {
    try {
      const data = localStorage.getItem(STORAGE_KEY)
      if (data) {
        const parsed = JSON.parse(data)
        if (Array.isArray(parsed)) {
          items.value = parsed
        }
      }
    } catch (e) {
      console.error('Failed to load history from localStorage:', e)
      items.value = []
    }
  }

  // 立即初始化
  initialize()

  // 监听 items 变化并保存到 localStorage
  watch(items, (newItems) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newItems))
    } catch (e) {
      console.error('Failed to save history to localStorage:', e)
    }
  }, { deep: true })

  function addItem(item: Omit<HistoryItem, 'id' | 'createdAt'>) {
    const newItem: HistoryItem = {
      ...item,
      id: crypto.randomUUID(),
      createdAt: Date.now()
    }
    items.value.unshift(newItem)
    // Keep only last 100 items
    if (items.value.length > 100) {
      items.value = items.value.slice(0, 100)
    }
  }

  function removeItem(id: string) {
    items.value = items.value.filter(item => item.id !== id)
  }

  function clearAll() {
    items.value = []
  }

  const videoItems = computed(() =>
    items.value.filter(item => item.type === 'video')
  )

  const imageItems = computed(() =>
    items.value.filter(item => item.type === 'image')
  )

  const audioItems = computed(() =>
    items.value.filter(item => item.type === 'audio')
  )

  // 设置待重新加载的历史记录
  function setPendingReload(item: HistoryItem | null) {
    pendingReload.value = item
  }

  // 清除待重新加载的历史记录
  function clearPendingReload() {
    pendingReload.value = null
  }

  // 消费待重新加载的历史记录（获取并清除）
  function consumePendingReload(): HistoryItem | null {
    const item = pendingReload.value
    pendingReload.value = null
    return item
  }

  return {
    items,
    videoItems,
    imageItems,
    audioItems,
    pendingReload,
    addItem,
    removeItem,
    clearAll,
    setPendingReload,
    clearPendingReload,
    consumePendingReload
  }
})
