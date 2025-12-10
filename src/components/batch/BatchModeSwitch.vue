<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { NSwitch, NSpace, NTooltip } from 'naive-ui'

defineProps<{
  modelValue: boolean
  disabled?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
}>()

const { t } = useI18n()
</script>

<template>
  <NSpace align="center" :size="8">
    <span class="mode-label" :class="{ active: !modelValue }">
      {{ t('batch.singleMode') }}
    </span>
    <NTooltip>
      <template #trigger>
        <NSwitch
          :value="modelValue"
          :disabled="disabled"
          @update:value="emit('update:modelValue', $event)"
        />
      </template>
      {{ modelValue ? t('batch.switchToSingle') : t('batch.switchToBatch') }}
    </NTooltip>
    <span class="mode-label" :class="{ active: modelValue }">
      {{ t('batch.batchMode') }}
    </span>
  </NSpace>
</template>

<style scoped>
.mode-label {
  font-size: 13px;
  opacity: 0.5;
  transition: all 0.2s;
}

.mode-label.active {
  opacity: 1;
  color: #7c3aed;
  font-weight: 500;
}
</style>
