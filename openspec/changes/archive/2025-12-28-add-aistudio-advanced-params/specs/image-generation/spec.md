## MODIFIED Requirements

### Requirement: Multi-Provider Image Generation

The system SHALL support image generation through multiple AI model providers with distinct API formats.

#### Scenario: Gemini AI Studio image generation
- **WHEN** user selects Gemini AI Studio format and provides a prompt
- **THEN** system calls the Gemini generateContent API with IMAGE response modality
- **AND** applies user-configured aspect ratio (auto, 1:1, 3:2, 2:3, 4:3, 3:4, 4:5, 5:4, 9:16, 16:9, 9:21, 21:9)
- **AND** applies Google Search grounding if enabled
- **AND** applies generation config (temperature, topP, maxOutputTokens)
- **AND** applies stop sequences if specified
- **AND** returns the generated image as base64 data

### Requirement: Advanced Generation Parameters

The system SHALL support advanced parameters for fine-tuning generation.

#### Scenario: Gemini AI Studio parameters
- **WHEN** user configures AI Studio format generation
- **THEN** system offers aspect ratio selection matching Vertex options (auto, 1:1, 3:2, 2:3, 4:3, 3:4, 4:5, 5:4, 9:16, 16:9, 9:21, 21:9)
- **AND** Google Search grounding toggle (default enabled)
- **AND** temperature control (0-1, default 1)
- **AND** topP control (0-1, default 0.95)
- **AND** maxOutputTokens (1-32768, default 32768)
- **AND** stop sequences input (default empty)
