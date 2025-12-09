<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  NButton, NSpace, NSelect, NSwitch, NSlider, NDrawer, NDrawerContent,
  NForm, NFormItem, NInput, NTag, NTooltip
} from 'naive-ui'
import {
  CloseOutline,
  SettingsOutline,
  ExpandOutline,
  ContractOutline
} from '@vicons/ionicons5'
import { useTranslation, TRANSLATION_MODELS, TARGET_LANGUAGES } from '@/composables/useTranslation'
import { useConfigStore } from '@/stores/config'

interface SubtitleItem {
  text: string
  translated?: string
  timestamp: Date
  isFinal: boolean
  isTranslating?: boolean
}

interface Props {
  /** 是否显示 */
  show: boolean
  /** 字幕列表 */
  subtitles: SubtitleItem[]
  /** 当前正在输入的字幕（部分） */
  currentText?: string
  /** 是否连接中 */
  isConnected?: boolean
  /** 是否正在录音 */
  isRecording?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  currentText: '',
  isConnected: false,
  isRecording: false
})

const emit = defineEmits<{
  (e: 'update:show', value: boolean): void
  (e: 'update:subtitles', value: SubtitleItem[]): void
}>()

const { t } = useI18n()
const configStore = useConfigStore()

// 翻译功能
const {
  config: translationConfig,
  isTranslating,
  lastError: translationError,
  translate,
  updateConfig,
  saveConfig,
  loadConfig
} = useTranslation({
  debounceMs: 500,
  getDefaultConfig: () => ({
    baseUrl: configStore.baseUrl,
    apiKey: configStore.apiKey
  })
})

// 显示设置
const displaySettings = ref({
  fontSize: 'large' as 'small' | 'medium' | 'large' | 'xlarge',
  position: 'bottom' as 'top' | 'center' | 'bottom',
  backgroundOpacity: 0.85,
  bilingualMode: 'both' as 'original' | 'translated' | 'both',
  originalOnTop: true
})

// UI 状态
const showSettings = ref(false)
const showToolbar = ref(true)
const toolbarTimer = ref<ReturnType<typeof setTimeout> | null>(null)
const containerRef = ref<HTMLElement | null>(null)
const isFullscreen = ref(false)

// Wake Lock
let wakeLock: WakeLockSentinel | null = null

// 字体大小映射
const fontSizeMap = {
  small: { main: '18px', sub: '14px', lineHeight: '1.6' },
  medium: { main: '24px', sub: '18px', lineHeight: '1.6' },
  large: { main: '32px', sub: '24px', lineHeight: '1.5' },
  xlarge: { main: '42px', sub: '32px', lineHeight: '1.4' }
}

const currentFontSize = computed(() => fontSizeMap[displaySettings.value.fontSize])

// 字体大小选项
const fontSizeOptions = [
  { label: t('realtime.fullscreen.fontSmall'), value: 'small' },
  { label: t('realtime.fullscreen.fontMedium'), value: 'medium' },
  { label: t('realtime.fullscreen.fontLarge'), value: 'large' },
  { label: t('realtime.fullscreen.fontXLarge'), value: 'xlarge' }
]

// 位置选项
const positionOptions = [
  { label: t('realtime.fullscreen.posTop'), value: 'top' },
  { label: t('realtime.fullscreen.posCenter'), value: 'center' },
  { label: t('realtime.fullscreen.posBottom'), value: 'bottom' }
]

// 双语模式选项
const bilingualModeOptions = [
  { label: t('realtime.fullscreen.showBoth'), value: 'both' },
  { label: t('realtime.fullscreen.showOriginal'), value: 'original' },
  { label: t('realtime.fullscreen.showTranslated'), value: 'translated' }
]

