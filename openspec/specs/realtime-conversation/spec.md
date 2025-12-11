# Realtime Conversation

WebSocket-based real-time voice conversation and transcription capability.

## Requirements

### Requirement: Dual Mode Operation

The system SHALL support two distinct operation modes.

#### Scenario: Conversation mode
- **WHEN** user selects conversation mode
- **THEN** system enables full voice chat with AI
- **AND** captures user speech, sends to AI, plays AI responses
- **AND** displays conversation history and live transcripts

#### Scenario: Transcription mode
- **WHEN** user selects transcription mode
- **THEN** system only captures and transcribes user speech
- **AND** does not generate AI responses
- **AND** displays live subtitle transcription

### Requirement: WebSocket Connection

The system SHALL manage WebSocket connections to the Realtime API.

#### Scenario: Connect to API
- **WHEN** user clicks connect with valid API key
- **THEN** system establishes WebSocket connection to /v1/realtime
- **AND** uses subprotocols: realtime, openai-insecure-api-key.{key}, openai-beta.realtime-v1
- **AND** displays connection status

#### Scenario: Connection failure
- **WHEN** WebSocket connection fails or closes abnormally
- **THEN** system displays error message with details
- **AND** cleans up audio resources

### Requirement: Model Selection

The system SHALL provide model selection for realtime conversation.

#### Scenario: Model options
- **WHEN** user accesses realtime feature
- **THEN** system offers models: gpt-realtime, gpt-realtime-mini, gpt-4o-realtime-preview, gpt-4o-mini-realtime-preview
- **AND** allows custom model name input

### Requirement: Voice Activity Detection (VAD)

The system SHALL support configurable voice activity detection.

#### Scenario: VAD enabled
- **WHEN** VAD is enabled
- **THEN** system uses server-side VAD to detect speech
- **AND** automatically commits audio buffer when speech ends
- **AND** automatically triggers AI response in conversation mode

#### Scenario: VAD configuration
- **WHEN** user configures VAD settings
- **THEN** system offers threshold control (0-1)
- **AND** applies settings via session.update message

#### Scenario: VAD disabled
- **WHEN** VAD is disabled
- **THEN** user must manually click Send/Commit button
- **AND** system does not auto-detect speech boundaries

### Requirement: Language Configuration

The system SHALL support language specification for transcription.

#### Scenario: Language selection
- **WHEN** user selects a language
- **THEN** system sets input_audio_transcription.language in session config

#### Scenario: Chinese language variants
- **WHEN** user selects zh-CN (Simplified Chinese)
- **THEN** system sends language 'zh' to API
- **AND** adds prompt hint for simplified output
- **AND** in conversation mode, adds instruction for AI to respond in simplified Chinese

#### Scenario: Auto language detection
- **WHEN** user selects auto language
- **THEN** system omits language parameter
- **AND** relies on Whisper to auto-detect

### Requirement: Voice Selection

The system SHALL provide voice selection for AI responses in conversation mode.

#### Scenario: Voice options
- **WHEN** user is in conversation mode
- **THEN** system offers voices: Alloy, Ash, Ballad, Coral, Echo, Sage, Shimmer, Verse
- **AND** applies selected voice to session config

### Requirement: Audio Capture

The system SHALL capture microphone audio for transmission.

#### Scenario: Audio initialization
- **WHEN** connection is established
- **THEN** system requests microphone access
- **AND** creates AudioContext at 24000Hz sample rate
- **AND** enables echo cancellation and noise suppression

#### Scenario: Audio processing
- **WHEN** audio is captured
- **THEN** system converts to PCM16 format
- **AND** sends as base64 via input_audio_buffer.append messages

### Requirement: Audio Playback

The system SHALL play AI audio responses in conversation mode.

#### Scenario: Audio response handling
- **WHEN** response.audio.delta event is received
- **AND** mode is conversation
- **THEN** system decodes base64 audio data
- **AND** queues for sequential playback
- **AND** converts PCM16 to Float32 for Web Audio API

### Requirement: Transcription Display

The system SHALL display live transcription with timestamps.

#### Scenario: Streaming transcription
- **WHEN** transcription delta events are received
- **THEN** system displays partial text with typing cursor
- **AND** updates to final text when completed

#### Scenario: Transcript history
- **WHEN** transcription completes
- **THEN** system adds entry with timestamp to transcript list
- **AND** marks AI responses with [AI] prefix
- **AND** auto-scrolls to latest entry (if enabled)

### Requirement: Conversation History

The system SHALL display conversation messages in conversation mode.

#### Scenario: Message display
- **WHEN** messages are exchanged
- **THEN** system displays user and assistant messages with timestamps
- **AND** styles user messages on right, assistant on left
- **AND** shows streaming indicator during AI response

### Requirement: Session Instructions

The system SHALL support custom instructions for AI behavior.

#### Scenario: Instructions input
- **WHEN** user is in conversation mode
- **AND** enters instructions
- **THEN** instructions are included in session.update
- **AND** combined with any language-specific instructions

### Requirement: Export Functionality

The system SHALL support exporting transcripts.

#### Scenario: Export as text
- **WHEN** user clicks TXT export button
- **THEN** system generates text file with timestamps and content
- **AND** downloads as transcript-{timestamp}.txt

#### Scenario: Export as SRT
- **WHEN** user clicks SRT export button
- **THEN** system generates SRT subtitle format
- **AND** estimates 3-second duration per entry
- **AND** downloads as transcript-{timestamp}.srt

### Requirement: Fullscreen Subtitle Display

The system SHALL support fullscreen subtitle viewing.

#### Scenario: Fullscreen mode
- **WHEN** user clicks fullscreen button
- **THEN** system displays FullscreenSubtitle component
- **AND** shows large subtitle text with translation support
- **AND** maintains sync with live transcripts

### Requirement: Status Indicators

The system SHALL display connection and activity status.

#### Scenario: Connection status
- **WHEN** connection state changes
- **THEN** system displays colored dot (gray: disconnected, green: connected, amber: connecting)

#### Scenario: Activity indicators
- **WHEN** speech is detected
- **THEN** system shows red "listening" indicator
- **AND** in conversation mode shows blue "speaking" during AI response

### Requirement: Resource Cleanup

The system SHALL properly clean up resources on disconnect.

#### Scenario: Cleanup on disconnect
- **WHEN** user disconnects or component unmounts
- **THEN** system closes WebSocket with code 1000
- **AND** stops all media stream tracks
- **AND** closes AudioContext
- **AND** clears audio queue

### Requirement: Auto-Scroll Control

The system SHALL support toggling auto-scroll behavior.

#### Scenario: Auto-scroll toggle
- **WHEN** user toggles auto-scroll button
- **THEN** system enables/disables automatic scrolling to latest transcript
- **AND** displays current state visually
