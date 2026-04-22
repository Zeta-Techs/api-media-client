## MODIFIED Requirements

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
- **AND** for uploaded reference images, allows the user to visually draw a mask on the first reference image
- **AND** exports drawn masks as alpha-channel PNG files matching the first reference image dimensions
- **AND** preserves manual PNG mask upload as a fallback when no visual mask is drawn
- **AND** calls /v1/images/edits endpoint

#### Scenario: Flux input image
- **WHEN** user provides input image for Flux
- **THEN** system accepts either file upload or URL
- **AND** supports match_input_image aspect ratio option
