<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import {
  NCard, NSpace, NButton, NEmpty, NTag, NPopconfirm,
  NRadioGroup, NRadio, NScrollbar
} from 'naive-ui'
import { useHistoryStore } from '@/stores/history'
import { message } from '@/composables/useNaiveMessage'
import type { HistoryItem } from '@/types'

const { t } = useI18n()
const router = useRouter()
const historyStore = useHistoryStore()

// Filter
const filter = ref<'all' | 'video' | 'image' | 'audio'>('all')

const filteredItems = computed(() => {
  if (filter.value === 'all') return historyStore.items
  return historyStore.items.filter(item => item.type === filter.value)
})

// Format date
function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString()
}

// Get type color
function getTypeColor(type: string) {
  if (type === 'video') return 'info' as const
  if (type === 'image') return 'success' as const
  return 'warning' as const // audio
}

// Get status color
function getStatusColor(status: string) {
  return status === 'completed' ? 'success' : 'error' as const
}

// Reload entire history record (params + result)
function handleReload(item: HistoryItem) {
  // Set the pending reload item
  historyStore.setPendingReload(item)

  // Navigate to the corresponding view
  if (item.type === 'video') {
    router.push({ name: 'video' })
  } else if (item.type === 'image') {
    router.push({ name: 'image' })
  } else {
    router.push({ name: 'audio' })
  }
  message.success(t('history.reload'))
}

// Delete item
function handleDelete(id: string) {
  historyStore.removeItem(id)
  message.success(t('common.success'))
}

// Clear all
function handleClearAll() {
  historyStore.clearAll()
  message.success(t('common.success'))
}

// Get params preview
function getParamsPreview(item: HistoryItem): string {
  const params = item.params as any
  if (item.type === 'video') {
    return `${params.model || 'sora-2'} | ${params.seconds || '4'}s | ${params.size || ''}`
  } else if (item.type === 'image') {
    return `${params.model || ''} | ${params.imageSize || '1K'} | ${params.format || 'ai-studio'}`
  } else {
    // audio
    return `${params.model || 'whisper-1'} | ${params.responseFormat || 'json'} | ${params.language || 'auto'}`
  }
}

// Get type label
function getTypeLabel(type: string): string {
  if (type === 'video') return t('history.filter.video')
  if (type === 'image') return t('history.filter.image')
  return t('history.filter.audio')
}
</script>

<template>
  <div class="page-container">
    <div class="page-header">
      <div class="header-row">
        <div>
          <h1 class="page-title gradient-text">{{ t('history.title') }}</h1>
          <p class="page-subtitle">{{ t('history.subtitle') }}</p>
        </div>
        <NPopconfirm @positive-click="handleClearAll">
          <template #trigger>
            <NButton type="error" secondary :disabled="historyStore.items.length === 0">
              {{ t('history.clearAll') }}
            </NButton>
          </template>
          确定要清空所有历史记录吗？
        </NPopconfirm>
      </div>
    </div>

    <!-- Filter -->
    <NCard class="glass-card filter-card">
      <NRadioGroup v-model:value="filter">
        <NSpace>
          <NRadio value="all">{{ t('history.filter.all') }} ({{ historyStore.items.length }})</NRadio>
          <NRadio value="video">{{ t('history.filter.video') }} ({{ historyStore.videoItems.length }})</NRadio>
          <NRadio value="image">{{ t('history.filter.image') }} ({{ historyStore.imageItems.length }})</NRadio>
          <NRadio value="audio">{{ t('history.filter.audio') }} ({{ historyStore.audioItems.length }})</NRadio>
        </NSpace>
      </NRadioGroup>
    </NCard>

    <!-- History List -->
    <div class="history-list">
      <NEmpty v-if="filteredItems.length === 0" :description="t('history.empty')" />

      <NScrollbar v-else style="max-height: calc(100vh - 300px)">
        <TransitionGroup name="list" tag="div" class="history-items">
          <NCard
            v-for="item in filteredItems"
            :key="item.id"
            class="glass-card history-item"
          >
            <div class="item-header">
              <NSpace align="center">
                <NTag :type="getTypeColor(item.type)" size="small">
                  {{ getTypeLabel(item.type) }}
                </NTag>
                <NTag :type="getStatusColor(item.status)" size="small">
                  {{ item.status === 'completed' ? t('common.completed') : t('common.failed') }}
                </NTag>
                <span class="item-date">{{ formatDate(item.createdAt) }}</span>
              </NSpace>
              <NSpace>
                <NButton size="small" @click="handleReload(item)">
                  {{ t('history.reload') }}
                </NButton>
                <NPopconfirm @positive-click="handleDelete(item.id)">
                  <template #trigger>
                    <NButton size="small" type="error" secondary>
                      {{ t('history.delete') }}
                    </NButton>
                  </template>
                  确定要删除这条记录吗？
                </NPopconfirm>
              </NSpace>
            </div>

            <div class="item-content">
              <div class="item-prompt">
                {{ (item.params as any).prompt || '(No prompt)' }}
              </div>
              <div class="item-params">
                {{ getParamsPreview(item) }}
              </div>
              <div v-if="item.result?.taskId" class="item-task-id">
                Task ID: {{ item.result.taskId }}
              </div>
              <div v-if="item.error" class="item-error">
                Error: {{ item.error }}
              </div>
            </div>
          </NCard>
        </TransitionGroup>
      </NScrollbar>
    </div>
  </div>
</template>

<style scoped>
.page-container {
  max-width: 1400px;
  margin: 0 auto;
}

.header-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.filter-card {
  margin-bottom: 16px;
}

.history-list {
  margin-top: 16px;
}

.history-items {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.history-item {
  transition: all 0.3s ease;
}

.history-item:hover {
  transform: translateX(4px);
}

.item-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.item-date {
  font-size: 12px;
  opacity: 0.6;
}

.item-content {
  font-size: 14px;
}

.item-prompt {
  font-weight: 500;
  margin-bottom: 8px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.item-params {
  font-size: 13px;
  opacity: 0.7;
  font-family: ui-monospace, monospace;
}

.item-task-id {
  margin-top: 8px;
  font-size: 12px;
  opacity: 0.6;
  font-family: ui-monospace, monospace;
}

.item-error {
  margin-top: 8px;
  font-size: 12px;
  color: #ef4444;
}

/* List transition */
.list-enter-active,
.list-leave-active {
  transition: all 0.3s ease;
}

.list-enter-from {
  opacity: 0;
  transform: translateX(-20px);
}

.list-leave-to {
  opacity: 0;
  transform: translateX(20px);
}
</style>
