/**
 * useTranslation composable
 * 提供实时字幕翻译功能，使用大语言模型 API
 */
import { ref, computed } from 'vue'

export interface TranslationConfig {
  /** 是否启用翻译 */
  enabled: boolean
  /** 翻译模型 */
  model: string
  /** 自定义模型名称 */
  customModel: string
  /** 目标语言 */
  targetLanguage: string
  /** API Base URL (可选，默认使用当前 preset) */
  baseUrl: string
  /** API Key (可选，默认使用当前 preset) */
  apiKey: string
  /** 是否使用独立配置 */
  useCustomConfig: boolean
}

export interface TranslationResult {
  original: string
  translated: string
  timestamp: Date
  isTranslating: boolean
  error?: string
}

// 翻译模型选项
export const TRANSLATION_MODELS = [
  { label: 'Gemini Flash (推荐)', value: 'gemini-2.0-flash' },
  { label: 'Gemini Flash Lite', value: 'gemini-2.0-flash-lite' },
  { label: 'GPT-4.1 Mini', value: 'gpt-4.1-mini' },
  { label: 'DeepSeek Chat', value: 'deepseek-chat' },
  { label: '自定义', value: 'custom' }
]

// 目标语言选项
export const TARGET_LANGUAGES = [
  { label: '简体中文', value: 'zh-CN' },
  { label: '繁體中文', value: 'zh-TW' },
  { label: 'English', value: 'en' },
  { label: '日本語', value: 'ja' },
  { label: '한국어', value: 'ko' },
  { label: 'Français', value: 'fr' },
  { label: 'Deutsch', value: 'de' },
  { label: 'Español', value: 'es' },
  { label: 'Italiano', value: 'it' },
  { label: 'Português', value: 'pt' },
  { label: 'Русский', value: 'ru' },
  { label: 'العربية', value: 'ar' },
  { label: 'ไทย', value: 'th' },
  { label: 'Tiếng Việt', value: 'vi' }
]

// 获取语言显示名称
export function getLanguageName(code: string): string {
  const lang = TARGET_LANGUAGES.find(l => l.value === code)
  return lang?.label || code
}

// 内置翻译 Prompt
function buildTranslationPrompt(text: string, targetLang: string): string {
  const langName = getLanguageName(targetLang)
  return `You are a professional real-time subtitle translator. Translate the following content into ${langName}.

Requirements:
1. Keep it concise, suitable for subtitle display
2. Preserve the tone and emotion
3. For technical terms, keep the original and provide translation in parentheses
4. Output only the translation result, no explanations
5. If the input is already in the target language, output it as-is
6. Maintain proper punctuation and formatting

Text to translate:
${text}`
}

export interface UseTranslationOptions {
  /** 防抖延迟（毫秒） */
  debounceMs?: number
  /** 获取当前 API 配置的函数 */
  getDefaultConfig?: () => { baseUrl: string; apiKey: string }
}

