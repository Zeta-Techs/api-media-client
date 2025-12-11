# Migrate to Tailwind Dark Theme

## Status
IMPLEMENTED

## Why
统一 ZetaTechs 系列产品的 UI 风格，将当前 Glassmorphism (玻璃拟态) 风格迁移为 `ai-foundry-manager` 项目使用的 Tailwind 实色暗色主题风格，保持产品视觉一致性。

## What Changes

### 风格对比

| 特性 | 当前风格 (Glassmorphism) | 目标风格 (Tailwind Dark) |
|------|-------------------------|-------------------------|
| 背景 | 半透明 + backdrop-filter blur | 实色渐变 (gray-900 → black) |
| 卡片 | 玻璃效果 rgba(30,30,50,0.6) | 实色 bg-gray-900 |
| 边框 | 8% 透明度白色 | 实色 border-gray-800 |
| 主色 | 紫色 #7c3aed | 青色 #0ea5e9 (cyan-500) |
| 强调色 | 青色 #06b6d4 | 绿色 #22c55e (green-500) |
| 悬停效果 | 上浮 + 发光 | 流光边框动画 |
| 圆角 | 16px (卡片) | 0.75rem (rounded-xl) |
| 渐变文字 | 紫→青 | 青→紫→绿 |

### 主要变更

1. **引入 Tailwind CSS** - 添加 tailwindcss 及配置
2. **重写 CSS 变量** - 从 Glassmorphism tokens 迁移到 Tailwind 配置
3. **更新组件样式** - 移除 backdrop-filter，使用实色背景
4. **添加流光动画** - 实现 `section-glow` 和 `account-card-glow` 效果
5. **更新色彩方案** - 主色从紫色改为青色/绿色

## Impact

### 受影响的文件
- `package.json` - 添加 tailwindcss 依赖
- `tailwind.config.js` - 新建配置文件
- `postcss.config.js` - PostCSS 配置
- `src/assets/styles/glass.css` - **重写** → `src/index.css`
- `src/assets/styles/responsive.css` - 迁移到 Tailwind 工具类
- 所有 `.vue` 组件文件 - 更新 class 名称

### 受影响的 Specs
- 无直接影响 (纯视觉变更，不影响功能逻辑)

## Risk
**MEDIUM**

- Naive UI 组件样式覆盖需要仔细处理
- Tailwind 与 Naive UI 的集成可能有冲突
- 响应式断点需要重新验证
- 现有自定义 CSS 类需要全部迁移

## Alternatives Considered

1. **保持 Glassmorphism，仅更新配色** - 工作量小，但风格不一致
2. **完全移除 Naive UI 改用纯 Tailwind 组件** - 工作量太大
3. **采用 CSS-in-JS 方案** - 增加复杂度，不必要
