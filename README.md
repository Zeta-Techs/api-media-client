# Media Client

A unified web application for interacting with AI/ML media APIs. Provides an intuitive interface for generating, processing, and moderating media content using various AI models.

## Features

### Media Generation & Processing

- **Image Generation** - Create AI-powered images using models like DALL-E, GPT Image, and Flux Kontext
- **Video Generation** - Generate AI videos with Sora and other video synthesis models
- **Audio Transcription** - Convert speech to text using Whisper and GPT-4o with support for:
  - Word-level timestamps for synchronized subtitles
  - Speaker diarization (speaker separation)
  - Multiple output formats (JSON, VTT, SRT, text)
- **Text-to-Speech (TTS)** - Convert text to natural-sounding speech with customizable voices and styles
- **Realtime Voice Conversation** - Live voice interaction with AI through WebSocket connections
  - Two modes: conversation and real-time transcription
  - Voice Activity Detection (VAD) support
  - Fullscreen subtitle display with translation

### Content Management

- **Content Moderation** - Analyze text and images for potentially harmful content using AI moderation APIs
- **Batch Processing** - Queue and process multiple items simultaneously with:
  - Configurable concurrency
  - Progress tracking
  - Automatic retry on failure
  - Export results to ZIP
- **Cloud Storage Integration** - Upload results to cloud storage:
  - S3-compatible services
  - WebDAV servers
  - Automatic upload after batch completion

### Additional Features

- **Bilingual Interface** - Full support for Chinese (zh-CN) and English (en-US)
- **Dark/Light Theme** - Toggle between dark and light modes
- **Provider Presets** - Manage multiple API provider configurations
- **Processing History** - Track and review all media generation history
- **Mobile Responsive** - Optimized UI for mobile and desktop devices

## Tech Stack

- **Frontend Framework**: Vue 3.4 (Composition API with `<script setup>`)
- **Language**: TypeScript 5.4 (strict mode)
- **Build Tool**: Vite 5.1
- **State Management**: Pinia 2.1
- **UI Library**: Naive UI 2.38
- **Styling**: Tailwind CSS 3.4
- **Routing**: Vue Router 4.3 (hash history)
- **Internationalization**: Vue I18n 9.10
- **Icons**: @vicons/ionicons5
- **Utilities**: JSZip 3.10 (batch export)

## Installation

### Prerequisites

- Node.js 16+ (recommended: Node.js 18 or later)
- npm or yarn

### Setup

1. Clone the repository:
```bash
git clone <repository-url>
cd api-media-client
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

4. Open your browser and navigate to the URL shown in the terminal (typically `http://localhost:5173`)

## Configuration

### Provider Presets

The application uses provider presets to manage API configurations:

1. Click the **Settings** icon (gear) in the navigation bar
2. Go to the **Provider Presets** tab
3. Click **Add Preset** to create a new configuration:
   - **Name**: A friendly name for the preset (e.g., "OpenAI Production")
   - **Base URL**: The API endpoint URL
   - **API Key**: Your API key for authentication

You can create multiple presets and switch between them using the settings popover (hover over the settings icon).

### Cloud Storage (Optional)

To enable automatic upload of batch processing results:

1. Navigate to **Settings** → **Cloud Storage**
2. Click **Add Storage** and configure:
   - **Name**: Friendly name for the storage service
   - **Type**: S3 or WebDAV
   - **Endpoint/URL**: Storage service URL
   - **Credentials**: Access key, secret key, bucket name (S3) or username/password (WebDAV)
3. Click **Test Connection** to verify the configuration
4. Set as active to use for batch uploads

## Usage

### Single Mode

Process individual items one at a time:

1. Select a feature from the navigation menu (Image, Video, Audio, etc.)
2. Fill in the required parameters (prompt, model, settings)
3. Click the generate/process button
4. View results and download if needed

### Batch Mode

Process multiple items simultaneously:

1. Navigate to any feature that supports batch processing
2. Click the **Batch Mode** toggle switch
3. Enter inputs (one per line):
   - For text-based features: enter prompts or text content
   - For audio transcription: upload multiple audio files
4. Click **Add to Queue**
5. Configure concurrency settings if needed
6. Click **Start** to begin processing
7. Monitor progress and export results when complete

### Provider Management

Quick switch between API providers:

1. Hover over the **Settings** icon in the navigation
2. A popover shows all configured presets
3. Click on a preset to activate it
4. The checkmark indicates the currently active preset

## Development

### Available Scripts

```bash
# Start development server with hot reload
npm run dev

# Build for production (includes TypeScript checking)
npm run build

# Preview production build locally
npm run preview
```

### Project Structure

```
src/
├── components/        # Reusable Vue components
│   └── batch/        # Batch processing components
├── composables/      # Composition API reusable logic
├── locales/          # i18n translation files
├── router/           # Vue Router configuration
├── services/         # Service layer (cloud storage, etc.)
├── stores/           # Pinia state management
│   ├── config.ts    # Provider presets and theme
│   ├── history.ts   # Processing history
│   └── storage.ts   # Cloud storage configuration
├── types/            # TypeScript type definitions
├── views/            # Page-level components
│   ├── ImageView.vue
│   ├── VideoView.vue
│   ├── AudioView.vue
│   ├── TTSView.vue
│   ├── RealtimeView.vue
│   ├── ModerationView.vue
│   ├── HistoryView.vue
│   └── SettingsView.vue
├── App.vue           # Root component
└── main.ts           # Application entry point
```

### Architecture Patterns

- **Composables Pattern**: Reusable logic extracted to `src/composables/` (e.g., `useApi.ts`, `useBatchQueue.ts`)
- **View-Based Routing**: Each feature has a dedicated view component
- **Centralized State**: Pinia stores for config, history, and storage
- **Service Layer**: Cloud storage providers abstracted in `src/services/storage/`
- **Lazy Loading**: Route components loaded dynamically for better performance

### Code Conventions

- **Component files**: PascalCase (`AudioView.vue`, `BatchTaskList.vue`)
- **Composables**: `use` prefix, camelCase (`useApi.ts`, `useBatchQueue.ts`)
- **Stores**: camelCase (`config.ts`, `history.ts`, `storage.ts`)
- **Path alias**: `@/` maps to `src/`
- **TypeScript**: Strict mode enabled

## Building for Production

```bash
npm run build
```

The built files will be output to the `dist/` directory. Deploy this directory to any static file hosting service.

### Deployment Notes

- The application is a client-side SPA (Single Page Application)
- Uses hash-based routing (`/#/`) for compatibility with static hosting
- Requires external API endpoints for media processing functionality
- Configuration (API keys, presets) stored in browser localStorage

## Browser Compatibility

- Modern browsers with ES2020+ support
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Notes

- This is a client-side application that requires external AI/ML API services
- API keys and credentials are stored locally in your browser
- Cloud storage configuration may require CORS setup on the storage service
- Audio features require microphone permissions for realtime conversation
