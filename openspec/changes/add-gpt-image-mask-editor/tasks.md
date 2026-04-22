## 1. Specification
- [x] 1.1 Add image-generation spec delta for visual mask editing.

## 2. GPT-Image UI
- [x] 2.1 Add visual mask editor state and Canvas helpers.
- [x] 2.2 Add mask editor controls for brush, eraser, pan, zoom, undo, redo, clear, invert, fill, fit, reset, and download.
- [x] 2.3 Preserve manual mask PNG upload as a fallback.

## 3. Request Handling
- [x] 3.1 Export drawn mask as an alpha-channel PNG matching the first reference image dimensions.
- [x] 3.2 Submit generated mask when drawn, otherwise submit fallback uploaded mask when present.

## 4. Localization
- [x] 4.1 Add Chinese mask editor copy.
- [x] 4.2 Add English mask editor copy.

## 5. Validation
- [ ] 5.1 Run OpenSpec validation if CLI is available. Blocked: `openspec` CLI is not available in PATH.
- [x] 5.2 Run `npm run build`.
