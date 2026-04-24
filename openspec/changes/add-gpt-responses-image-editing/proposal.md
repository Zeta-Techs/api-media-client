# Change: Add GPT Responses Image Editing

## Why
The GPT image page currently limits edit mode to the Image API `/v1/images/edits` flow. The OpenAI image generation guide also supports image editing through the Responses API `image_generation` tool, including conversational follow-up edits, image-in-context editing, mask-guided edits, and multiple input-image formats.

## What Changes
- Add a Responses API edit mode to the GPT image edit flow.
- Support Responses image-edit inputs from uploaded files, image URLs, and explicit file IDs.
- Reuse the existing visual mask editor by exporting a Responses-compatible mask input that applies to the first input image.
- Support page-local multi-turn Responses editing with `previous_response_id` and image generation call IDs where appropriate.
- Support streaming Responses edit requests with non-stream fallback, aligned with the current gpt-5.4 generation path.

## Impact
- Affected specs: `image-generation`
- Affected code:
  - `src/views/ImageView.vue`
  - `src/types/index.ts`
  - `src/locales/zh-CN.json`
  - `src/locales/en-US.json`
