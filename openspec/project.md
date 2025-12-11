# Project Context

## Purpose
A media client web application for interacting with AI/ML media APIs. Provides a unified interface for:
- **Image generation** - AI-powered image creation
- **Video generation** - AI video synthesis
- **Audio transcription** - Speech-to-text processing
- **Text-to-Speech (TTS)** - Voice synthesis
- **Realtime audio** - Live audio streaming/processing
- **Content moderation** - AI content filtering

Supports both single-item and batch processing workflows, with cloud storage integration (S3, WebDAV) for results.

## Tech Stack
- **Framework**: Vue 3.4 (Composition API with `<script setup>`)
- **Language**: TypeScript 5.4 (strict mode)
- **Build Tool**: Vite 5.1
- **State Management**: Pinia 2.1
- **UI Library**: Naive UI 2.38
- **Routing**: Vue Router 4.3 (hash history)
- **i18n**: Vue I18n 9.10 (zh-CN and en-US)
- **Icons**: @vicons/ionicons5
- **Utilities**: JSZip (batch export)

## Project Conventions

### Code Style
- **Component files**: PascalCase (`AudioView.vue`, `BatchTaskList.vue`)
- **Composables**: `use` prefix, camelCase (`useApi.ts`, `useBatchQueue.ts`)
- **Stores**: camelCase (`config.ts`, `history.ts`, `storage.ts`)
- **Path alias**: `@/` maps to `src/`
- **TypeScript**: Strict mode enabled, no unused locals/parameters

### Architecture Patterns
- **Composables pattern**: Reusable logic extracted to `src/composables/`
- **View-based routing**: Each feature has a dedicated view in `src/views/`
- **Batch components**: Batch processing UI components in `src/components/batch/`
- **Service layer**: Cloud storage providers in `src/services/storage/`
- **Centralized stores**: Config, history, and storage state in `src/stores/`
- **Lazy loading**: Route components loaded dynamically

### Testing Strategy
- No test framework currently configured
- Type checking via `vue-tsc` in build script

### Git Workflow
- Main branch: `main`
- Commit style: Imperative mood, descriptive summaries
- Examples from history:
  - "Add batch processing and cloud storage features"
  - "Refactor audio and view components, add utils"
  - "UI: mobile UI fit"

## Domain Context
- **Batch mode**: Users can queue multiple items for processing (images, audio files, etc.)
- **Cloud storage**: Results can be uploaded to S3 or WebDAV for persistence
- **History**: Processing history is tracked and viewable
- **Bilingual**: Interface supports Chinese (zh-CN) and English (en-US)
- **Responsive**: Mobile-friendly UI with dedicated responsive styles

## Important Constraints
- Client-side only (SPA, no SSR)
- Relies on external API endpoints for actual media processing
- LocalStorage used for config persistence

## External Dependencies
- **AI/ML APIs**: Backend services for image/video/audio generation and processing
- **Cloud Storage**: S3-compatible services and WebDAV servers for result storage
