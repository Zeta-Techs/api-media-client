## 1. Type Definitions
- [x] 1.1 Update `GeminiAIStudioFormData` interface in `src/types/index.ts` to include new fields: `aspectRatio`, `googleSearch`, `temperature`, `topP`, `maxOutputTokens`, `stopSequences`

## 2. Localization
- [x] 2.1 Add Chinese translations for `googleSearch`, `stopSequences` labels in `src/locales/zh-CN.json`
- [x] 2.2 Add English translations for `googleSearch`, `stopSequences` labels in `src/locales/en-US.json`

## 3. ImageView AI Studio Form
- [x] 3.1 Add state fields to `formAI` ref: `aspectRatio` (default 'auto'), `googleSearch` (default true), `temperature` (default 1), `topP` (default 0.95), `maxOutputTokens` (default 32768), `stopSequences` (default [])
- [x] 3.2 Add UI controls for new parameters: aspect ratio select, google search switch, temperature slider, topP slider, maxOutputTokens input, stopSequences text input
- [x] 3.3 Update `handleSubmitAI` function to include new parameters in API request

## 4. Provider Preset Quick Link
- [x] 4.1 Add router-link/navigation button next to provider preset status tag to go to Settings page
- [x] 4.2 Apply consistent style across all views that show the provider preset selector

## 5. Validation
- [x] 5.1 Run type-check to ensure no TypeScript errors
- [x] 5.2 Manual test AI Studio form with new parameters
