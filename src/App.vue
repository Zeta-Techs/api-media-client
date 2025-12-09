<script setup lang="ts">
import { computed, watch, h, ref, onMounted, onUnmounted } from 'vue'
import { RouterView, useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import {
  NConfigProvider,
  NMessageProvider,
  NLayout,
  NLayoutHeader,
  NLayoutContent,
  NMenu,
  NSpace,
  NButton,
  NDropdown,
  NPopover,
  NList,
  NListItem,
  NDrawer,
  NDrawerContent,
  darkTheme,
  type GlobalThemeOverrides,
  zhCN,
  enUS,
  dateZhCN,
  dateEnUS
} from 'naive-ui'
import {
  VideocamOutline,
  ImageOutline,
  MicOutline,
  VolumeHighOutline,
  RadioOutline,
  ShieldOutline,
  TimeOutline,
  SunnyOutline,
  MoonOutline,
  LanguageOutline,
  SettingsOutline,
  CheckmarkOutline,
  MenuOutline
} from '@vicons/ionicons5'
import { useConfigStore } from './stores/config'

const route = useRoute()
const router = useRouter()
const { t, locale } = useI18n()
const configStore = useConfigStore()

// Settings popover state
const showSettingsPopover = ref(false)

// Mobile menu state
const showMobileMenu = ref(false)
const isMobile = ref(false)

// Check if mobile viewport
function checkMobile() {
  isMobile.value = window.innerWidth < 768
}

onMounted(() => {
  checkMobile()
  window.addEventListener('resize', checkMobile)
})

onUnmounted(() => {
  window.removeEventListener('resize', checkMobile)
})

// Theme configuration
const isDark = computed(() => configStore.theme === 'dark')

// Naive UI locale
const naiveLocale = computed(() => locale.value === 'zh-CN' ? zhCN : enUS)
const naiveDateLocale = computed(() => locale.value === 'zh-CN' ? dateZhCN : dateEnUS)

const themeOverrides = computed<GlobalThemeOverrides>(() => ({
  common: {
    primaryColor: isDark.value ? '#7c3aed' : '#6366f1',
    primaryColorHover: isDark.value ? '#8b5cf6' : '#818cf8',
    primaryColorPressed: isDark.value ? '#6d28d9' : '#4f46e5',
    borderRadius: '12px',
    fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'
  },
  Card: {
    borderRadius: '16px'
  },
  Button: {
    borderRadiusMedium: '10px'
  },
  Input: {
    borderRadius: '10px'
  },
  Select: {
    borderRadius: '10px'
  }
}))

// Navigation menu - 新顺序：图片、视频、音频转文字、实时语音、文字转语音、内容审核、历史记录、设置
const menuOptions = computed(() => [
  {
    label: t('nav.image'),
    key: 'image',
    icon: () => h(ImageOutline)
  },
  {
    label: t('nav.video'),
    key: 'video',
    icon: () => h(VideocamOutline)
  },
  {
    label: t('nav.audio'),
    key: 'audio',
    icon: () => h(MicOutline)
  },
  {
    label: t('nav.realtime'),
    key: 'realtime',
    icon: () => h(RadioOutline)
  },
  {
    label: t('nav.tts'),
    key: 'tts',
    icon: () => h(VolumeHighOutline)
  },
  {
    label: t('nav.moderation'),
    key: 'moderation',
    icon: () => h(ShieldOutline)
  },
  {
    label: t('nav.history'),
    key: 'history',
    icon: () => h(TimeOutline)
  }
])

const activeKey = computed(() => route.name as string)

function handleMenuUpdate(key: string) {
  router.push({ name: key })
  showMobileMenu.value = false
}

// Language dropdown
const languageOptions = [
  { label: '简体中文', key: 'zh-CN' },
  { label: 'English', key: 'en-US' }
]

function handleLanguageSelect(key: string) {
  locale.value = key
  localStorage.setItem('locale', key)
}

function toggleTheme() {
  configStore.toggleTheme()
}

// Settings popover handlers
function handlePresetSelect(presetId: string) {
  configStore.setActivePreset(presetId)
  showSettingsPopover.value = false
}

function goToSettings() {
  router.push({ name: 'settings' })
  showSettingsPopover.value = false
}

// Apply theme class to body
watch(isDark, (dark) => {
  document.body.classList.toggle('dark', dark)
  document.body.classList.toggle('light', !dark)
}, { immediate: true })

</script>

<template>
  <NConfigProvider
    :theme="isDark ? darkTheme : null"
    :theme-overrides="themeOverrides"
    :locale="naiveLocale"
    :date-locale="naiveDateLocale"
  >
    <NMessageProvider>
      <div class="app-container" :class="{ dark: isDark }">
      <!-- Background gradient -->
      <div class="app-background"></div>

      <NLayout class="app-layout">
        <!-- Header -->
        <NLayoutHeader class="app-header glass-nav" bordered>
          <div class="header-content">
            <!-- Mobile menu button -->
            <NButton v-if="isMobile" quaternary circle class="mobile-menu-btn" @click="showMobileMenu = true">
              <template #icon>
                <MenuOutline />
              </template>
            </NButton>

            <div class="logo">
              <span class="logo-icon">◆</span>
              <span class="logo-text">Media Client</span>
            </div>

            <NMenu
              v-if="!isMobile"
              mode="horizontal"
              :options="menuOptions"
              :value="activeKey"
              @update:value="handleMenuUpdate"
              class="nav-menu"
            />

            <NSpace align="center" :size="8">
              <!-- Settings with hover popover -->
              <NPopover
                v-model:show="showSettingsPopover"
                trigger="hover"
                placement="bottom-end"
                :show-arrow="false"
                style="padding: 0"
              >
                <template #trigger>
                  <NButton quaternary circle :class="{ 'settings-active': activeKey === 'settings' }" @click="goToSettings">
                    <template #icon>
                      <SettingsOutline />
                    </template>
                  </NButton>
                </template>
                <div class="settings-popover">
                  <div class="settings-popover-header">{{ t('settings.providerPresets') }}</div>
                  <NList hoverable clickable class="preset-list">
                    <NListItem
                      v-for="preset in configStore.providerPresets"
                      :key="preset.id"
                      @click="handlePresetSelect(preset.id)"
                    >
                      <div class="preset-item">
                        <span class="preset-name">{{ preset.name }}</span>
                        <span v-if="preset.id === configStore.activePresetId" class="active-indicator">
                          <CheckmarkOutline />
                        </span>
                      </div>
                      <div class="preset-url">{{ preset.baseUrl }}</div>
                    </NListItem>
                  </NList>
                  <div class="settings-popover-footer">
                    <NButton size="small" block @click="goToSettings">
                      {{ t('nav.settings') }}
                    </NButton>
                  </div>
                </div>
              </NPopover>

              <!-- Language switcher -->
              <NDropdown
                :options="languageOptions"
                @select="handleLanguageSelect"
                trigger="click"
              >
                <NButton quaternary circle>
                  <template #icon>
                    <LanguageOutline />
                  </template>
                </NButton>
              </NDropdown>

              <!-- Theme toggle -->
              <NButton quaternary circle @click="toggleTheme">
                <template #icon>
                  <MoonOutline v-if="isDark" />
                  <SunnyOutline v-else />
                </template>
              </NButton>
            </NSpace>
          </div>
        </NLayoutHeader>

        <!-- Content -->
        <NLayoutContent class="app-content">
          <RouterView v-slot="{ Component }">
            <Transition name="fade" mode="out-in">
              <component :is="Component" />
            </Transition>
          </RouterView>
        </NLayoutContent>
      </NLayout>

      <!-- Mobile Navigation Drawer -->
      <NDrawer v-model:show="showMobileMenu" placement="left" :width="280">
        <NDrawerContent :title="'Media Client'" closable>
          <NMenu
            mode="vertical"
            :options="menuOptions"
            :value="activeKey"
            @update:value="handleMenuUpdate"
            class="mobile-nav-menu"
          />
          <div class="mobile-menu-footer">
            <NSpace vertical :size="12">
              <NButton block @click="goToSettings(); showMobileMenu = false">
                <template #icon>
                  <SettingsOutline />
                </template>
                {{ t('nav.settings') }}
              </NButton>
              <div class="mobile-menu-actions">
                <NDropdown
                  :options="languageOptions"
                  @select="handleLanguageSelect"
                  trigger="click"
                >
                  <NButton quaternary>
                    <template #icon>
                      <LanguageOutline />
                    </template>
                  </NButton>
                </NDropdown>
                <NButton quaternary @click="toggleTheme">
                  <template #icon>
                    <MoonOutline v-if="isDark" />
                    <SunnyOutline v-else />
                  </template>
                </NButton>
              </div>
            </NSpace>
          </div>
        </NDrawerContent>
      </NDrawer>
    </div>
    </NMessageProvider>
  </NConfigProvider>
</template>

<style scoped>
.app-container {
  min-height: 100vh;
  position: relative;
}

.app-background {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: -1;
  transition: background 0.3s ease;
}

.dark .app-background {
  background: linear-gradient(135deg, #0a0a1a 0%, #1a1a3a 50%, #0f0f2a 100%);
}

.light .app-background {
  background: linear-gradient(135deg, #e0e5ec 0%, #f8fafc 50%, #e8ecf4 100%);
}

.app-layout {
  min-height: 100vh;
  background: transparent !important;
}

.app-header {
  position: sticky;
  top: 0;
  z-index: 100;
  background: transparent !important;
  border: none !important;
}

.glass-nav {
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
}

.dark .glass-nav {
  background: rgba(20, 20, 40, 0.8) !important;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1) !important;
}

.light .glass-nav {
  background: rgba(255, 255, 255, 0.8) !important;
  border-bottom: 1px solid rgba(0, 0, 0, 0.1) !important;
}

.header-content {
  max-width: 1400px;
  margin: 0 auto;
  padding: 0 24px;
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.logo {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 20px;
  font-weight: 600;
}

.logo-icon {
  font-size: 24px;
  background: linear-gradient(135deg, #7c3aed, #06b6d4);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.dark .logo-text {
  color: #e2e8f0;
}

.light .logo-text {
  color: #1e293b;
}

.nav-menu {
  flex: 1;
  justify-content: center;
  background: transparent !important;
}

.app-content {
  background: transparent !important;
  padding: 24px;
}

/* Page transition */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.fade-enter-from {
  opacity: 0;
  transform: translateY(10px);
}

.fade-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

/* Settings popover styles */
.settings-popover {
  min-width: 260px;
  padding: 0;
}

.settings-popover-header {
  padding: 12px 16px;
  font-size: 13px;
  font-weight: 600;
  opacity: 0.7;
  border-bottom: 1px solid rgba(128, 128, 128, 0.2);
}

.preset-list {
  max-height: 300px;
  overflow-y: auto;
}

.preset-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.preset-name {
  font-weight: 500;
}

.preset-url {
  font-size: 12px;
  opacity: 0.6;
  font-family: ui-monospace, monospace;
  margin-top: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.settings-popover-footer {
  padding: 8px 12px;
  border-top: 1px solid rgba(128, 128, 128, 0.2);
}

.settings-active {
  color: var(--primary-color);
}

.active-indicator {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #10b981;
  color: white;
  flex-shrink: 0;
}

.active-indicator svg {
  width: 14px;
  height: 14px;
}

/* Mobile styles */
.mobile-menu-btn {
  margin-right: 8px;
}

.mobile-nav-menu {
  margin: 0 -16px;
}

.mobile-menu-footer {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 16px;
  border-top: 1px solid rgba(128, 128, 128, 0.2);
}

.mobile-menu-actions {
  display: flex;
  justify-content: center;
  gap: 8px;
}

/* Mobile responsive styles */
@media (max-width: 768px) {
  .header-content {
    padding: 0 12px;
  }

  .logo-text {
    font-size: 16px;
  }

  .app-content {
    padding: 12px;
  }
}
</style>