// 监听字幕变化，自动翻译
watch(() => props.subtitles, async (newSubtitles) => {
  if (!translationConfig.value.enabled) return

  // 找出需要翻译的字幕
  for (let i = 0; i < newSubtitles.length; i++) {
    const item = newSubtitles[i]
    if (item.isFinal && !item.translated && !item.isTranslating && item.text) {
      // 标记为正在翻译
      const updatedSubtitles = [...newSubtitles]
      updatedSubtitles[i] = { ...item, isTranslating: true }
      emit('update:subtitles', updatedSubtitles)

      try {
        const translated = await translate(item.text)
        // 更新翻译结果
        const finalSubtitles = [...props.subtitles]
        const targetIndex = finalSubtitles.findIndex(s =>
          s.timestamp.getTime() === item.timestamp.getTime() && s.text === item.text
        )
        if (targetIndex !== -1) {
          finalSubtitles[targetIndex] = {
            ...finalSubtitles[targetIndex],
            translated,
            isTranslating: false
          }
          emit('update:subtitles', finalSubtitles)
        }
      } catch (e) {
        // 翻译失败，移除翻译中状态
        const finalSubtitles = [...props.subtitles]
        const targetIndex = finalSubtitles.findIndex(s =>
          s.timestamp.getTime() === item.timestamp.getTime() && s.text === item.text
        )
        if (targetIndex !== -1) {
          finalSubtitles[targetIndex] = {
            ...finalSubtitles[targetIndex],
            isTranslating: false
          }
          emit('update:subtitles', finalSubtitles)
        }
      }
    }
  }
}, { deep: true })

// 自动滚动到底部
watch(() => props.subtitles.length, () => {
  nextTick(() => {
    if (containerRef.value) {
      containerRef.value.scrollTop = containerRef.value.scrollHeight
    }
  })
})

// 自动隐藏工具栏
function resetToolbarTimer() {
  showToolbar.value = true
  if (toolbarTimer.value) {
    clearTimeout(toolbarTimer.value)
  }
  toolbarTimer.value = setTimeout(() => {
    showToolbar.value = false
  }, 3000)
}

function handleMouseMove() {
  resetToolbarTimer()
}

function handleTouchStart() {
  resetToolbarTimer()
}

// 阻止触摸移动事件传播到背景页面
function handleTouchMove(e: TouchEvent) {
  // 仅当触摸事件发生在字幕容器外时阻止默认行为
  const target = e.target as HTMLElement
  const container = containerRef.value
  if (container && !container.contains(target)) {
    e.preventDefault()
  }
}

// 切换全屏
async function toggleFullscreen() {
  if (!document.fullscreenElement) {
    try {
      await document.documentElement.requestFullscreen()
      isFullscreen.value = true
    } catch (e) {
      console.error('Fullscreen error:', e)
    }
  } else {
    await document.exitFullscreen()
    isFullscreen.value = false
  }
}

// 请求屏幕常亮
async function requestWakeLock() {
  if ('wakeLock' in navigator) {
    try {
      wakeLock = await navigator.wakeLock.request('screen')
      wakeLock.addEventListener('release', () => {
        wakeLock = null
      })
    } catch (e) {
      console.warn('Wake Lock error:', e)
    }
  }
}

// 释放屏幕常亮
function releaseWakeLock() {
  if (wakeLock) {
    wakeLock.release()
    wakeLock = null
  }
}

// 退出全屏字幕
function handleClose() {
  releaseWakeLock()
  if (document.fullscreenElement) {
    document.exitFullscreen()
  }
  emit('update:show', false)
}

// 保存显示设置
function saveDisplaySettings() {
  localStorage.setItem('fullscreen-subtitle-settings', JSON.stringify(displaySettings.value))
}

// 加载显示设置
function loadDisplaySettings() {
  try {
    const saved = localStorage.getItem('fullscreen-subtitle-settings')
    if (saved) {
      displaySettings.value = { ...displaySettings.value, ...JSON.parse(saved) }
    }
  } catch (e) {
    console.warn('Failed to load display settings:', e)
  }
}

// 监听显示设置变化并保存
watch(displaySettings, () => {
  saveDisplaySettings()
}, { deep: true })

// 监听翻译配置变化并保存
watch(translationConfig, () => {
  saveConfig()
}, { deep: true })

