# Change: Remove flatfee Gemini image model from Nano Banana presets

## Why
`gemini-3-pro-image-preview-flatfee` should no longer be offered in the Nano Banana model presets. Keeping it in the default list creates a mismatch with the intended supported models for both Gemini AI Studio and Gemini Vertex formats.

## What Changes
- Remove `gemini-3-pro-image-preview-flatfee` from Nano Banana model presets.
- Keep `gemini-3-pro-image-preview` and `gemini-2.5-flash-image` available by default.
- Apply the same model availability behavior for both AI Studio and Vertex formats.

## Impact
- Affected specs: `image-generation`
- Affected code: `src/views/ImageView.vue`, `src/config/models.ts`
- User impact: users will no longer see or select the removed flatfee preset unless entered manually as a custom model.
