# Image Generation

## Purpose

AI-powered image generation capability supporting multiple model providers and formats.
## Requirements
### Requirement: Multi-Provider Image Generation

The system SHALL support image generation through multiple AI model providers with distinct API formats.

#### Scenario: Gemini AI Studio image generation
- **WHEN** user selects Gemini AI Studio format and provides a prompt
- **THEN** system calls the Gemini generateContent API with IMAGE response modality
- **AND** returns the generated image as base64 data

#### Scenario: Gemini Vertex image generation
- **WHEN** user selects Gemini Vertex format and provides a prompt
- **THEN** system calls the Gemini API with extended configuration (temperature, topP, personGeneration)
- **AND** applies safety settings for content filtering

#### Scenario: GPT-Image generation
- **WHEN** user selects GPT-Image tab and provides a prompt
- **THEN** system calls OpenAI-compatible /v1/images/generations endpoint
- **AND** supports `gpt-image-2`, `gpt-image-1`, `dall-e-3`, and `dall-e-2`
- **AND** supports multiple output images (n parameter)

#### Scenario: Flux image generation
- **WHEN** user selects Flux tab and provides a prompt
- **THEN** system calls Flux API with aspect ratio and safety tolerance settings
- **AND** supports input image for image-to-image generation

### Requirement: Model Selection

The system SHALL provide model selection for each image generation provider.

#### Scenario: Gemini model selection
- **WHEN** user accesses Gemini image generation in AI Studio or Vertex format
- **THEN** system offers models: gemini-3-pro-image-preview, gemini-2.5-flash-image
- **AND** does not include gemini-3-pro-image-preview-flatfee in preset options
- **AND** allows custom model name input

#### Scenario: GPT-Image model selection
- **WHEN** user accesses GPT-Image generation
- **THEN** system offers models: gpt-image-2, gpt-image-1, dall-e-3, dall-e-2
- **AND** allows custom model name input

#### Scenario: Flux model selection
- **WHEN** user accesses Flux generation
- **THEN** system offers models: flux-kontext-pro, flux-kontext-max
- **AND** allows custom model name input

### Requirement: Image Size and Format Configuration

The system SHALL allow configuration of output image dimensions and format.

#### Scenario: GPT-Image size options
- **WHEN** user selects gpt-image-2 model
- **THEN** system offers preset sizes: auto, 1024x1024, 1536x1024, 1024x1536, 2048x2048, 2048x1152, 3840x2160, 2160x3840
- **AND** supports custom sizes that are multiples of 16, max edge 3840, max ratio 3:1, and between 655,360 and 8,294,400 total pixels
- **AND** gpt-image-1 offers sizes: 1024x1024, 1536x1024, 1024x1536, auto
- **AND** dall-e-3 offers: 1024x1024, 1792x1024, 1024x1792
- **AND** dall-e-2 offers: 256x256, 512x512, 1024x1024

#### Scenario: Gemini size options
- **WHEN** user configures Gemini image generation
- **THEN** system offers image sizes: 1K, 2K, 4K
- **AND** Vertex format offers aspect ratios: 1:1, 3:2, 2:3, 4:3, 3:4, 16:9, 9:16, etc.

#### Scenario: Output format selection
- **WHEN** user configures output format
- **THEN** GPT-Image offers: PNG, JPEG, WebP
- **AND** Flux offers: PNG, JPG
- **AND** Gemini Vertex offers: image/png, image/jpeg

### Requirement: Reference Image Support

The system SHALL support reference images for guided generation and editing.

#### Scenario: Gemini reference images
- **WHEN** user uploads reference images for Gemini generation
- **THEN** system accepts up to 9 images
- **AND** converts them to base64 inline data
- **AND** includes them in the generation request

#### Scenario: GPT-Image edit mode
- **WHEN** user enables edit mode for GPT-Image
- **THEN** system accepts reference images (up to 10) and optional mask image
- **AND** supports either uploaded files or image URLs as edit inputs
- **AND** calls /v1/images/edits endpoint

#### Scenario: Flux input image
- **WHEN** user provides input image for Flux
- **THEN** system accepts either file upload or URL
- **AND** supports match_input_image aspect ratio option

### Requirement: Advanced Generation Parameters

The system SHALL support advanced parameters for fine-tuning generation.

#### Scenario: GPT-Image quality settings
- **WHEN** user configures GPT-Image generation
- **THEN** system offers quality options: auto, low, medium, high
- **AND** background options vary by model
- **AND** gpt-image-2 supports auto and opaque backgrounds only
- **AND** gpt-image-1 supports auto, transparent, and opaque backgrounds
- **AND** compression level for JPEG/WebP (0-100)
- **AND** moderation level: auto, low

#### Scenario: Gemini Vertex parameters
- **WHEN** user configures Vertex format generation
- **THEN** system offers temperature control (0-2)
- **AND** topP control (0-1)
- **AND** maxOutputTokens (1024-32768)
- **AND** personGeneration policy: ALLOW_ALL, ALLOW_ADULT, DONT_ALLOW

#### Scenario: Flux parameters
- **WHEN** user configures Flux generation
- **THEN** system offers seed for reproducibility
- **AND** safety tolerance (0-6, strict to loose)
- **AND** prompt upsampling toggle

### Requirement: Prompt Templates

The system SHALL support reusable prompt templates for image generation.

#### Scenario: Apply prompt template
- **WHEN** user selects a prompt template
- **THEN** system populates the prompt field with template content
- **AND** template is filtered by image type

### Requirement: Result Display and Download

The system SHALL display generated images and allow download.

#### Scenario: Single image result
- **WHEN** generation completes with one image (Gemini, Flux)
- **THEN** system displays image with dimensions, size, and type info
- **AND** provides download button with appropriate extension

#### Scenario: Multiple image result
- **WHEN** GPT-Image generates multiple images (n > 1)
- **THEN** system displays images in a grid layout
- **AND** each image has individual download option
- **AND** clicking opens lightbox view

#### Scenario: Batch GPT-Image result
- **WHEN** user runs batch GPT-Image generation
- **THEN** each prompt produces exactly one result image
- **AND** batch export uses the selected output format extension

#### Scenario: Revised prompt display
- **WHEN** GPT-Image returns revised_prompt
- **THEN** system displays the revised prompt in an info alert

### Requirement: Request Cancellation

The system SHALL allow cancellation of in-progress generation requests.

#### Scenario: Cancel generation
- **WHEN** user clicks cancel during generation
- **THEN** system aborts the fetch request via AbortController
- **AND** displays cancellation message

### Requirement: Form State Persistence

The system SHALL persist form settings across sessions.

#### Scenario: GPT-Image settings persistence
- **WHEN** user modifies GPT-Image form settings
- **THEN** system saves to localStorage under 'dalle-form-settings'
- **AND** restores on next page load

#### Scenario: Flux settings persistence
- **WHEN** user modifies Flux form settings
- **THEN** system saves to localStorage under 'flux-form-settings'
- **AND** restores on next page load

### Requirement: History Recording

The system SHALL record completed generations to history.

#### Scenario: Record to history
- **WHEN** image generation completes successfully
- **THEN** system adds entry to history store with type 'image'
- **AND** includes all form parameters and thumbnail reference