// 监听全屏变化
function handleFullscreenChange() {
  isFullscreen.value = !!document.fullscreenElement
}

// 锁定 body 滚动
function lockBodyScroll() {
  document.body.style.overflow = 'hidden'
  document.body.style.position = 'fixed'
  document.body.style.width = '100%'
  document.body.style.top = `-${window.scrollY}px`
}

// 解锁 body 滚动
function unlockBodyScroll() {
  const scrollY = document.body.style.top
  document.body.style.overflow = ''
  document.body.style.position = ''
  document.body.style.width = ''
  document.body.style.top = ''
  window.scrollTo(0, parseInt(scrollY || '0') * -1)
}

// 监听 show 状态变化，锁定/解锁滚动
watch(() => props.show, (newShow) => {
  if (newShow) {
    lockBodyScroll()
  } else {
    unlockBodyScroll()
  }
}, { immediate: true })

onMounted(() => {
  loadDisplaySettings()
  loadConfig()
  requestWakeLock()
  resetToolbarTimer()
  document.addEventListener('fullscreenchange', handleFullscreenChange)
  // 如果组件挂载时已经显示，锁定滚动
  if (props.show) {
    lockBodyScroll()
  }
})

onUnmounted(() => {
  releaseWakeLock()
  if (toolbarTimer.value) {
    clearTimeout(toolbarTimer.value)
  }
  document.removeEventListener('fullscreenchange', handleFullscreenChange)
  // 组件卸载时解锁滚动
  unlockBodyScroll()
})

// 获取最近的字幕（用于大字显示）
const recentSubtitles = computed(() => {
  const all = [...props.subtitles]
  // 取最后 5 条
  return all.slice(-5)
})

// 当前显示的主字幕
const currentSubtitle = computed(() => {
  if (props.currentText) {
    return { text: props.currentText, isPartial: true }
  }
  const last = props.subtitles[props.subtitles.length - 1]
  if (last) {
    return { text: last.text, translated: last.translated, isPartial: false, isTranslating: last.isTranslating }
  }
  return null
})
</script>

