# Change: Add GPT Responses Image Generation

## Why
The GPT-Image page currently supports only the Image API generation and edit endpoints. It does not expose the Responses API image generation tool or support multi-turn image follow-ups within the current page.

## What Changes
- Add a Responses API generation mode to the GPT-Image generate flow.
- Use `gpt-5.4` with the `image_generation` tool for Responses API image generation.
- Support page-local multi-turn continuation via `previous_response_id`.
- Keep GPT-Image edit mode on the existing Image API path.

## Impact
- Affected specs: `image-generation`
- Affected code:
  - `src/views/ImageView.vue`
  - `src/types/index.ts`
  - `src/locales/zh-CN.json`
  - `src/locales/en-US.json`
