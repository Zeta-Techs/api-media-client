# Rename Default Providers

## Status
IMPLEMENTED

## Why
统一品牌命名，将内置的两个提供商从 "Zeta API" 和 "Zeta Enterprise" 更名为 "ZetaTechs API" 和 "ZetaTechs Enterprise"，以保持与公司品牌名称的一致性。

## What Changes
- 修改默认提供商预设的 `name` 字段
- "Zeta API" → "ZetaTechs API"
- "Zeta Enterprise" → "ZetaTechs Enterprise"

## Scope
- `src/stores/config.ts` - 修改 `defaultPresets` 数组中的 `name` 值

## Risk
LOW - 仅修改显示名称，不影响功能逻辑或 API 端点
