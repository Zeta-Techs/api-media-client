<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { NSpace, NButton, NProgress, NTag, NTooltip, NScrollbar, NEmpty } from 'naive-ui'
import { CloseOutline, RefreshOutline, TrashOutline } from '@vicons/ionicons5'
import type { BatchTask, BatchTaskStatus } from '@/composables/useBatchQueue'

const props = defineProps<{
  tasks: BatchTask[]
  maxHeight?: string
  showInput?: boolean
  inputFormatter?: (input: any) => string
}>()

const emit = defineEmits<{
  (e: 'retry', id: string): void
  (e: 'cancel', id: string): void
  (e: 'remove', id: string): void
}>()

const { t } = useI18n()

const statusMap = computed(() => ({
  pending: { type: 'default' as const, label: t('common.pending') },
  processing: { type: 'info' as const, label: t('common.processing') },
  completed: { type: 'success' as const, label: t('common.completed') },
  failed: { type: 'error' as const, label: t('common.failed') },
  cancelled: { type: 'warning' as const, label: t('common.cancelled') }
}))

function getStatusInfo(status: BatchTaskStatus) {
  return statusMap.value[status] || { type: 'default', label: status }
}

function formatInput(input: any): string {
  if (props.inputFormatter) {
    return props.inputFormatter(input)
  }
  if (typeof input === 'string') {
    return input.length > 50 ? input.slice(0, 50) + '...' : input
  }
  return JSON.stringify(input).slice(0, 50) + '...'
}
</script>

<template>
  <div class="batch-task-list">
    <NScrollbar :style="{ maxHeight: maxHeight || '400px' }">
      <NEmpty v-if="tasks.length === 0" :description="t('batch.noTasks')" />

      <div v-else class="task-items">
        <div
          v-for="task in tasks"
          :key="task.id"
          class="task-item"
          :class="task.status"
        >
          <div class="task-main">
            <div class="task-info">
              <span class="task-index">#{{ tasks.indexOf(task) + 1 }}</span>
              <NTooltip v-if="showInput">
                <template #trigger>
                  <span class="task-input">{{ formatInput(task.input) }}</span>
                </template>
                <div style="max-width: 400px; word-break: break-all;">
                  {{ typeof task.input === 'string' ? task.input : JSON.stringify(task.input, null, 2) }}
                </div>
              </NTooltip>
            </div>

            <NSpace align="center" :size="8">
              <NTag :type="getStatusInfo(task.status).type" size="small">
                {{ getStatusInfo(task.status).label }}
              </NTag>

              <!-- 进度条 -->
              <NProgress
                v-if="task.status === 'processing'"
                type="line"
                :percentage="task.progress"
                :show-indicator="false"
                style="width: 80px"
              />

              <!-- 操作按钮 -->
              <NSpace :size="4">
                <!-- 取消按钮 -->
                <NTooltip v-if="task.status === 'processing'">
                  <template #trigger>
                    <NButton
                      quaternary
                      circle
                      size="tiny"
                      type="warning"
                      @click="emit('cancel', task.id)"
                    >
                      <template #icon>
                        <CloseOutline />
                      </template>
                    </NButton>
                  </template>
                  {{ t('common.cancel') }}
                </NTooltip>

                <!-- 重试按钮 -->
                <NTooltip v-if="task.status === 'failed' || task.status === 'cancelled'">
                  <template #trigger>
                    <NButton
                      quaternary
                      circle
                      size="tiny"
                      type="info"
                      @click="emit('retry', task.id)"
                    >
                      <template #icon>
                        <RefreshOutline />
                      </template>
                    </NButton>
                  </template>
                  {{ t('batch.retry') }}
                </NTooltip>

                <!-- 删除按钮 -->
                <NTooltip v-if="task.status !== 'processing'">
                  <template #trigger>
                    <NButton
                      quaternary
                      circle
                      size="tiny"
                      type="error"
                      @click="emit('remove', task.id)"
                    >
                      <template #icon>
                        <TrashOutline />
                      </template>
                    </NButton>
                  </template>
                  {{ t('common.delete') }}
                </NTooltip>
              </NSpace>
            </NSpace>
          </div>

          <!-- 错误信息 -->
          <div v-if="task.error" class="task-error">
            {{ task.error }}
          </div>
        </div>
      </div>
    </NScrollbar>
  </div>
</template>

<style scoped>
.batch-task-list {
  width: 100%;
}

.task-items {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.task-item {
  padding: 10px 12px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  transition: all 0.2s;
}

.task-item:hover {
  background: rgba(255, 255, 255, 0.05);
}

.task-item.completed {
  border-color: rgba(16, 185, 129, 0.2);
}

.task-item.failed {
  border-color: rgba(239, 68, 68, 0.2);
}

.task-item.processing {
  border-color: rgba(59, 130, 246, 0.2);
}

.task-main {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.task-info {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
}

.task-index {
  font-size: 12px;
  font-weight: 600;
  color: #7c3aed;
  min-width: 28px;
}

.task-input {
  font-size: 13px;
  opacity: 0.8;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.task-error {
  margin-top: 8px;
  padding: 6px 8px;
  font-size: 12px;
  color: #f87171;
  background: rgba(239, 68, 68, 0.1);
  border-radius: 4px;
}
</style>
