# Content Moderation

AI-powered content moderation capability for text and image analysis.

## Requirements

### Requirement: Content Analysis

The system SHALL support analyzing content for policy violations.

#### Scenario: Analyze text content
- **WHEN** user submits text for moderation
- **THEN** system calls POST /v1/moderations with text input
- **AND** returns flagged status and category scores

#### Scenario: Analyze multimodal content
- **WHEN** user submits text and image for moderation
- **AND** model supports images
- **THEN** system sends array of content parts with text and image_url
- **AND** returns analysis results for all input types

### Requirement: Model Selection

The system SHALL provide model selection for moderation.

#### Scenario: Model options
- **WHEN** user accesses moderation feature
- **THEN** system offers models: omni-moderation-latest, text-moderation-latest (Legacy)
- **AND** allows custom model name input

#### Scenario: Model capabilities
- **WHEN** user selects omni-moderation-latest
- **THEN** system enables multimodal input option
- **AND** text-moderation-latest only supports text input

### Requirement: Input Modes

The system SHALL support different input modes based on model capabilities.

#### Scenario: Text-only mode
- **WHEN** user selects text-only mode
- **THEN** system sends input as plain text string
- **AND** hides image upload options

#### Scenario: Multimodal mode
- **WHEN** user selects multimodal mode
- **AND** model supports images
- **THEN** system shows text input and image options
- **AND** sends input as array of parts

### Requirement: Image Input

The system SHALL support image input for multimodal moderation.

#### Scenario: Image URL input
- **WHEN** user enters image URL
- **THEN** system includes image_url part in request
- **AND** disables file upload option

#### Scenario: Image file upload
- **WHEN** user uploads image file
- **THEN** system converts to base64 data URL
- **AND** includes as image_url part with data: prefix
- **AND** disables URL input option

### Requirement: Moderation Categories

The system SHALL analyze content across multiple categories.

#### Scenario: Category analysis
- **WHEN** moderation completes
- **THEN** system displays all category results:
  - harassment, harassment/threatening
  - hate, hate/threatening
  - illicit, illicit/violent
  - self-harm, self-harm/intent, self-harm/instructions
  - sexual, sexual/minors
  - violence, violence/graphic
- **AND** shows flagged status and score for each category

### Requirement: Result Display

The system SHALL display detailed moderation results.

#### Scenario: Flagged content indication
- **WHEN** any category is flagged
- **THEN** system displays error status badge with "Flagged"
- **AND** highlights flagged categories with red border
- **AND** shows warning message

#### Scenario: Passed content indication
- **WHEN** no categories are flagged
- **THEN** system displays success status badge with "Passed"
- **AND** shows success message

#### Scenario: Category scores display
- **WHEN** results are displayed
- **THEN** system shows progress bar for each category score (0-1)
- **AND** color-codes by severity (green <0.2, yellow <0.5, orange <0.8, red >=0.8)
- **AND** displays numeric score with 4 decimal places

#### Scenario: Input type indicators
- **WHEN** category_applied_input_types is present
- **THEN** system displays tags showing which input types triggered each category (text, image)

### Requirement: Result Metadata

The system SHALL display result metadata.

#### Scenario: Metadata display
- **WHEN** moderation completes
- **THEN** system shows model name and result ID
- **AND** displays overall flagged/passed status

### Requirement: Category Information

The system SHALL display category descriptions.

#### Scenario: Category info card
- **WHEN** user views moderation page
- **THEN** system displays info card listing all categories
- **AND** indicates which categories are text-only

### Requirement: Form State Persistence

The system SHALL persist model selection across sessions.

#### Scenario: Settings persistence
- **WHEN** moderation completes successfully
- **THEN** system saves model and customModel to localStorage
- **AND** restores on next page load

### Requirement: Result Management

The system SHALL support clearing results.

#### Scenario: Clear results
- **WHEN** user clicks clear button
- **THEN** system clears result display
- **AND** clears text input, image URL, and image file

### Requirement: Request Cancellation

The system SHALL allow cancellation of in-progress analysis.

#### Scenario: Cancel analysis
- **WHEN** user clicks cancel during analysis
- **THEN** system aborts the fetch request via AbortController
- **AND** displays cancellation message
