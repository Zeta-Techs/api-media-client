/**
 * useFormPersist composable
 * 提供表单状态的 localStorage 持久化功能
 */
import { ref, watch, onMounted, type Ref } from 'vue'

export interface UseFormPersistOptions<T> {
  /** 要排除的字段（不持久化） */
  exclude?: (keyof T)[]
  /** 防抖延迟（毫秒） */
  debounce?: number
  /** 是否深度监听 */
  deep?: boolean
}

/**
 * 创建带持久化功能的表单状态
 * @param key localStorage 键名
 * @param initialValue 初始值
 * @param options 配置选项
 */
export function useFormPersist<T extends object>(
  key: string,
  initialValue: T,
  options: UseFormPersistOptions<T> = {}
): Ref<T> {
  const { exclude = [], debounce = 500, deep = true } = options

  const form = ref<T>({ ...initialValue }) as Ref<T>

  // 防抖定时器
  let saveTimer: ReturnType<typeof setTimeout> | null = null

  /**
   * 从 localStorage 加载数据
   */
  function load(): void {
    try {
      const saved = localStorage.getItem(key)
      if (saved) {
        const parsed = JSON.parse(saved)
        // 合并保存的数据和初始值（确保新增字段有默认值）
        form.value = { ...initialValue, ...parsed }
      }
    } catch (e) {
      console.warn(`[useFormPersist] Failed to load "${key}":`, e)
    }
  }

  /**
   * 保存数据到 localStorage
   */
  function save(): void {
    try {
      // 过滤排除的字段
      const dataToSave = { ...form.value }
      for (const field of exclude) {
        delete dataToSave[field]
      }
      localStorage.setItem(key, JSON.stringify(dataToSave))
    } catch (e) {
      console.warn(`[useFormPersist] Failed to save "${key}":`, e)
    }
  }

  /**
   * 防抖保存
   */
  function debouncedSave(): void {
    if (saveTimer) {
      clearTimeout(saveTimer)
    }
    saveTimer = setTimeout(() => {
      save()
      saveTimer = null
    }, debounce)
  }

  // 监听变化并保存
  watch(
    form,
    () => {
      debouncedSave()
    },
    { deep }
  )

  // 组件挂载时加载数据
  onMounted(() => {
    load()
  })

  return form
}

/**
 * 简化版：只返回表单 ref，不提供额外方法
 * 适用于简单场景
 */
export function useSimpleFormPersist<T extends object>(
  key: string,
  initialValue: T,
  excludeFields?: (keyof T)[]
): Ref<T> {
  return useFormPersist(key, initialValue, { exclude: excludeFields })
}

export type UseFormPersistReturn<T> = Ref<T>
