# Text-to-Speech

AI-powered text-to-speech synthesis capability with multiple voices and output formats.

## Requirements

### Requirement: Speech Synthesis

The system SHALL support converting text to speech audio through the TTS API.

#### Scenario: Generate speech from text
- **WHEN** user enters text and submits TTS generation
- **THEN** system calls POST /v1/audio/speech with model, input, voice, and format parameters
- **AND** returns audio blob for playback and download

### Requirement: Model Selection

The system SHALL provide model selection for speech synthesis.

#### Scenario: Standard model selection
- **WHEN** user accesses TTS generation
- **THEN** system offers models: gpt-4o-mini-tts, tts-1, tts-1-hd
- **AND** allows custom model name input

#### Scenario: Model-specific features
- **WHEN** user selects gpt-4o-mini-tts model
- **THEN** system enables instructions field for voice guidance
- **AND** other models hide the instructions field

### Requirement: Voice Selection

The system SHALL provide multiple voice options for speech synthesis.

#### Scenario: Voice options
- **WHEN** user configures voice selection
- **THEN** system offers voices: Alloy, Ash, Ballad, Coral, Echo, Fable, Nova, Onyx, Sage, Shimmer
- **AND** selected voice is applied to synthesis request

### Requirement: Output Format Configuration

The system SHALL support multiple audio output formats.

#### Scenario: Format selection
- **WHEN** user configures output format
- **THEN** system offers formats: MP3, Opus, AAC, FLAC, WAV, PCM
- **AND** response_format parameter is set accordingly

### Requirement: Speed Control

The system SHALL support playback speed adjustment.

#### Scenario: Speed configuration
- **WHEN** user adjusts speed slider
- **THEN** value ranges from 0.25x to 4.0x in 0.05 increments
- **AND** speed parameter is included in request if not 1.0

### Requirement: Voice Instructions

The system SHALL support custom instructions for advanced voice control.

#### Scenario: Instructions input
- **WHEN** gpt-4o-mini-tts model is selected
- **AND** user enters instructions
- **THEN** instructions are included in synthesis request
- **AND** can guide voice style, emotion, or pronunciation

### Requirement: Input Text Limits

The system SHALL enforce text input constraints.

#### Scenario: Text length limit
- **WHEN** user enters text for synthesis
- **THEN** system limits input to 4096 characters
- **AND** displays character count

### Requirement: Audio Playback

The system SHALL provide audio playback controls.

#### Scenario: Audio player display
- **WHEN** speech synthesis completes
- **THEN** system displays audio player with play/pause button
- **AND** shows progress slider with current time and duration
- **AND** displays voice, format, and speed tags

#### Scenario: Seek functionality
- **WHEN** user adjusts progress slider
- **THEN** audio seeks to selected position

### Requirement: Audio Download

The system SHALL support downloading generated audio.

#### Scenario: Download audio
- **WHEN** user clicks download button
- **THEN** system downloads audio file with pattern: speech-{timestamp}.{ext}
- **AND** extension matches selected format (pcm downloads as .raw)

### Requirement: Form State Persistence

The system SHALL persist form settings across sessions.

#### Scenario: Settings persistence
- **WHEN** user modifies TTS settings
- **THEN** system saves model, customModel, voice, responseFormat, speed to localStorage
- **AND** restores settings on next page load

### Requirement: Request Cancellation

The system SHALL allow cancellation of in-progress synthesis.

#### Scenario: Cancel synthesis
- **WHEN** user clicks cancel during synthesis
- **THEN** system aborts the fetch request via AbortController
- **AND** displays cancellation message

### Requirement: Resource Cleanup

The system SHALL properly clean up audio resources.

#### Scenario: Audio URL cleanup
- **WHEN** new synthesis starts or component unmounts
- **THEN** system revokes previous audio blob URL
- **AND** aborts any pending request
