# Design: Migrate to Tailwind Dark Theme

## Context
当前项目 (`api-media-client`) 使用自定义 CSS 实现 Glassmorphism 风格，而 `ai-foundry-manager` 使用 Tailwind CSS 实现实色暗色主题。为保持产品线一致性，需要将 UI 风格迁移。

### 技术约束
- 当前使用 Vue 3 + Naive UI 组件库
- Naive UI 有自己的主题系统 (CSS 变量)
- 需要与 Tailwind CSS 共存

## Goals / Non-Goals

### Goals
- 统一 ZetaTechs 产品的视觉风格
- 保持 Naive UI 组件的功能完整性
- 实现流光边框等特色动画效果
- 保持响应式设计

### Non-Goals
- 不替换 Naive UI 组件库
- 不改变页面布局结构
- 不修改功能逻辑

## Decisions

### 1. Tailwind 与 Naive UI 共存策略

**决定**: 使用 Tailwind 作为全局样式基础，Naive UI 主题通过 CSS 变量覆盖

**理由**:
- Naive UI 的 `n-config-provider` 支持主题定制
- Tailwind 的 `@apply` 可以与组件级样式共存
- 避免完全重写组件

**实现**:
```css
/* 覆盖 Naive UI 主题变量 */
:root {
  --n-color: #020617;
  --n-text-color: #e5e7eb;
  --n-border-color: #1f2937;
  /* ... */
}
```

### 2. 样式迁移策略

**决定**: 分阶段迁移，优先迁移全局样式，再逐步更新组件

**迁移映射**:
| 原 class | 新 class (Tailwind) |
|----------|-------------------|
| `.glass-card` | `bg-gray-900 border border-gray-800 rounded-xl` |
| `.glass-input` | `bg-gray-900 border-gray-700 rounded-lg` |
| `.glass-button-primary` | `bg-gradient-to-r from-cyan-600 to-green-600` |
| `.gradient-text` | `bg-gradient-to-r from-cyan-400 via-purple-400 to-green-400 bg-clip-text text-transparent` |

### 3. 动画效果实现

**决定**: 从 `ai-foundry-manager` 移植流光动画

**包含效果**:
- `section-glow`: 大板块顺时针旋转流光边框
- `account-card-glow`: 卡片悬停多彩流光
- `highlight-flash`: 闪烁高亮效果

### 4. 色彩映射

```javascript
// tailwind.config.js
colors: {
  background: '#020617',      // 原 #0a0a1a
  foreground: '#e5e7eb',      // 原 #e2e8f0
  border: '#1f2937',          // 原 rgba(255,255,255,0.08)
  primary: {
    DEFAULT: '#0ea5e9',       // 原 #7c3aed (紫→青)
  },
  secondary: {
    DEFAULT: '#22c55e',       // 原 #6366f1 (靛→绿)
  },
}
```

## Risks / Trade-offs

| 风险 | 概率 | 影响 | 缓解措施 |
|------|-----|------|---------|
| Naive UI 样式冲突 | 高 | 中 | 使用 `!important` 或更高优先级选择器 |
| 响应式断点不一致 | 中 | 中 | 保持原有断点，仅更新样式 |
| 性能影响 | 低 | 低 | Tailwind JIT 模式优化 |
| 回归问题 | 中 | 高 | 逐页面验证 |

## Migration Plan

### Phase 1: 基础设施 (P0)
1. 安装 Tailwind CSS 及依赖
2. 创建 `tailwind.config.js`
3. 配置 PostCSS
4. 创建新的 `src/index.css` 基础样式

### Phase 2: 全局样式迁移 (P1)
1. 更新 body/html 样式
2. 迁移 CSS 变量到 Tailwind 配置
3. 添加流光动画 CSS
4. 更新滚动条样式

### Phase 3: 组件样式迁移 (P2)
1. 更新卡片组件样式
2. 更新按钮组件样式
3. 更新输入框组件样式
4. 更新导航/布局样式

### Phase 4: 视图页面迁移 (P3)
1. AudioView
2. ImageView
3. VideoView
4. TTSView
5. RealtimeView
6. ModerationView
7. SettingsView

### Phase 5: 清理 (P4)
1. 删除旧的 `glass.css`
2. 删除旧的 `responsive.css`
3. 清理未使用的 CSS

## Open Questions

1. **是否保留明暗主题切换?**
   - `ai-foundry-manager` 支持 dark/light/system 三种模式
   - 当前项目也有此功能，需要确认是否保留

2. **Naive UI 主题同步**
   - 如何让 Naive UI 的主题与 Tailwind 配色保持同步？
   - 可能需要使用 `useThemeVars` composable
