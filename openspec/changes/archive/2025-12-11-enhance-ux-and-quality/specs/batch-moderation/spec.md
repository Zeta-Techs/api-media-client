# Batch Moderation Spec Delta

**Related Spec**: `openspec/specs/content-moderation/spec.md`

## ADDED Requirements

### Requirement: Batch Moderation Mode

The system SHALL support batch processing mode for content moderation.

#### Scenario: Enable batch mode
- **WHEN** user toggles batch mode switch on ModerationView
- **THEN** system displays BatchModerationPanel instead of single item form
- **AND** hides single item result display

#### Scenario: Disable batch mode
- **WHEN** user toggles batch mode switch off
- **THEN** system displays single item form
- **AND** preserves any incomplete batch results

### Requirement: Batch Input Collection

The system SHALL support collecting multiple items for batch moderation.

#### Scenario: Add text items
- **WHEN** user enters text in batch input area
- **THEN** system creates task with type 'text'
- **AND** displays in task list

#### Scenario: Add image items
- **WHEN** user uploads images in batch mode
- **THEN** system creates task with type 'image' for each image
- **AND** displays preview thumbnails in task list

#### Scenario: Add multimodal items
- **WHEN** user provides both text and image for an item
- **THEN** system creates task with type 'multimodal'
- **AND** stores both text and image data

### Requirement: Batch Processing

The system SHALL process moderation tasks using the batch queue system.

#### Scenario: Start batch processing
- **WHEN** user clicks start button with pending tasks
- **THEN** system processes tasks using configured concurrency (default: 3)
- **AND** calls /v1/moderations for each task

#### Scenario: Task completion
- **WHEN** individual task completes
- **THEN** system stores flagged status, categories, and scores
- **AND** updates task progress to 100%

#### Scenario: Task failure
- **WHEN** task fails after retries
- **THEN** system marks task as failed with error message
- **AND** continues processing remaining tasks

### Requirement: Batch Result Aggregation

The system SHALL aggregate results across all completed tasks.

#### Scenario: Summary statistics
- **WHEN** batch processing completes
- **THEN** system displays: total count, flagged count, pass rate
- **AND** shows category breakdown (which categories flagged most)

#### Scenario: Flagged items highlight
- **WHEN** displaying task list
- **THEN** system highlights flagged items with red indicator
- **AND** shows category badges for flagged categories

### Requirement: Batch Export

The system SHALL support exporting batch moderation results.

#### Scenario: Export to CSV
- **WHEN** user clicks CSV export
- **THEN** system generates CSV with columns: id, type, content_preview, flagged, category_scores
- **AND** downloads file

#### Scenario: Export to JSON
- **WHEN** user clicks JSON export
- **THEN** system generates JSON array with full result data
- **AND** downloads file

## MODIFIED Requirements

### Requirement: Model Selection (from content-moderation/spec.md)

The system SHALL enforce model consistency during batch moderation.

#### Scenario: Batch model consistency
- **WHEN** batch mode is active
- **THEN** all tasks use the same model selection
- **AND** model cannot be changed during processing
