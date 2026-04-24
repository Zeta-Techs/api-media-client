## 1. Specification
- [x] 1.1 Add image-generation spec delta for GPT Responses API image editing

## 2. Frontend
- [x] 2.1 Add Responses API selection and state handling to GPT edit mode
- [x] 2.2 Support Responses edit inputs from uploaded files, image URLs, and file IDs
- [x] 2.3 Reuse the visual mask editor to produce Responses-compatible mask input for the first image
- [x] 2.4 Support page-local multi-turn Responses editing and image ID continuation
- [x] 2.5 Support streaming Responses edit requests with non-stream fallback
- [x] 2.6 Update localized strings and history metadata for Responses edit mode

## 3. Validation
- [ ] 3.1 Run `openspec validate add-gpt-responses-image-editing --strict`
- [x] 3.2 Run `vue-tsc --noEmit`
- [x] 3.3 Run `vite build`
