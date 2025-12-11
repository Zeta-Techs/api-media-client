# Tasks: Enhance UX and Code Quality

## Phase 1: 代码重构 (可并行)

### 1.1 增强 useBlobUrl composable
- [ ] 添加自动清理上一个 URL 功能
- [ ] 添加 `onUnmounted` 自动清理钩子
- [ ] 更新类型定义
- **验证**: 单元测试 - 创建/替换/清理流程

### 1.2 增强 useFormPersist composable
- [ ] 添加 debounce 参数 (默认 500ms)
- [ ] 添加 exclude 字段支持 (排除 File 等不可序列化类型)
- [ ] 添加 `onBeforeUnmount` 强制保存
- **验证**: 单元测试 - 防抖保存、页面离开保存

### 1.3 创建 useApiError composable
- [ ] 实现错误分类 (abort, network, api)
- [ ] 集成 parseApiError
- [ ] 导出 errorMessage ref 和处理方法
- **验证**: 单元测试 - 各类错误处理

### 1.4 迁移 SubtitleItem 类型到 types/index.ts
- [ ] 从 RealtimeView.vue 移动类型定义
- [ ] 更新 RealtimeView.vue 导入
- [ ] 更新 FullscreenSubtitle.vue 导入
- **验证**: TypeScript 编译无错误

---

## Phase 2: 视图重构 (顺序执行)

### 2.1 重构 AudioView.vue
- [ ] 替换 Blob URL 管理为 useBlobUrl
- [ ] 替换表单持久化为 useFormPersist
- [ ] 替换错误处理为 useApiError
- [ ] 移除重复的 onUnmounted 清理代码
- **验证**: 手动测试 - 转录流程完整、刷新恢复表单

### 2.2 重构 ImageView.vue
- [ ] 替换 Blob URL 管理为 useBlobUrl
- [ ] 替换表单持久化为 useFormPersist
- [ ] 替换错误处理为 useApiError
- **验证**: 手动测试 - 图像生成流程完整

### 2.3 重构 VideoView.vue
- [ ] 替换 Blob URL 管理为 useBlobUrl
- [ ] 添加表单持久化 (当前缺失)
- [ ] 替换错误处理为 useApiError
- **验证**: 手动测试 - 视频生成流程完整

### 2.4 重构 TTSView.vue
- [ ] 替换 Blob URL 管理为 useBlobUrl
- [ ] 替换表单持久化为 useFormPersist
- [ ] 替换错误处理为 useApiError
- **验证**: 手动测试 - TTS 流程完整

### 2.5 重构 RealtimeView.vue
- [ ] 添加消息上限 (MAX_TRANSCRIPTS = 500)
- [ ] 使用 useApiError 统一错误处理
- [ ] 移除本地 SubtitleItem 定义
- **验证**: 手动测试 - 长时间运行稳定

---

## Phase 3: 批量审核功能

### 3.1 创建 BatchModerationPanel.vue
- [ ] 复制 BatchAudioPanel 结构作为模板
- [ ] 实现审核处理器函数 (调用 /v1/moderations)
- [ ] 实现结果聚合 (flagged 统计、类别分布)
- [ ] 支持文本和图片两种输入模式
- **验证**: 手动测试 - 5+ 项目批量审核

### 3.2 更新 batch/index.ts
- [ ] 导出 BatchModerationPanel
- **验证**: 编译无错误

### 3.3 集成到 ModerationView.vue
- [ ] 添加 BatchModeSwitch 组件
- [ ] 添加 isBatchMode 状态
- [ ] 条件渲染 BatchModerationPanel
- **验证**: 手动测试 - 单模式/批量模式切换

### 3.4 添加批量审核翻译
- [ ] zh-CN.json 添加相关键
- [ ] en-US.json 添加相关键
- **验证**: 切换语言显示正确

---

## Phase 4: 云存储 UI 集成

### 4.1 创建 CloudUploadButton.vue
- [ ] 实现上传按钮 UI (loading, success, error 状态)
- [ ] 集成 useCloudStorage composable
- [ ] 支持 S3 和 WebDAV
- [ ] 上传进度显示
- **验证**: 手动测试 - 上传成功/失败场景

### 4.2 更新 SettingsView.vue
- [ ] 添加云存储配置卡片
- [ ] S3 配置表单 (endpoint, bucket, region, accessKeyId, secretAccessKey)
- [ ] WebDAV 配置表单 (endpoint, username, password, basePath)
- [ ] 连接测试按钮
- [ ] 自动上传开关
- **验证**: 手动测试 - 配置保存和恢复

### 4.3 集成上传按钮到各视图
- [ ] AudioView - 转录结果卡片
- [ ] ImageView - 图片结果卡片
- [ ] VideoView - 视频预览卡片
- [ ] TTSView - 音频结果卡片
- **验证**: 手动测试 - 各视图上传功能

### 4.4 添加云存储翻译
- [ ] zh-CN.json 添加相关键
- [ ] en-US.json 添加相关键
- **验证**: 切换语言显示正确

---

## Phase 5: 性能与体验优化

### 5.1 表单验证实时反馈
- [ ] AudioView - customModel 验证
- [ ] ImageView - prompt 必填验证
- [ ] VideoView - prompt 必填验证
- [ ] TTSView - input 必填验证
- **验证**: 手动测试 - 空值时显示错误提示

### 5.2 可访问性增强
- [ ] 批量控制按钮添加 aria-label
- [ ] 播放器按钮添加 aria-label
- [ ] 时间显示使用 `<time>` 元素
- [ ] 进度条添加 aria-valuenow
- **验证**: 屏幕阅读器测试

### 5.3 localStorage 写入优化
- [ ] useFormPersist 默认使用 500ms debounce
- [ ] 各视图确认使用新 composable
- **验证**: 性能测试 - 快速输入时不卡顿

---

## Phase 6: 最终验证

### 6.1 集成测试
- [ ] 完整流程测试: 上传 → 处理 → 云存储
- [ ] 批量处理测试: 10+ 项目各功能
- [ ] 长时间运行测试: 实时对话 30 分钟+

### 6.2 回归测试
- [ ] AudioView 所有功能正常
- [ ] ImageView 所有功能正常
- [ ] VideoView 所有功能正常
- [ ] TTSView 所有功能正常
- [ ] RealtimeView 所有功能正常
- [ ] ModerationView 所有功能正常

### 6.3 构建验证
- [ ] `npm run build` 无错误
- [ ] `npm run type-check` 无错误
- [ ] 生产构建运行正常

---

## 并行执行建议

```
Phase 1 (并行):
├── 1.1 useBlobUrl ─────┐
├── 1.2 useFormPersist ─┼─→ Phase 2 (顺序)
├── 1.3 useApiError ────┤
└── 1.4 类型迁移 ────────┘

Phase 3 + Phase 4 (可并行):
├── 3.x 批量审核 ───────┐
│                       ├─→ Phase 5 ─→ Phase 6
└── 4.x 云存储 UI ──────┘
```

## 估计工作量

| Phase | 任务数 | 复杂度 |
|-------|--------|--------|
| Phase 1 | 4 | 低 |
| Phase 2 | 5 | 中 |
| Phase 3 | 4 | 中 |
| Phase 4 | 4 | 中 |
| Phase 5 | 3 | 低 |
| Phase 6 | 3 | 低 |
| **总计** | **23** | |
