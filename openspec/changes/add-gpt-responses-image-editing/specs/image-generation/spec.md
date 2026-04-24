## MODIFIED Requirements
### Requirement: Reference Image Support

The system SHALL support reference images for guided generation and editing.

#### Scenario: GPT-Image edit mode via Image API
- **WHEN** user enables GPT image edit mode and chooses Image API
- **THEN** system accepts reference images (up to 10) and optional mask image
- **AND** supports either uploaded files or image URLs as edit inputs
- **AND** calls `/v1/images/edits`

#### Scenario: GPT-Image edit mode via Responses API
- **WHEN** user enables GPT image edit mode and chooses Responses API
- **THEN** system uses `gpt-5.4` with the `image_generation` tool
- **AND** supports edit inputs from uploaded files, image URLs, and explicit file IDs
- **AND** supports reference-image-only generation and edit-in-context flows

#### Scenario: GPT-Image Responses mask editing
- **WHEN** user edits an image in Responses API mode with a visual or uploaded mask
- **THEN** system attaches the mask as a Responses-compatible image input
- **AND** applies the mask to the first input image when multiple images are present
- **AND** keeps the existing visual mask editor workflow available

#### Scenario: GPT-Image Responses multi-turn editing
- **WHEN** user continues editing in Responses API mode after a successful Responses image turn
- **THEN** system can continue via `previous_response_id`
- **AND** can reference the prior `image_generation_call` id when the edit flow needs image-in-context continuation

### Requirement: Advanced Generation Parameters

The system SHALL support advanced parameters for fine-tuning generation.

#### Scenario: GPT-Image quality settings via Responses API edit mode
- **WHEN** user configures GPT image editing in Responses API mode
- **THEN** system offers size, quality, output format, output compression, background, and action controls supported by the `image_generation` tool
- **AND** supports `action = auto` and `action = edit`
- **AND** only allows background values supported by the hosted GPT Image model path

### Requirement: Result Display and Download

The system SHALL display generated images and allow download.

#### Scenario: GPT Responses edit result
- **WHEN** a GPT Responses image edit completes
- **THEN** system displays the edited image in the preview panel
- **AND** shows the latest revised prompt when returned
- **AND** preserves the current conversation turn metadata for the active Responses editing session

### Requirement: Request Cancellation

The system SHALL allow cancellation of in-progress generation requests.

#### Scenario: Cancel GPT Responses edit request
- **WHEN** user cancels a GPT Responses image edit request
- **THEN** system aborts the in-flight request
- **AND** keeps the previously successful preview visible
- **AND** does not advance the stored Responses continuation state
