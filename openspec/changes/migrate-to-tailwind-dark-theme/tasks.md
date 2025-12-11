# Tasks: Migrate to Tailwind Dark Theme

## Phase 1: 基础设施

- [x] 1.1 安装 tailwindcss, postcss, autoprefixer
- [x] 1.2 创建 `tailwind.config.js` 配置文件
- [x] 1.3 创建 `postcss.config.js` 配置文件
- [x] 1.4 更新 `vite.config.ts` (如需要) - N/A

## Phase 2: 全局样式迁移

- [x] 2.1 创建新的 `src/index.css` 替代 glass.css
- [x] 2.2 配置 Tailwind 自定义颜色 (background, foreground, primary, secondary)
- [x] 2.3 添加流光动画 CSS (section-glow, account-card-glow, highlight-flash)
- [x] 2.4 更新 body/html 背景样式
- [x] 2.5 更新滚动条样式
- [x] 2.6 配置 Naive UI 主题变量覆盖

## Phase 3: 通用组件样式迁移

- [x] 3.1 更新 App.vue 样式 (header, logo, navigation)
- [x] 3.2 更新 Batch 组件样式 (BatchAudioPanel, BatchInputArea, BatchModeSwitch, BatchProgressBar, BatchTaskList, BatchTTSPanel)
- [x] 3.3 更新 FullscreenSubtitle.vue 样式
- [x] 3.4 更新 Naive UI themeOverrides (cyan/green 主色)

## Phase 4: 视图页面迁移

- [x] 4.1 AudioView.vue - 更新渐变文字和高亮颜色
- [x] 4.2 ImageView.vue - 更新渐变文字颜色
- [x] 4.3 VideoView.vue - 更新渐变文字颜色
- [x] 4.4 TTSView.vue - 更新渐变文字颜色
- [x] 4.5 RealtimeView.vue - 更新对话界面和transcript样式
- [x] 4.6 ModerationView.vue - 更新渐变文字颜色
- [x] 4.7 SettingsView.vue - N/A (uses Naive UI components)

## Phase 5: 验证与清理

- [x] 5.1 验证类型检查通过 (vue-tsc --noEmit)
- [x] 5.2 验证 dev server 运行正常
- [x] 5.3 删除旧的 `src/assets/styles/glass.css`
- [x] 5.4 删除旧的 `src/assets/styles/responsive.css`
- [x] 5.5 更新 main.ts 导入新的 index.css
- [x] 5.6 修复 ES module 配置 (postcss.config.js, tailwind.config.js)
- [x] 5.7 运行构建验证无错误 (npm run build)
