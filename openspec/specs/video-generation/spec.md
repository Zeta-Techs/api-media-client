# Video Generation

AI-powered video generation capability using Sora models with asynchronous task processing.

## Requirements

### Requirement: Video Generation Task Creation

The system SHALL support creating video generation tasks through the Sora API.

#### Scenario: Create video from prompt
- **WHEN** user provides a prompt and submits video generation
- **THEN** system calls POST /v1/videos with FormData containing prompt, model, seconds, and size
- **AND** receives a task ID for tracking

#### Scenario: Create video with reference image
- **WHEN** user uploads a reference image along with prompt
- **THEN** system includes input_reference field in the FormData
- **AND** validates image resolution matches selected video size

### Requirement: Model Selection

The system SHALL provide model selection for video generation.

#### Scenario: Standard model selection
- **WHEN** user accesses video generation
- **THEN** system offers models: sora-2, sora-2-pro
- **AND** allows custom model name input

#### Scenario: Model-specific size options
- **WHEN** user selects sora-2 model
- **THEN** system offers sizes: 720x1280 (Portrait), 1280x720 (Landscape)
- **AND** sora-2-pro additionally offers: 1024x1792, 1792x1024

### Requirement: Video Duration Configuration

The system SHALL allow configuration of video duration.

#### Scenario: Standard duration selection
- **WHEN** user configures video duration
- **THEN** system offers options: 4s, 8s, 12s
- **AND** allows custom duration input in seconds

### Requirement: Reference Image Validation

The system SHALL validate reference image resolution against video size.

#### Scenario: Resolution mismatch warning
- **WHEN** user uploads a reference image
- **AND** image resolution does not match selected video size
- **THEN** system displays a warning with actual vs expected dimensions

#### Scenario: Resolution mismatch blocks submit
- **WHEN** user attempts to submit with mismatched reference image
- **THEN** system blocks submission and displays error message

### Requirement: Asynchronous Task Processing

The system SHALL handle video generation as an asynchronous task with polling.

#### Scenario: Task status polling
- **WHEN** video generation task is created
- **THEN** system polls GET /v1/videos/{taskId} every 3 seconds
- **AND** updates status and progress percentage in UI
- **AND** continues polling until status is 'completed', 'failed', or 'cancelled'

#### Scenario: Task completion
- **WHEN** task status becomes 'completed'
- **THEN** system fetches video content from GET /v1/videos/{taskId}/content
- **AND** displays video in player
- **AND** records success to history

#### Scenario: Task failure
- **WHEN** task status becomes 'failed'
- **THEN** system displays error message from API response
- **AND** records failure to history

### Requirement: Task Status Query

The system SHALL allow querying task status by ID.

#### Scenario: Query existing task
- **WHEN** user enters a task ID and clicks query
- **THEN** system fetches task status and displays status, progress, and any errors

#### Scenario: Fetch completed video
- **WHEN** user enters a completed task ID and clicks fetch
- **THEN** system downloads and displays the video content

### Requirement: Request Cancellation

The system SHALL allow cancellation of in-progress tasks.

#### Scenario: Cancel generation
- **WHEN** user clicks cancel during video generation
- **THEN** system aborts the fetch request via AbortController
- **AND** updates status to 'cancelled'
- **AND** displays cancellation message

### Requirement: Video Preview and Download

The system SHALL display generated videos and allow download.

#### Scenario: Video preview
- **WHEN** video generation completes
- **THEN** system displays video in HTML5 video player with controls
- **AND** video autoplays

#### Scenario: Video download
- **WHEN** user clicks download button
- **THEN** system downloads video as MP4 with filename pattern: video-{taskId}.mp4

### Requirement: Status Visualization

The system SHALL provide visual status indicators during generation.

#### Scenario: Status badge display
- **WHEN** task is in progress
- **THEN** system displays colored status badge (pending: amber, processing: blue, completed: green, failed: red)

#### Scenario: Progress bar display
- **WHEN** task status is 'processing'
- **THEN** system displays progress bar with percentage from API response

### Requirement: Prompt Templates

The system SHALL support reusable prompt templates for video generation.

#### Scenario: Apply prompt template
- **WHEN** user selects a video prompt template
- **THEN** system populates the prompt field with template content

### Requirement: History Recording

The system SHALL record video generation tasks to history.

#### Scenario: Record successful generation
- **WHEN** video generation completes successfully
- **THEN** system adds entry to history store with type 'video', status 'completed', and task ID

#### Scenario: Record failed generation
- **WHEN** video generation fails
- **THEN** system adds entry to history store with type 'video', status 'failed', and error message
