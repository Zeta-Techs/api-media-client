# Project Context

## Purpose
A client-side media console for interacting with AI media APIs through a unified UI. Core user flows include:
- **Image generation** (Nano Banana/GPT-Image/Flux)
- **Video generation**
- **Audio transcription**
- **Text-to-speech (TTS)**
- **Realtime voice conversation/transcription**
- **Content moderation**
- **History and settings management**

Supports both single-item and batch processing workflows, with cloud storage integration (S3, WebDAV) for results.

## Tech Stack
- **Framework**: Vue 3.4 (`<script setup>`, Composition API)
- **Language**: TypeScript 5.4 with strict compiler checks
- **Build/Dev**: Vite 5.1
- **State Management**: Pinia 2.1
- **UI**: Naive UI 2.38
- **Styling**: Tailwind CSS 3.4 + custom CSS in `src/index.css`
- **Routing**: Vue Router 4.3 with hash history
- **i18n**: Vue I18n 9.10 (`zh-CN`, `en-US`)
- **Utilities**: JSZip (batch export), browser Fetch/WebSocket APIs

## Development Commands
- `npm run dev` - start local Vite dev server (default port 5173)
- `npm run build` - run `vue-tsc` then production build
- `npm run preview` - preview built `dist/` output

## Project Conventions

### Code Style
- **Components**: PascalCase filenames (`ImageView.vue`, `BatchTaskList.vue`)
- **Composables**: `useXxx` camelCase naming in `src/composables/`
- **Stores**: Pinia setup-store files in `src/stores/`
- **Path alias**: `@/` -> `src/`
- **Type safety**: keep strict typing; avoid unused locals/parameters
- **Locales**: keep `src/locales/zh-CN.json` and `src/locales/en-US.json` aligned for new UI strings

### Architecture Patterns
- **View-based routing**: one feature-focused page per route in `src/views/`
- **Composable-first logic reuse**: API, retry, form persistence, uploads, and queue helpers in composables
- **Batch module split**: reusable batch panels and controls in `src/components/batch/`
- **Storage abstraction**: provider adapters in `src/services/storage/` (`s3.ts`, `webdav.ts`)
- **State persistence**: user config/history/storage persisted in localStorage-backed stores
- **Lazy-loaded pages**: route components loaded via dynamic imports

### Testing Strategy
- No standalone unit/integration test framework currently configured
- Main quality gate is TypeScript validation via `vue-tsc` during `npm run build`
- For OpenSpec changes, always run `openspec validate <change-id> --strict`

### Git Workflow
- Main branch: `main`
- Commit style: Imperative mood, descriptive summaries
- Keep unrelated local changes intact; avoid destructive history edits

### OpenSpec Workflow Conventions
- Specs in `openspec/specs/` are the source of truth for shipped behavior
- Proposed changes live in `openspec/changes/<change-id>/`
- `change-id` must be unique, kebab-case, and verb-led (`add-`, `update-`, `remove-`, `refactor-`)
- Proposal files should include `proposal.md`, `tasks.md`, and spec deltas under `specs/<capability>/spec.md`
- Use `## ADDED|MODIFIED|REMOVED|RENAMED Requirements` with at least one `#### Scenario:` per requirement

## Domain Context
- **Provider presets**: users switch between API endpoints/keys via settings
- **Batch mode**: users can enqueue prompts/files with concurrency + retry
- **Cloud upload**: batch results can auto-upload to active S3/WebDAV target
- **History tracking**: completed operations are stored and displayed to users
- **Bilingual UX**: Chinese and English are both first-class
- **Responsive UI**: mobile drawer/menu and adaptive layout are required

## Important Constraints
- Client-side only (SPA, no SSR)
- Relies on external API endpoints for actual media processing
- LocalStorage used for config persistence
- Uses hash routing for static hosting compatibility
- API credentials are stored in browser storage (no backend secret management)

## External Dependencies
- **AI media APIs**: OpenAI-compatible and Gemini-style endpoints for generation/moderation/realtime
- **Cloud storage endpoints**: S3-compatible services and WebDAV servers
