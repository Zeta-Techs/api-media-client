## MODIFIED Requirements
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

#### Scenario: GPT-Image generation via Image API
- **WHEN** user selects GPT-Image tab, chooses Image API mode, and provides a prompt
- **THEN** system calls OpenAI-compatible `/v1/images/generations`
- **AND** supports `gpt-image-2`, `gpt-image-1`, `dall-e-3`, and `dall-e-2`
- **AND** supports multiple output images (`n` parameter)

#### Scenario: GPT-Image generation via Responses API
- **WHEN** user selects GPT-Image tab, chooses Responses API mode, and provides a prompt
- **THEN** system calls OpenAI-compatible `/v1/responses`
- **AND** uses `gpt-5.4` with the `image_generation` tool
- **AND** extracts the generated image from `response.output` items with `type = image_generation_call`

#### Scenario: Flux image generation
- **WHEN** user selects Flux tab and provides a prompt
- **THEN** system calls Flux API with aspect ratio and safety tolerance settings
- **AND** supports input image for image-to-image generation

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
- **AND** calls `/v1/images/edits`

#### Scenario: GPT-Image Responses API follow-up generation
- **WHEN** user already has a successful GPT-Image Responses API generation in the current page
- **AND** submits another prompt in Responses API mode
- **THEN** system sends the previous response ID as `previous_response_id`
- **AND** treats the new request as a continuation of the current image conversation

#### Scenario: Flux input image
- **WHEN** user provides input image for Flux
- **THEN** system accepts either file upload or URL
- **AND** supports match_input_image aspect ratio option

### Requirement: Advanced Generation Parameters

The system SHALL support advanced parameters for fine-tuning generation.

#### Scenario: GPT-Image quality settings via Image API
- **WHEN** user configures GPT-Image generation in Image API mode
- **THEN** system offers quality options: auto, low, medium, high
- **AND** background options vary by model
- **AND** `gpt-image-2` supports auto and opaque backgrounds only
- **AND** `gpt-image-1` supports auto, transparent, and opaque backgrounds
- **AND** compression level for JPEG/WebP (0-100)
- **AND** moderation level: auto, low

#### Scenario: GPT-Image quality settings via Responses API
- **WHEN** user configures GPT-Image generation in Responses API mode
- **THEN** system offers size, quality, output format, output compression, and background controls for the `image_generation` tool
- **AND** hides multiple-image and moderation controls
- **AND** only allows auto or opaque backgrounds

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

### Requirement: Result Display and Download

The system SHALL display generated images and allow download.

#### Scenario: Single image result
- **WHEN** generation completes with one image (Gemini, Flux)
- **THEN** system displays image with dimensions, size, and type info
- **AND** provides download button with appropriate extension

#### Scenario: Multiple image result
- **WHEN** GPT-Image generates multiple images in Image API mode (`n > 1`)
- **THEN** system displays images in a grid layout
- **AND** each image has individual download option
- **AND** clicking opens lightbox view

#### Scenario: GPT Responses image result
- **WHEN** GPT-Image Responses API generation completes
- **THEN** system displays the generated image as a single preview
- **AND** shows the latest revised prompt when returned
- **AND** shows current conversation turn metadata for the active Responses session

#### Scenario: Batch GPT-Image result
- **WHEN** user runs batch GPT-Image generation
- **THEN** each prompt produces exactly one result image
- **AND** batch export uses the selected output format extension

#### Scenario: Revised prompt display
- **WHEN** GPT-Image returns `revised_prompt`
- **THEN** system displays the revised prompt in an info alert

### Requirement: Request Cancellation

The system SHALL allow cancellation of in-progress generation requests.

#### Scenario: Cancel generation
- **WHEN** user clicks cancel during generation
- **THEN** system aborts the fetch request via AbortController
- **AND** displays cancellation message

#### Scenario: Cancel GPT Responses follow-up turn
- **WHEN** user cancels a GPT-Image Responses API follow-up request
- **THEN** system keeps the previously successful image preview visible
- **AND** does not advance the stored `previous_response_id`

### Requirement: Form State Persistence

The system SHALL persist form settings across sessions.

#### Scenario: GPT-Image settings persistence
- **WHEN** user modifies GPT-Image form settings
- **THEN** system saves to localStorage under `dalle-form-settings`
- **AND** restores on next page load
- **AND** includes the selected generate-mode API (`Image API` or `Responses API`)

#### Scenario: Flux settings persistence
- **WHEN** user modifies Flux form settings
- **THEN** system saves to localStorage under `flux-form-settings`
- **AND** restores on next page load

### Requirement: History Recording

The system SHALL record completed generations to history.

#### Scenario: Record to history
- **WHEN** image generation completes successfully
- **THEN** system adds entry to history store with type `image`
- **AND** includes all form parameters and thumbnail reference

#### Scenario: Record GPT Responses turn metadata
- **WHEN** a GPT-Image Responses API request completes successfully
- **THEN** the history entry records that Responses API was used
- **AND** records whether the request continued a previous turn
- **AND** records the current turn count
- **AND** does not store `previous_response_id`
