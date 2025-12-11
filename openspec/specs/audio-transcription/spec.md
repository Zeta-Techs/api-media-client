# Audio Transcription

Speech-to-text transcription capability with synchronized subtitle display and speaker diarization.

## Requirements

### Requirement: Audio File Transcription

The system SHALL support transcribing audio files through multiple model providers.

#### Scenario: Standard transcription
- **WHEN** user uploads an audio file and submits transcription
- **THEN** system calls POST /v1/audio/transcriptions with file and model parameters
- **AND** returns transcription text in the selected format

#### Scenario: Supported audio formats
- **WHEN** user uploads an audio file
- **THEN** system accepts formats: FLAC, MP3, MP4, MPEG, M4A, OGG, WAV, WEBM
- **AND** validates file against accepted formats

### Requirement: Model Selection

The system SHALL provide model selection for transcription with varying capabilities.

#### Scenario: Whisper model selection
- **WHEN** user selects whisper-1 model
- **THEN** system enables all output formats (json, text, srt, vtt, verbose_json)
- **AND** enables timestamp granularity options
- **AND** enables prompt input

#### Scenario: GPT transcribe model selection
- **WHEN** user selects gpt-4o-transcribe or gpt-4o-mini-transcribe
- **THEN** system limits output formats to json and text
- **AND** disables timestamp granularity options
- **AND** enables prompt input

#### Scenario: Diarization model selection
- **WHEN** user selects gpt-4o-transcribe-diarize model
- **THEN** system enables diarization settings
- **AND** offers output formats: json, text, diarized_json
- **AND** disables prompt input

#### Scenario: Custom model
- **WHEN** user selects custom model option
- **THEN** system shows custom model name input field

### Requirement: Response Format Configuration

The system SHALL support multiple output formats with varying detail levels.

#### Scenario: Verbose JSON format
- **WHEN** user selects verbose_json response format
- **THEN** system enables timestamp granularity options (word, segment)
- **AND** response includes segments and optionally words with timestamps

#### Scenario: Subtitle formats
- **WHEN** user selects SRT or VTT format
- **THEN** system returns subtitle-formatted output
- **AND** download uses appropriate file extension (.srt or .vtt)

### Requirement: Timestamp Granularity

The system SHALL support configurable timestamp granularity for verbose_json output.

#### Scenario: Word-level timestamps
- **WHEN** user enables word granularity
- **AND** response format is verbose_json
- **THEN** response includes word array with start/end times for each word

#### Scenario: Segment-level timestamps
- **WHEN** user enables segment granularity
- **THEN** response includes segments array with start/end times for each segment

### Requirement: Language Configuration

The system SHALL support language specification and detection.

#### Scenario: Auto language detection
- **WHEN** user leaves language unspecified
- **THEN** system auto-detects language from audio
- **AND** response includes detected language code

#### Scenario: Chinese language variants
- **WHEN** user selects zh-CN (Simplified Chinese)
- **THEN** system sends language 'zh' to API
- **AND** adds prompt hint "请使用简体中文输出。"

#### Scenario: Traditional Chinese
- **WHEN** user selects zh-TW (Traditional Chinese)
- **THEN** system sends language 'zh' to API
- **AND** adds prompt hint "請使用繁體中文輸出。"

### Requirement: Speaker Diarization

The system SHALL support speaker diarization for identifying multiple speakers.

#### Scenario: Diarization configuration
- **WHEN** diarization model is selected
- **THEN** system shows chunking strategy options (auto, vad)
- **AND** allows configuration of known speaker names (up to 4)
- **AND** allows upload of speaker reference audio files (up to 4)

#### Scenario: VAD chunking settings
- **WHEN** user selects VAD chunking strategy
- **THEN** system shows VAD threshold control (0-1)
- **AND** shows VAD prefix padding control (0-1000ms)
- **AND** shows VAD silence duration control (100-2000ms)

#### Scenario: Diarized output
- **WHEN** transcription completes with diarization
- **THEN** segments include speaker labels
- **AND** speaker badges are color-coded in UI

### Requirement: Synchronized Audio Playback

The system SHALL provide audio playback with subtitle synchronization.

#### Scenario: Audio player display
- **WHEN** user uploads an audio file
- **THEN** system displays audio player with play/pause, progress slider
- **AND** shows current time and total duration

#### Scenario: Word-level synchronization
- **WHEN** audio plays and word timestamps are available
- **THEN** system highlights current word in real-time
- **AND** auto-scrolls to keep current word visible
- **AND** past words are visually dimmed

#### Scenario: Segment-level synchronization
- **WHEN** audio plays and segment timestamps are available
- **THEN** system highlights current segment
- **AND** auto-scrolls to current segment

#### Scenario: Click to seek
- **WHEN** user clicks on a word or segment
- **THEN** audio seeks to that timestamp
- **AND** playback resumes if paused

#### Scenario: Sync toggle
- **WHEN** user toggles sync subtitles switch
- **THEN** system enables/disables auto-scrolling behavior

### Requirement: Result Display

The system SHALL display transcription results with metadata.

#### Scenario: Metadata display
- **WHEN** transcription completes
- **THEN** system shows detected language, duration, word count
- **AND** indicates if speaker labels are present

#### Scenario: Merged segment-word display
- **WHEN** both segments and words are available
- **THEN** system displays segments with inline word highlighting
- **AND** words within each segment are clickable

#### Scenario: Plain text fallback
- **WHEN** only text is available (no timestamps)
- **THEN** system displays plain text in scrollable container

### Requirement: Result Export

The system SHALL support copying and downloading transcription results.

#### Scenario: Copy to clipboard
- **WHEN** user clicks copy button
- **THEN** system copies raw result to clipboard
- **AND** shows success message

#### Scenario: Download result
- **WHEN** user clicks download button
- **THEN** system downloads file with appropriate extension
- **AND** extension matches response format (json, txt, srt, vtt)

### Requirement: Temperature Control

The system SHALL support temperature configuration for transcription.

#### Scenario: Temperature setting
- **WHEN** user adjusts temperature slider
- **THEN** value ranges from 0 to 1 in 0.1 increments
- **AND** higher values produce more creative/random output

### Requirement: Prompt Enhancement

The system SHALL support prompt input for guiding transcription.

#### Scenario: Prompt input
- **WHEN** model supports prompt
- **AND** user enters a prompt
- **THEN** prompt is included in transcription request
- **AND** can be combined with language-specific hints

### Requirement: Form State Persistence

The system SHALL persist form settings across sessions.

#### Scenario: Settings persistence
- **WHEN** user modifies transcription settings
- **THEN** system saves to localStorage under 'audio-form-settings'
- **AND** restores settings on next page load

### Requirement: History Reload

The system SHALL support reloading previous transcription results.

#### Scenario: History reload
- **WHEN** user navigates from history view with pending reload
- **THEN** system restores form parameters from history item
- **AND** displays previous transcription result if available

### Requirement: Request Cancellation

The system SHALL allow cancellation of in-progress transcription.

#### Scenario: Cancel transcription
- **WHEN** user clicks cancel during transcription
- **THEN** system aborts the fetch request via AbortController
- **AND** displays cancellation message

### Requirement: History Recording

The system SHALL record transcription operations to history.

#### Scenario: Record successful transcription
- **WHEN** transcription completes successfully
- **THEN** system adds entry to history with type 'audio', status 'completed'
- **AND** includes full result text for future reload

#### Scenario: Record failed transcription
- **WHEN** transcription fails
- **THEN** system adds entry to history with status 'failed' and error message