<template>
  <Teleport to="body">
    <Transition name="fullscreen-fade">
      <div
        v-if="show"
        class="fullscreen-subtitle"
        :class="{ 'toolbar-hidden': !showToolbar }"
        @mousemove="handleMouseMove"
        @touchstart="handleTouchStart"
        @touchmove.prevent="handleTouchMove"
        @click="resetToolbarTimer"
      >
        <!-- 背景 -->
        <div
          class="subtitle-background"
          :style="{ opacity: displaySettings.backgroundOpacity }"
        />

        <!-- 工具栏 -->
        <Transition name="toolbar-fade">
          <div v-show="showToolbar" class="toolbar">
            <NSpace align="center">
              <!-- 连接状态 -->
              <div class="status-indicator">
                <span
                  class="status-dot"
                  :class="{
                    connected: isConnected,
                    recording: isRecording
                  }"
                />
                <span class="status-text">
                  {{ isConnected ? (isRecording ? t('realtime.listening') : t('realtime.connected')) : t('realtime.disconnected') }}
                </span>
              </div>

              <!-- 翻译状态 -->
              <NTag v-if="translationConfig.enabled" size="small" :type="isTranslating ? 'warning' : 'success'">
                {{ isTranslating ? t('realtime.fullscreen.translating') : t('realtime.fullscreen.translationOn') }}
              </NTag>
            </NSpace>

            <NSpace align="center" :size="8">
              <!-- 全屏切换 -->
              <NTooltip>
                <template #trigger>
                  <NButton quaternary circle size="small" @click="toggleFullscreen">
                    <template #icon>
                      <ContractOutline v-if="isFullscreen" />
                      <ExpandOutline v-else />
                    </template>
                  </NButton>
                </template>
                {{ isFullscreen ? t('realtime.fullscreen.exitFullscreen') : t('realtime.fullscreen.enterFullscreen') }}
              </NTooltip>

              <!-- 设置 -->
              <NTooltip>
                <template #trigger>
                  <NButton quaternary circle size="small" @click="showSettings = true">
                    <template #icon>
                      <SettingsOutline />
                    </template>
                  </NButton>
                </template>
                {{ t('nav.settings') }}
              </NTooltip>

              <!-- 关闭 -->
              <NTooltip>
                <template #trigger>
                  <NButton quaternary circle size="small" @click="handleClose">
                    <template #icon>
                      <CloseOutline />
                    </template>
                  </NButton>
                </template>
                {{ t('common.cancel') }}
              </NTooltip>
            </NSpace>
          </div>
        </Transition>

        <!-- 字幕显示区域 -->
        <div
          ref="containerRef"
          class="subtitle-container"
          :class="[`position-${displaySettings.position}`]"
        >
          <div v-if="!currentSubtitle && subtitles.length === 0" class="placeholder">
            <div class="placeholder-icon">📝</div>
            <div class="placeholder-text">{{ t('realtime.waitingForTranscription') }}</div>
          </div>

          <div v-else class="subtitle-content">
            <!-- 历史字幕（较小） -->
            <div class="history-subtitles">
              <div
                v-for="(item, idx) in recentSubtitles.slice(0, -1)"
                :key="idx"
                class="history-item"
                :style="{ fontSize: currentFontSize.sub }"
              >
                <template v-if="displaySettings.bilingualMode !== 'translated' || !item.translated">
                  <span class="original-text">{{ item.text }}</span>
                </template>
                <template v-if="translationConfig.enabled && item.translated && displaySettings.bilingualMode !== 'original'">
                  <span class="translated-text">{{ item.translated }}</span>
                </template>
              </div>
            </div>

            <!-- 当前字幕（大字） -->
            <div
              v-if="currentSubtitle"
              class="current-subtitle"
              :style="{
                fontSize: currentFontSize.main,
                lineHeight: currentFontSize.lineHeight
              }"
            >
              <!-- 原文 -->
              <div
                v-if="displaySettings.bilingualMode !== 'translated' || !currentSubtitle.translated"
                class="main-text"
                :class="{
                  partial: currentSubtitle.isPartial,
                  'order-1': !displaySettings.originalOnTop && currentSubtitle.translated
                }"
              >
                {{ currentSubtitle.text }}
                <span v-if="currentSubtitle.isPartial" class="typing-cursor">|</span>
              </div>

              <!-- 译文 -->
              <div
                v-if="translationConfig.enabled && displaySettings.bilingualMode !== 'original'"
                class="translated-main"
                :class="{ 'order-0': !displaySettings.originalOnTop }"
                :style="{ fontSize: currentFontSize.sub }"
              >
                <template v-if="currentSubtitle.translated">
                  {{ currentSubtitle.translated }}
                </template>
                <template v-else-if="currentSubtitle.isTranslating">
                  <span class="translating-indicator">{{ t('realtime.fullscreen.translating') }}...</span>
                </template>
              </div>
            </div>
          </div>
        </div>

        <!-- 底部状态栏 -->
        <Transition name="toolbar-fade">
          <div v-show="showToolbar" class="bottom-bar">
            <NSpace align="center" justify="center" :size="16">
              <span v-if="translationConfig.enabled" class="info-tag">
                {{ t('realtime.fullscreen.model') }}: {{ translationConfig.model === 'custom' ? translationConfig.customModel : translationConfig.model }}
              </span>
              <span v-if="translationConfig.enabled" class="info-tag">
                {{ t('realtime.fullscreen.targetLang') }}: {{ TARGET_LANGUAGES.find(l => l.value === translationConfig.targetLanguage)?.label }}
              </span>
              <span class="info-tag">
                {{ t('realtime.fullscreen.subtitleCount') }}: {{ subtitles.length }}
              </span>
            </NSpace>
          </div>
        </Transition>

        <!-- 设置抽屉 -->
        <NDrawer v-model:show="showSettings" placement="right" :width="320" :z-index="10001">
          <NDrawerContent :title="t('realtime.fullscreen.settings')">
            <NForm label-placement="top" size="small">
              <!-- 显示设置 -->
              <div class="settings-section">
                <div class="section-title">{{ t('realtime.fullscreen.displaySettings') }}</div>

                <NFormItem :label="t('realtime.fullscreen.fontSize')">
                  <NSelect
                    v-model:value="displaySettings.fontSize"
                    :options="fontSizeOptions"
                  />
                </NFormItem>

                <NFormItem :label="t('realtime.fullscreen.position')">
                  <NSelect
                    v-model:value="displaySettings.position"
                    :options="positionOptions"
                  />
                </NFormItem>

                <NFormItem :label="t('realtime.fullscreen.bgOpacity')">
                  <NSlider
                    v-model:value="displaySettings.backgroundOpacity"
                    :min="0.5"
                    :max="1"
                    :step="0.05"
                  />
                </NFormItem>
              </div>

              <!-- 翻译设置 -->
              <div class="settings-section">
                <div class="section-title">{{ t('realtime.fullscreen.translationSettings') }}</div>

                <NFormItem :label="t('realtime.fullscreen.enableTranslation')">
                  <NSwitch v-model:value="translationConfig.enabled" />
                </NFormItem>

                <template v-if="translationConfig.enabled">
                  <NFormItem :label="t('realtime.fullscreen.targetLanguage')">
                    <NSelect
                      :value="translationConfig.targetLanguage"
                      :options="TARGET_LANGUAGES"
                      @update:value="(v: string) => updateConfig({ targetLanguage: v })"
                    />
                  </NFormItem>

                  <NFormItem :label="t('realtime.fullscreen.translationModel')">
                    <NSelect
                      :value="translationConfig.model"
                      :options="TRANSLATION_MODELS"
                      @update:value="(v: string) => updateConfig({ model: v })"
                    />
                  </NFormItem>

                  <NFormItem v-if="translationConfig.model === 'custom'" :label="t('common.custom')">
                    <NInput
                      :value="translationConfig.customModel"
                      :placeholder="t('common.model')"
                      @update:value="(v: string) => updateConfig({ customModel: v })"
                    />
                  </NFormItem>

                  <NFormItem :label="t('realtime.fullscreen.bilingualMode')">
                    <NSelect
                      v-model:value="displaySettings.bilingualMode"
                      :options="bilingualModeOptions"
                    />
                  </NFormItem>

                  <NFormItem v-if="displaySettings.bilingualMode === 'both'" :label="t('realtime.fullscreen.originalOnTop')">
                    <NSwitch v-model:value="displaySettings.originalOnTop" />
                  </NFormItem>

                  <!-- 独立 API 配置 -->
                  <NFormItem :label="t('realtime.fullscreen.useCustomApi')">
                    <NSwitch
                      :value="translationConfig.useCustomConfig"
                      @update:value="(v: boolean) => updateConfig({ useCustomConfig: v })"
                    />
                  </NFormItem>

                  <template v-if="translationConfig.useCustomConfig">
                    <NFormItem :label="t('common.baseUrl')">
                      <NInput
                        :value="translationConfig.baseUrl"
                        placeholder="https://api.example.com"
                        @update:value="(v: string) => updateConfig({ baseUrl: v })"
                      />
                    </NFormItem>
                    <NFormItem :label="t('common.apiKey')">
                      <NInput
                        :value="translationConfig.apiKey"
                        type="password"
                        show-password-on="click"
                        :placeholder="t('common.placeholder.apiKey')"
                        @update:value="(v: string) => updateConfig({ apiKey: v })"
                      />
                    </NFormItem>
                  </template>

                  <!-- 翻译错误提示 -->
                  <div v-if="translationError" class="translation-error">
                    {{ translationError }}
                  </div>
                </template>
              </div>
            </NForm>
          </NDrawerContent>
        </NDrawer>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.fullscreen-subtitle {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  color: #fff;
  user-select: none;
  cursor: default;
}

