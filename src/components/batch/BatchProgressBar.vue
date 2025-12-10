<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { NProgress, NSpace, NTag } from 'naive-ui'

const props = defineProps<{
  total: number
  completed: number
  failed: number
  processing: number
  progress: number
  isRunning: boolean
  isPaused: boolean
}>()

const { t } = useI18n()

const statusText = computed(() => {
  if (props.isRunning && !props.isPaused) {
    return t('batch.running')
  }
  if (props.isPaused) {
    return t('batch.paused')
  }
  if (props.completed + props.failed === props.total && props.total > 0) {
    return t('batch.finished')
  }
  return t('batch.idle')
})

const statusType = computed(() => {
  if (props.isRunning && !props.isPaused) return 'info'
  if (props.isPaused) return 'warning'
  if (props.completed + props.failed === props.total && props.total > 0) {
    return props.failed > 0 ? 'warning' : 'success'
  }
  return 'default'
})

const progressStatus = computed(() => {
  if (props.isRunning) return 'info'
  if (props.failed > 0) return 'error'
  if (props.completed === props.total && props.total > 0) return 'success'
  return 'default'
})
</script>

<template>
  <div class="batch-progress-bar">
    <div class="progress-header">
      <NSpace align="center" :size="12">
        <NTag :type="statusType" size="small">
          {{ statusText }}
        </NTag>
        <span class="progress-stats">
          <span class="stat completed">{{ completed }}</span>
          <span class="stat-separator">/</span>
          <span v-if="failed > 0" class="stat failed">{{ failed }} {{ t('batch.failedCount') }}</span>
          <span v-if="failed > 0" class="stat-separator">/</span>
          <span class="stat total">{{ total }}</span>
        </span>
      </NSpace>
      <span class="progress-percentage">{{ progress }}%</span>
    </div>

    <NProgress
      type="line"
      :percentage="progress"
      :status="progressStatus"
      :show-indicator="false"
      :height="8"
      :border-radius="4"
    />

    <div v-if="processing > 0" class="processing-info">
      {{ t('batch.processingCount', { count: processing }) }}
    </div>
  </div>
</template>

<style scoped>
.batch-progress-bar {
  width: 100%;
}

.progress-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.progress-stats {
  font-size: 13px;
  opacity: 0.8;
}

.stat {
  font-weight: 500;
}

.stat.completed {
  color: #10b981;
}

.stat.failed {
  color: #ef4444;
}

.stat.total {
  opacity: 0.6;
}

.stat-separator {
  margin: 0 4px;
  opacity: 0.4;
}

.progress-percentage {
  font-size: 14px;
  font-weight: 600;
  color: #7c3aed;
}

.processing-info {
  margin-top: 6px;
  font-size: 12px;
  opacity: 0.6;
  text-align: center;
}
</style>
