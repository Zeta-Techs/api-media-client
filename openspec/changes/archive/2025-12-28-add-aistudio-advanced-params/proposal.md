# Change: Add Advanced Parameters to AI Studio Image Generation

## Why
The Gemini AI Studio format currently lacks advanced configuration options that are available in the Vertex format. Users need finer control over image generation, including aspect ratio, temperature, and token limits, as well as the ability to toggle Google Search grounding.

## What Changes
- Add `aspectRatio` parameter to AI Studio format (matching Vertex options: 1:1, 3:2, 2:3, 4:3, 3:4, 4:5, 5:4, 9:16, 16:9, 9:21, 21:9)
- Add `googleSearch` toggle to enable/disable Google Search grounding
- Add `temperature` slider (0-1, default 1)
- Add `topP` slider (0-1, default 0.95)
- Add `maxOutputTokens` input (1-32768, default 32768)
- Add `stopSequences` input for stop sequences (default empty array)
- Add clickable link on provider preset status indicator to navigate to Settings page

## Impact
- Affected specs: `image-generation`, `provider-management`
- Affected code:
  - `src/views/ImageView.vue` - Form state, UI components, and submit handler
  - `src/types/index.ts` - `GeminiAIStudioFormData` type definition
  - `src/locales/zh-CN.json` - Chinese translations for new labels
  - `src/locales/en-US.json` - English translations for new labels