.subtitle-background {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(180deg, #0a0a1a 0%, #1a1a2e 50%, #0f0f1f 100%);
  z-index: 0;
}

/* 工具栏 */
.toolbar {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  padding: 12px 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: linear-gradient(180deg, rgba(0, 0, 0, 0.6) 0%, transparent 100%);
  z-index: 100;
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #6b7280;
}

.status-dot.connected {
  background: #10b981;
}

.status-dot.recording {
  background: #ef4444;
  animation: pulse 1s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.6; transform: scale(1.2); }
}

.status-text {
  font-size: 14px;
  opacity: 0.9;
}

/* 字幕容器 */
.subtitle-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 80px 40px 60px;
  overflow-y: auto;
  position: relative;
  z-index: 1;
  -webkit-overflow-scrolling: touch; /* 提升移动端滚动体验 */
  overscroll-behavior: contain; /* 防止滚动穿透 */
}

.subtitle-container.position-top {
  justify-content: flex-start;
}

.subtitle-container.position-center {
  justify-content: center;
}

.subtitle-container.position-bottom {
  justify-content: flex-end;
}

.placeholder {
  text-align: center;
  opacity: 0.5;
}

.placeholder-icon {
  font-size: 64px;
  margin-bottom: 16px;
}

.placeholder-text {
  font-size: 20px;
}