export function useTranslation(options: UseTranslationOptions = {}) {
  const { debounceMs = 300, getDefaultConfig } = options

  // 翻译配置
  const config = ref<TranslationConfig>({
    enabled: false,
    model: 'gemini-2.0-flash',
    customModel: '',
    targetLanguage: 'zh-CN',
    baseUrl: '',
    apiKey: '',
    useCustomConfig: false
  })

  // 翻译状态
  const isTranslating = ref(false)
  const lastError = ref('')
  const translationCache = ref<Map<string, string>>(new Map())

  // 防抖定时器
  let debounceTimer: ReturnType<typeof setTimeout> | null = null

  // 当前使用的模型
  const actualModel = computed(() =>
    config.value.model === 'custom' ? config.value.customModel : config.value.model
  )

  // 获取 API 配置
  function getApiConfig(): { baseUrl: string; apiKey: string } {
    if (config.value.useCustomConfig && config.value.baseUrl && config.value.apiKey) {
      return {
        baseUrl: config.value.baseUrl,
        apiKey: config.value.apiKey
      }
    }
    if (getDefaultConfig) {
      return getDefaultConfig()
    }
    return { baseUrl: '', apiKey: '' }
  }

  // 检查是否为 Gemini 模型
  function isGeminiModel(model: string): boolean {
    return model.toLowerCase().includes('gemini')
  }

  // 调用 Gemini API
  async function callGeminiApi(text: string, signal?: AbortSignal): Promise<string> {
    const { baseUrl, apiKey } = getApiConfig()
    if (!baseUrl || !apiKey) {
      throw new Error('Missing API configuration')
    }

    const model = actualModel.value
    const url = `${baseUrl.replace(/\/$/, '')}/v1beta/models/${model}:generateContent?key=${apiKey}`

    const prompt = buildTranslationPrompt(text, config.value.targetLanguage)

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 1024
        }
      }),
      signal
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`API Error: ${response.status} - ${errorText}`)
    }

    const data = await response.json()
    const result = data.candidates?.[0]?.content?.parts?.[0]?.text
    if (!result) {
      throw new Error('No translation result')
    }
    return result.trim()
  }

  // 调用 OpenAI 兼容 API
  async function callOpenAIApi(text: string, signal?: AbortSignal): Promise<string> {
    const { baseUrl, apiKey } = getApiConfig()
    if (!baseUrl || !apiKey) {
      throw new Error('Missing API configuration')
    }

    const url = `${baseUrl.replace(/\/$/, '')}/v1/chat/completions`
    const prompt = buildTranslationPrompt(text, config.value.targetLanguage)

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: actualModel.value,
        messages: [
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 1024
      }),
      signal
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`API Error: ${response.status} - ${errorText}`)
    }

    const data = await response.json()
    const result = data.choices?.[0]?.message?.content
    if (!result) {
      throw new Error('No translation result')
    }
    return result.trim()
  }

  // 执行翻译
  async function translate(text: string, signal?: AbortSignal): Promise<string> {
    if (!text.trim()) return ''

    // 检查缓存
    const cacheKey = `${text}|${config.value.targetLanguage}`
    if (translationCache.value.has(cacheKey)) {
      return translationCache.value.get(cacheKey)!
    }

    isTranslating.value = true
    lastError.value = ''

    try {
      let result: string
      if (isGeminiModel(actualModel.value)) {
        result = await callGeminiApi(text, signal)
      } else {
        result = await callOpenAIApi(text, signal)
      }

      // 缓存结果
      translationCache.value.set(cacheKey, result)

      // 限制缓存大小
      if (translationCache.value.size > 500) {
        const firstKey = translationCache.value.keys().next().value
        if (firstKey) {
          translationCache.value.delete(firstKey)
        }
      }

      return result
    } catch (e: any) {
      if (e.name !== 'AbortError') {
        lastError.value = e.message
        console.error('Translation error:', e)
      }
      throw e
    } finally {
      isTranslating.value = false
    }
  }

  // 防抖翻译
  function translateDebounced(
    text: string,
    callback: (result: string | null, error?: string) => void
  ): void {
    if (debounceTimer) {
      clearTimeout(debounceTimer)
    }

    debounceTimer = setTimeout(async () => {
      try {
        const result = await translate(text)
        callback(result)
      } catch (e: any) {
        if (e.name !== 'AbortError') {
          callback(null, e.message)
        }
      }
    }, debounceMs)
  }

  // 批量翻译（合并多条文本）
  async function translateBatch(texts: string[], signal?: AbortSignal): Promise<string[]> {
    if (texts.length === 0) return []
    if (texts.length === 1) {
      const result = await translate(texts[0], signal)
      return [result]
    }

    // 合并文本，用分隔符分开
    const separator = '\n---SPLIT---\n'
    const combined = texts.join(separator)

    const { baseUrl, apiKey } = getApiConfig()
    if (!baseUrl || !apiKey) {
      throw new Error('Missing API configuration')
    }

    const langName = getLanguageName(config.value.targetLanguage)
    const batchPrompt = `You are a professional real-time subtitle translator. Translate each of the following text segments into ${langName}.

Requirements:
1. Keep translations concise, suitable for subtitle display
2. Preserve the tone and emotion
3. Output translations in the same order, separated by "---SPLIT---"
4. Do not add any explanations or numbering

Texts to translate (separated by ---SPLIT---):
${combined}`

    isTranslating.value = true
    lastError.value = ''

    try {
      let result: string
      if (isGeminiModel(actualModel.value)) {
        const url = `${baseUrl.replace(/\/$/, '')}/v1beta/models/${actualModel.value}:generateContent?key=${apiKey}`
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: batchPrompt }] }],
            generationConfig: { temperature: 0.3, maxOutputTokens: 2048 }
          }),
          signal
        })
        if (!response.ok) throw new Error(`API Error: ${response.status}`)
        const data = await response.json()
        result = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
      } else {
        const url = `${baseUrl.replace(/\/$/, '')}/v1/chat/completions`
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: actualModel.value,
            messages: [{ role: 'user', content: batchPrompt }],
            temperature: 0.3,
            max_tokens: 2048
          }),
          signal
        })
        if (!response.ok) throw new Error(`API Error: ${response.status}`)
        const data = await response.json()
        result = data.choices?.[0]?.message?.content || ''
      }

      // 分割结果
      const translations = result.split(/---SPLIT---/i).map(t => t.trim())

      // 缓存结果
      texts.forEach((text, i) => {
        if (translations[i]) {
          const cacheKey = `${text}|${config.value.targetLanguage}`
          translationCache.value.set(cacheKey, translations[i])
        }
      })

      return translations
    } catch (e: any) {
      lastError.value = e.message
      throw e
    } finally {
      isTranslating.value = false
    }
  }

  // 清除缓存
  function clearCache() {
    translationCache.value.clear()
  }

  // 更新配置
  function updateConfig(newConfig: Partial<TranslationConfig>) {
    config.value = { ...config.value, ...newConfig }
    // 切换语言时清除缓存
    if ('targetLanguage' in newConfig) {
      clearCache()
    }
  }

  // 保存配置到 localStorage
  function saveConfig() {
    const configToSave = {
      enabled: config.value.enabled,
      model: config.value.model,
      customModel: config.value.customModel,
      targetLanguage: config.value.targetLanguage,
      useCustomConfig: config.value.useCustomConfig,
      baseUrl: config.value.baseUrl
      // 注意：不保存 apiKey
    }
    localStorage.setItem('realtime-translation-config', JSON.stringify(configToSave))
  }

  // 加载配置
  function loadConfig() {
    try {
      const saved = localStorage.getItem('realtime-translation-config')
      if (saved) {
        const parsed = JSON.parse(saved)
        config.value = { ...config.value, ...parsed }
      }
    } catch (e) {
      console.warn('Failed to load translation config:', e)
    }
  }

  return {
    // 配置
    config,
    actualModel,

    // 状态
    isTranslating,
    lastError,
    translationCache,

    // 方法
    translate,
    translateDebounced,
    translateBatch,
    clearCache,
    updateConfig,
    saveConfig,
    loadConfig,
    getApiConfig
  }
}

export type UseTranslationReturn = ReturnType<typeof useTranslation>
