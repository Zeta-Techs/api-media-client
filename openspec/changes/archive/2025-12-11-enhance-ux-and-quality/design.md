# Design Document: Enhance UX and Code Quality

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Views Layer                               │
├─────────────────────────────────────────────────────────────────┤
│  ModerationView    AudioView    ImageView    VideoView    ...   │
│       │                │            │            │               │
│       ├── BatchModerationPanel (NEW)                            │
│       └── CloudUploadButton (NEW - shared component)            │
├─────────────────────────────────────────────────────────────────┤
│                     Composables Layer                            │
├─────────────────────────────────────────────────────────────────┤
│  useBlobUrl     useFormPersist    useCloudStorage    useBatchQueue │
│  (existing)     (existing)        (existing)         (existing)    │
│       │              │                  │                 │        │
│       └──────────────┴──────────────────┴─────────────────┘        │
│                    统一使用，消除重复代码                            │
├─────────────────────────────────────────────────────────────────┤
│                      Services Layer                              │
├─────────────────────────────────────────────────────────────────┤
│           S3Service          │          WebDAVService            │
└─────────────────────────────────────────────────────────────────┘
```

## 2. Batch Moderation Design

### 2.1 组件结构
```
src/components/batch/
├── BatchModerationPanel.vue  (NEW)
└── index.ts                  (UPDATE - export new component)
```

### 2.2 数据流
```
User Input (Text/Images)
    ↓
BatchModerationPanel
    ↓
useBatchQueue (processor: moderateContent)
    ↓
/v1/moderations API
    ↓
Result aggregation (flagged count, category breakdown)
    ↓
Export (CSV/JSON with scores)
```

### 2.3 BatchModerationTask 类型
```typescript
interface BatchModerationTask {
  id: string
  type: 'text' | 'image' | 'multimodal'
  content: string | { text?: string; imageUrl?: string }
  status: BatchTaskStatus
  result?: {
    flagged: boolean
    categories: Record<string, boolean>
    scores: Record<string, number>
  }
}
```

## 3. Cloud Storage UI Design

### 3.1 新增共享组件
```
src/components/
└── CloudUploadButton.vue  (NEW)
```

### 3.2 组件 API
```typescript
// Props
interface CloudUploadButtonProps {
  blob: Blob
  filename: string
  disabled?: boolean
  autoUpload?: boolean
}

// Emits
emit('uploaded', { success: boolean, url: string, provider: string })
emit('error', { message: string })
```

### 3.3 设置页面集成
在 SettingsView.vue 添加云存储配置卡片：
- S3 配置 (endpoint, bucket, region, keys, pathPrefix)
- WebDAV 配置 (endpoint, username, password, basePath)
- 连接测试按钮
- 自动上传开关

### 3.4 结果卡片集成
各视图的结果卡片添加上传按钮：
- AudioView: 转录结果旁
- ImageView: 图片卡片上
- VideoView: 视频预览上
- TTSView: 音频结果旁

## 4. Code Refactor Design

### 4.1 useBlobUrl 统一使用

**当前问题**：
```typescript
// AudioView.vue (重复模式)
const audioUrl = ref('')
onUnmounted(() => {
  if (audioUrl.value) URL.revokeObjectURL(audioUrl.value)
})
```

**重构后**：
```typescript
// AudioView.vue
import { useBlobUrl } from '@/composables/useBlobUrl'
const { url: audioUrl, setBlob, cleanup } = useBlobUrl()

// 使用
setBlob(blob)  // 自动创建 URL，自动清理旧的
onUnmounted(() => cleanup())  // 或 composable 自动处理
```

### 4.2 useFormPersist 统一使用

**当前问题**：
```typescript
// 每个视图都有类似代码
const SETTINGS_KEY = 'xxx-form-settings'
watch(form, () => saveToLocalStorage(), { deep: true })
onMounted(() => loadFromLocalStorage())
```

**重构后**：
```typescript
// AudioView.vue
import { useFormPersist } from '@/composables/useFormPersist'
const form = ref<AudioFormData>({...})
useFormPersist('audio-form', form, {
  debounce: 500,
  exclude: ['file']  // 排除不可序列化字段
})
```

### 4.3 类型定义迁移

从 RealtimeView.vue 迁移到 types/index.ts:
```typescript
// types/index.ts (ADD)
export interface SubtitleItem {
  text: string
  translated?: string
  timestamp: Date
  isFinal: boolean
  isTranslating?: boolean
}
```

### 4.4 错误处理统一

创建 `useApiError` composable:
```typescript
// composables/useApiError.ts (NEW)
export function useApiError() {
  const errorMessage = ref('')

  function handleError(error: unknown, fallbackMessage: string) {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        errorMessage.value = ''
        return 'aborted'
      }
      errorMessage.value = parseApiError(error.message)
    } else {
      errorMessage.value = fallbackMessage
    }
    return 'error'
  }

  function clearError() {
    errorMessage.value = ''
  }

  return { errorMessage, handleError, clearError }
}
```

## 5. Performance & UX Design

### 5.1 实时对话消息上限

**方案**: 环形缓冲区 + 虚拟滚动

```typescript
// RealtimeView.vue
const MAX_TRANSCRIPTS = 500
const transcripts = ref<SubtitleItem[]>([])

