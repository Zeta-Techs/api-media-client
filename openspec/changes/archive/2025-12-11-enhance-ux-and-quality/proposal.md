# Proposal: Enhance UX and Code Quality

## Change ID
`enhance-ux-and-quality`

## Summary
综合性改进方案，涵盖四个方向：批量审核功能、云存储 UI 集成、代码质量重构、性能与体验优化。

## Why

当前项目存在以下问题：
1. **功能不一致**：ModerationView 没有批量处理，与其他视图不一致
2. **功能未完成**：云存储 composable 存在但无 UI 入口
3. **代码重复**：Blob URL 清理、表单持久化等逻辑在各视图重复
4. **性能隐患**：实时对话消息无限增长，可能导致 DOM 卡顿

## What Changes

### Spec Deltas
- `specs/batch-moderation/spec.md` - Adds batch moderation capability to ModerationView
- `specs/cloud-storage-ui/spec.md` - Adds cloud storage UI components and settings
- `specs/code-refactor/spec.md` - Unifies view implementations with shared composables
- `specs/performance-ux/spec.md` - Adds performance optimizations and UX improvements

### Implementation Changes
- Created `BatchModerationPanel.vue` component
- Created `CloudUploadButton.vue` component
- Created `useApiError` composable
- Enhanced `useFormPersist` with onBeforeUnmount save
- Added message history limits to RealtimeView
- Migrated SubtitleItem type to shared types
- Integrated batch mode into ModerationView
- Added translations for batch moderation and cloud storage

## Motivation (Legacy)
当前项目存在以下问题：
1. **功能不一致**：ModerationView 没有批量处理，与其他视图不一致
2. **功能未完成**：云存储 composable 存在但无 UI 入口
3. **代码重复**：Blob URL 清理、表单持久化等逻辑在各视图重复
4. **性能隐患**：实时对话消息无限增长，可能导致 DOM 卡顿

## Scope

### 1. 批量审核功能 (batch-moderation)
- 新增 `BatchModerationPanel.vue` 组件
- 支持批量文本/图片审核
- 结果汇总和导出

### 2. 云存储 UI 集成 (cloud-storage-ui)
- 在结果卡片添加上传按钮
- 批量处理完成后自动上传选项
- 设置页面的存储配置面板

### 3. 代码质量重构 (code-refactor)
- 统一使用 `useBlobUrl` composable
- 统一使用 `useFormPersist` composable
- 消除重复的错误处理逻辑
- 移动本地类型定义到共享类型文件

### 4. 性能与体验优化 (performance-ux)
- 实时对话消息上限和虚拟滚动
- 表单验证实时反馈
- 增强可访问性 (aria-labels)
- 优化 localStorage 写入频率

## Non-Goals
- 不涉及新的 API 模型支持
- 不改变现有的路由结构
- 不修改 Pinia store 架构

## Dependencies
- 无外部新依赖
- 使用现有的 JSZip 用于批量导出

## Risks
- 重构可能影响现有功能稳定性
- 需要充分测试各视图

## Success Criteria
1. ModerationView 支持批量处理
2. 用户可从 UI 上传结果到云存储
3. 代码重复减少 50%+
4. 实时对话在 1000+ 消息时保持流畅