.subtitle-content {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

/* 历史字幕 */
.history-subtitles {
  display: flex;
  flex-direction: column;
  gap: 12px;
  opacity: 0.6;
}

.history-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  text-align: center;
}

.original-text {
  color: #e2e8f0;
}

.translated-text {
  color: #a78bfa;
  font-style: italic;
}

/* 当前字幕 */
.current-subtitle {
  display: flex;
  flex-direction: column;
  gap: 16px;
  text-align: center;
}

.main-text {
  color: #fff;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
  word-break: break-word;
}

.main-text.partial {
  color: rgba(255, 255, 255, 0.8);
}

.translated-main {
  color: #c4b5fd;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
}

.translating-indicator {
  color: #fbbf24;
  animation: blink 1s infinite;
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.typing-cursor {
  color: #7c3aed;
  animation: cursor-blink 1s infinite;
}

@keyframes cursor-blink {
  0%, 50% { opacity: 1; }
  51%, 100% { opacity: 0; }
}

.order-0 {
  order: 0;
}

.order-1 {
  order: 1;
}

/* 底部状态栏 */
.bottom-bar {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 12px 20px;
  background: linear-gradient(0deg, rgba(0, 0, 0, 0.6) 0%, transparent 100%);
  text-align: center;
  z-index: 100;
}

.info-tag {
  font-size: 12px;
  opacity: 0.7;
  background: rgba(255, 255, 255, 0.1);
  padding: 4px 12px;
  border-radius: 12px;
}

/* 设置部分 */
.settings-section {
  margin-bottom: 24px;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.translation-error {
  color: #f87171;
  font-size: 12px;
  padding: 8px 12px;
  background: rgba(248, 113, 113, 0.1);
  border-radius: 8px;
  margin-top: 8px;
}

/* 过渡动画 */
.fullscreen-fade-enter-active,
.fullscreen-fade-leave-active {
  transition: opacity 0.3s ease;
}

.fullscreen-fade-enter-from,
.fullscreen-fade-leave-to {
  opacity: 0;
}

.toolbar-fade-enter-active,
.toolbar-fade-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}

.toolbar-fade-enter-from,
.toolbar-fade-leave-to {
  opacity: 0;
}

.toolbar-fade-enter-from .toolbar {
  transform: translateY(-20px);
}

.toolbar-fade-leave-to .toolbar {
  transform: translateY(-20px);
}

/* 移动端适配 */
@media (max-width: 768px) {
  .toolbar {
    padding: 8px 12px;
  }

  .subtitle-container {
    padding: 60px 20px 50px;
  }

  .status-text {
    display: none;
  }
}

/* 横屏模式 */
@media (orientation: landscape) and (max-height: 500px) {
  .subtitle-container {
    padding: 50px 60px 40px;
  }

  .history-subtitles {
    display: none;
  }
}
</style>
