## MODIFIED Requirements

### Requirement: Model Selection

The system SHALL provide model selection for each image generation provider.

#### Scenario: Gemini model selection
- **WHEN** user accesses Gemini image generation in AI Studio or Vertex format
- **THEN** system offers models: gemini-3-pro-image-preview, gemini-2.5-flash-image
- **AND** does not include gemini-3-pro-image-preview-flatfee in preset options
- **AND** allows custom model name input

#### Scenario: GPT-Image model selection
- **WHEN** user accesses GPT-Image generation
- **THEN** system offers models: gpt-image-1, dall-e-3, dall-e-2
- **AND** allows custom model name input

#### Scenario: Flux model selection
- **WHEN** user accesses Flux generation
- **THEN** system offers models: flux-kontext-pro, flux-kontext-max
- **AND** allows custom model name input
