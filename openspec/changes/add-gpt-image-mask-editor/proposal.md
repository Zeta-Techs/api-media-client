# Change: Add GPT-Image Visual Mask Editor

## Why
GPT-Image edit mode currently requires users to upload a separate mask PNG, which interrupts the editing flow and requires external image-editing software.

## What Changes
- Add an in-page visual mask editor for uploaded GPT-Image reference images.
- Use the first uploaded reference image as the mask target, matching GPT Image mask behavior for multi-image edits.
- Generate an alpha-channel PNG mask from the user's drawn edit region and submit it through the existing `/v1/images/edits` request.
- Keep the existing mask PNG upload as a fallback path.

## Impact
- Affected specs: `image-generation`
- Affected code:
  - `src/views/ImageView.vue`
  - `src/locales/zh-CN.json`
  - `src/locales/en-US.json`
