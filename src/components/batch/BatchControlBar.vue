<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { NButton, NSpace, NPopconfirm, NTooltip, NDropdown } from 'naive-ui'
import {
  PlayOutline,
  PauseOutline,
  StopOutline,
  RefreshOutline,
  TrashOutline,
  DownloadOutline
} from '@vicons/ionicons5'

defineProps<{
  isRunning: boolean
  isPaused: boolean
  hasItems: boolean
  hasFailed: boolean
  hasCompleted: boolean
  disabled?: boolean
}>()

const emit = defineEmits<{
  (e: 'start'): void
  (e: 'pause'): void
  (e: 'resume'): void
  (e: 'stop'): void
  (e: 'retryFailed'): void
  (e: 'clearAll'): void
  (e: 'clearCompleted'): void
  (e: 'clearFailed'): void
  (e: 'export', format: 'json' | 'csv' | 'zip'): void
}>()

const { t } = useI18n()

const exportOptions = [
  { label: 'JSON', key: 'json' },
  { label: 'CSV', key: 'csv' },
  { label: 'ZIP', key: 'zip' }
]

function handleExport(key: string) {
  emit('export', key as 'json' | 'csv' | 'zip')
}
</script>

<template>
  <div class="batch-control-bar">
    <NSpace :size="8">
      <!-- 开始/暂停/继续 -->
      <NTooltip v-if="!isRunning">
        <template #trigger>
          <NButton
            type="primary"
            :disabled="disabled || !hasItems"
            @click="emit('start')"
          >
            <template #icon>
              <PlayOutline />
            </template>
            {{ t('batch.start') }}
          </NButton>
        </template>
        {{ t('batch.startHint') }}
      </NTooltip>

      <template v-else>
        <NButton
          v-if="!isPaused"
          type="warning"
          @click="emit('pause')"
        >
          <template #icon>
            <PauseOutline />
          </template>
          {{ t('batch.pause') }}
        </NButton>

        <NButton
          v-else
          type="primary"
          @click="emit('resume')"
        >
          <template #icon>
            <PlayOutline />
          </template>
          {{ t('batch.resume') }}
        </NButton>

        <NPopconfirm @positive-click="emit('stop')">
          <template #trigger>
            <NButton type="error">
              <template #icon>
                <StopOutline />
              </template>
              {{ t('batch.stop') }}
            </NButton>
          </template>
          {{ t('batch.confirmStop') }}
        </NPopconfirm>
      </template>
    </NSpace>

    <NSpace :size="8">
      <!-- 重试失败 -->
      <NTooltip v-if="hasFailed">
        <template #trigger>
          <NButton
            :disabled="disabled || isRunning"
            @click="emit('retryFailed')"
          >
            <template #icon>
              <RefreshOutline />
            </template>
            {{ t('batch.retryFailed') }}
          </NButton>
        </template>
        {{ t('batch.retryFailedHint') }}
      </NTooltip>

      <!-- 清理菜单 -->
      <NDropdown
        trigger="click"
        :options="[
          { label: t('batch.clearCompleted'), key: 'completed', disabled: !hasCompleted },
          { label: t('batch.clearFailed'), key: 'failed', disabled: !hasFailed },
          { type: 'divider' },
          { label: t('batch.clearAll'), key: 'all', disabled: !hasItems }
        ]"
        @select="(key: string) => {
          if (key === 'all') emit('clearAll')
          else if (key === 'completed') emit('clearCompleted')
          else if (key === 'failed') emit('clearFailed')
        }"
      >
        <NButton :disabled="disabled || !hasItems || isRunning">
          <template #icon>
            <TrashOutline />
          </template>
          {{ t('batch.clear') }}
        </NButton>
      </NDropdown>

      <!-- 导出 -->
      <NDropdown
        trigger="click"
        :options="exportOptions"
        :disabled="!hasCompleted"
        @select="handleExport"
      >
        <NButton :disabled="disabled || !hasCompleted">
          <template #icon>
            <DownloadOutline />
          </template>
          {{ t('batch.export') }}
        </NButton>
      </NDropdown>
    </NSpace>
  </div>
</template>

<style scoped>
.batch-control-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 0;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}
</style>
