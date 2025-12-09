import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import type { ProviderPreset, PromptTemplate } from '@/types'

// Generate unique ID
function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2)
}

// Default provider presets
const defaultPresets: ProviderPreset[] = [
  {
    id: 'default-zeta',
    name: 'Zeta API',
    baseUrl: 'https://api.zetatechs.com',
    apiKey: '',
    createdAt: Date.now()
  },
  {
    id: 'default-ent',
    name: 'Zeta Enterprise',
    baseUrl: 'https://ent.zetatechs.com',
    apiKey: '',
    createdAt: Date.now()
  }
]

export const useConfigStore = defineStore('config', () => {
  // Theme
  const theme = ref<'dark' | 'light'>(
    (localStorage.getItem('theme') as 'dark' | 'light') || 'dark'
  )

  function toggleTheme() {
    theme.value = theme.value === 'dark' ? 'light' : 'dark'
    localStorage.setItem('theme', theme.value)
  }

  // Provider Presets
  const providerPresets = ref<ProviderPreset[]>(
    JSON.parse(localStorage.getItem('providerPresets') || 'null') || defaultPresets
  )

  const activePresetId = ref<string>(
    localStorage.getItem('activePresetId') || 'default-zeta'
  )

  // Current active preset
  const activePreset = computed(() => {
    return providerPresets.value.find(p => p.id === activePresetId.value) || providerPresets.value[0]
  })

  // Convenience getters for current API config
  const baseUrl = computed(() => activePreset.value?.baseUrl || 'https://api.zetatechs.com')
  const apiKey = computed({
    get: () => activePreset.value?.apiKey || '',
    set: (val: string) => {
      const preset = providerPresets.value.find(p => p.id === activePresetId.value)
      if (preset) {
        preset.apiKey = val
        savePresets()
      }
    }
  })

  // Preset management functions
  function addPreset(preset: Omit<ProviderPreset, 'id' | 'createdAt'>) {
    const newPreset: ProviderPreset = {
      ...preset,
      id: generateId(),
      createdAt: Date.now()
    }
    providerPresets.value.push(newPreset)
    savePresets()
    return newPreset
  }

  function updatePreset(id: string, updates: Partial<Omit<ProviderPreset, 'id' | 'createdAt'>>) {
    const index = providerPresets.value.findIndex(p => p.id === id)
    if (index !== -1) {
      providerPresets.value[index] = { ...providerPresets.value[index], ...updates }
      savePresets()
    }
  }

  function deletePreset(id: string) {
    // Don't allow deleting if it's the only preset
    if (providerPresets.value.length <= 1) return false

    const index = providerPresets.value.findIndex(p => p.id === id)
    if (index !== -1) {
      providerPresets.value.splice(index, 1)
      // If deleted preset was active, switch to first available
      if (activePresetId.value === id) {
        activePresetId.value = providerPresets.value[0].id
      }
      savePresets()
      return true
    }
    return false
  }

  function setActivePreset(id: string) {
    if (providerPresets.value.some(p => p.id === id)) {
      activePresetId.value = id
      localStorage.setItem('activePresetId', id)
    }
  }

  function savePresets() {
    localStorage.setItem('providerPresets', JSON.stringify(providerPresets.value))
  }

  // Prompt Templates
  const promptTemplates = ref<PromptTemplate[]>(
    JSON.parse(localStorage.getItem('promptTemplates') || '[]')
  )

  function addPromptTemplate(template: Omit<PromptTemplate, 'id' | 'createdAt'>) {
    const newTemplate: PromptTemplate = {
      ...template,
      id: generateId(),
      createdAt: Date.now()
    }
    promptTemplates.value.push(newTemplate)
    saveTemplates()
    return newTemplate
  }

  function updatePromptTemplate(id: string, updates: Partial<Omit<PromptTemplate, 'id' | 'createdAt'>>) {
    const index = promptTemplates.value.findIndex(t => t.id === id)
    if (index !== -1) {
      promptTemplates.value[index] = { ...promptTemplates.value[index], ...updates }
      saveTemplates()
    }
  }

  function deletePromptTemplate(id: string) {
    const index = promptTemplates.value.findIndex(t => t.id === id)
    if (index !== -1) {
      promptTemplates.value.splice(index, 1)
      saveTemplates()
      return true
    }
    return false
  }

  function saveTemplates() {
    localStorage.setItem('promptTemplates', JSON.stringify(promptTemplates.value))
  }

  // Video prompt templates
  const videoTemplates = computed(() =>
    promptTemplates.value.filter(t => t.type === 'video' || t.type === 'both')
  )

  // Image prompt templates
  const imageTemplates = computed(() =>
    promptTemplates.value.filter(t => t.type === 'image' || t.type === 'both')
  )

  // Audio prompt templates
  const audioTemplates = computed(() =>
    promptTemplates.value.filter(t => t.type === 'audio' || t.type === 'both')
  )

  // Export/Import settings
  function exportSettings(): string {
    return JSON.stringify({
      theme: theme.value,
      providerPresets: providerPresets.value,
      activePresetId: activePresetId.value,
      promptTemplates: promptTemplates.value
    }, null, 2)
  }

  function importSettings(jsonStr: string): boolean {
    try {
      const data = JSON.parse(jsonStr)
      if (data.theme) theme.value = data.theme
      if (data.providerPresets) providerPresets.value = data.providerPresets
      if (data.activePresetId) activePresetId.value = data.activePresetId
      if (data.promptTemplates) promptTemplates.value = data.promptTemplates

      localStorage.setItem('theme', theme.value)
      savePresets()
      saveTemplates()
      localStorage.setItem('activePresetId', activePresetId.value)
      return true
    } catch {
      return false
    }
  }

  // Watch for changes and persist
  watch(activePresetId, (val) => localStorage.setItem('activePresetId', val))

  return {
    // Theme
    theme,
    toggleTheme,

    // Provider Presets
    providerPresets,
    activePresetId,
    activePreset,
    baseUrl,
    apiKey,
    addPreset,
    updatePreset,
    deletePreset,
    setActivePreset,

    // Prompt Templates
    promptTemplates,
    videoTemplates,
    imageTemplates,
    audioTemplates,
    addPromptTemplate,
    updatePromptTemplate,
    deletePromptTemplate,

    // Import/Export
    exportSettings,
    importSettings
  }
})
