## 1. Specification
- [x] 1.1 Add image-generation spec delta for GPT Responses API generation and multi-turn continuation

## 2. Frontend
- [x] 2.1 Add GPT generate-mode API selection state and page-local Responses conversation state
- [x] 2.2 Implement `/v1/responses` request construction and `image_generation_call` response parsing
- [x] 2.3 Update GPT-Image form and preview UI for Responses API mode and conversation controls
- [x] 2.4 Extend history/type metadata for Responses API generations
- [x] 2.5 Add localized strings for Responses API mode, conversation status, and new error cases

## 3. Validation
- [ ] 3.1 Run `openspec validate add-gpt-responses-image-generation --strict`
- [x] 3.2 Run `vue-tsc --noEmit`
- [x] 3.3 Run `vite build`