function addTranscript(item: SubtitleItem) {
  transcripts.value.push(item)
  if (transcripts.value.length > MAX_TRANSCRIPTS) {
    transcripts.value.shift()  // 移除最旧的
  }
}
```

**可选增强**: 使用 `naive-ui` 的 `NVirtualList` 或 `vue-virtual-scroller`:
```vue
<NVirtualList
  :items="transcripts"
  :item-size="60"
  key-field="timestamp"
>
  <template #default="{ item }">
    <TranscriptItem :item="item" />
  </template>
</NVirtualList>
```

### 5.2 表单验证实时反馈

使用 Naive UI 的 `NFormItem` 验证功能:
```vue
<NFormItem
  :label="t('common.model')"
  :validation-status="customModelError ? 'error' : undefined"
  :feedback="customModelError"
>
  <NInput v-model:value="form.customModel" />
</NFormItem>
```

### 5.3 可访问性增强

添加缺失的 aria-labels:
```vue
<!-- 批量控制按钮 -->
<NButton
  :aria-label="t('batch.start')"
  @click="start"
>
  <template #icon><PlayIcon /></template>
</NButton>

<!-- 时间显示 -->
<time :datetime="currentTime.toISOString()">
  {{ formatTime(currentTime) }}
</time>
```

### 5.4 localStorage 写入优化

**问题**: 每次表单变化都写入 localStorage

**方案**: 防抖 + 页面离开时强制保存
```typescript
// useFormPersist.ts
watch(form, useDebounceFn(() => {
  localStorage.setItem(key, JSON.stringify(form.value))
}, 500), { deep: true })

onBeforeUnmount(() => {
  // 强制保存，确保不丢失
  localStorage.setItem(key, JSON.stringify(form.value))
})
```

## 6. File Changes Summary

### 新增文件
- `src/components/batch/BatchModerationPanel.vue`
- `src/components/CloudUploadButton.vue`
- `src/composables/useApiError.ts`

### 修改文件
- `src/components/batch/index.ts` - 导出新组件
- `src/views/ModerationView.vue` - 添加批量模式
- `src/views/SettingsView.vue` - 添加云存储配置
- `src/views/AudioView.vue` - 使用统一 composables
- `src/views/ImageView.vue` - 使用统一 composables
- `src/views/VideoView.vue` - 使用统一 composables
- `src/views/TTSView.vue` - 使用统一 composables
- `src/views/RealtimeView.vue` - 消息上限、性能优化
- `src/composables/useBlobUrl.ts` - 增强自动清理
- `src/composables/useFormPersist.ts` - 添加防抖
- `src/types/index.ts` - 添加 SubtitleItem 类型
- `src/locales/zh-CN.json` - 添加翻译
- `src/locales/en-US.json` - 添加翻译

## 7. Migration Strategy

### Phase 1: 代码重构 (低风险)
1. 增强现有 composables
2. 逐个视图迁移到统一模式
3. 每个视图迁移后单独测试

### Phase 2: 新功能 (中等风险)
1. 实现 BatchModerationPanel
2. 实现 CloudUploadButton
3. 集成到各视图

### Phase 3: 性能优化 (低风险)
1. 实现消息上限
2. 添加可访问性标签
3. 优化 localStorage 写入

## 8. Testing Considerations

### 单元测试
- useBlobUrl: 验证 URL 创建和清理
- useFormPersist: 验证持久化和恢复
- useApiError: 验证错误分类

### 集成测试
- 批量审核: 10+ 项目批量处理
- 云上传: S3 和 WebDAV 上传成功/失败
- 性能: 1000+ 消息时的 DOM 响应

### 手动测试清单
- [ ] 各视图批量模式切换正常
- [ ] 云存储连接测试工作
- [ ] 表单验证错误显示
- [ ] 刷新页面后表单恢复
- [ ] 实时对话长时间运行稳定
