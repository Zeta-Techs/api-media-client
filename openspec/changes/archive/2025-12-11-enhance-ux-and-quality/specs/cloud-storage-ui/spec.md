# Cloud Storage UI Spec Delta

**Related Spec**: `openspec/specs/cloud-storage/spec.md`

## ADDED Requirements

### Requirement: Upload Button Component

The system SHALL provide a reusable upload button component for result cards.

#### Scenario: Display upload button
- **WHEN** result is available in any view (Audio, Image, Video, TTS)
- **AND** at least one cloud storage provider is configured
- **THEN** system displays upload button in result card header

#### Scenario: Hidden when no providers
- **WHEN** no cloud storage providers are configured
- **THEN** upload button is not displayed
- **AND** tooltip suggests configuring in settings

#### Scenario: Upload in progress
- **WHEN** user clicks upload button
- **THEN** button shows loading spinner
- **AND** displays progress percentage
- **AND** disables button until complete

#### Scenario: Upload success
- **WHEN** upload completes successfully
- **THEN** button shows success icon temporarily
- **AND** displays uploaded URL in tooltip
- **AND** optionally copies URL to clipboard

#### Scenario: Upload failure
- **WHEN** upload fails
- **THEN** button shows error icon
- **AND** displays error message in tooltip
- **AND** allows retry

### Requirement: Settings Page Cloud Storage Configuration

The system SHALL provide cloud storage configuration UI in settings page.

#### Scenario: S3 configuration form
- **WHEN** user opens cloud storage settings
- **THEN** system displays S3 configuration fields:
  - Endpoint URL
  - Bucket name
  - Region
  - Access Key ID
  - Secret Access Key
  - Path prefix (optional)
  - Public URL override (optional)
  - Force path style toggle

#### Scenario: WebDAV configuration form
- **WHEN** user selects WebDAV provider type
- **THEN** system displays WebDAV configuration fields:
  - Endpoint URL
  - Username
  - Password
  - Base path (optional)

#### Scenario: Connection test
- **WHEN** user clicks test connection button
- **THEN** system calls testConnection on the service
- **AND** displays success/failure message
- **AND** shows connection details on success

#### Scenario: Save configuration
- **WHEN** user saves storage configuration
- **THEN** system persists to storage store
- **AND** validates required fields before saving

### Requirement: Auto-Upload Setting

The system SHALL support automatic upload after task completion.

#### Scenario: Enable auto-upload
- **WHEN** user enables auto-upload in settings
- **THEN** completed tasks automatically upload to configured provider
- **AND** displays upload status in task list

#### Scenario: Auto-upload failure handling
- **WHEN** auto-upload fails
- **THEN** system shows warning notification
- **AND** does not block task completion
- **AND** allows manual retry

### Requirement: Provider Selection

The system SHALL support selecting upload destination when multiple providers exist.

#### Scenario: Single provider
- **WHEN** only one provider is configured and enabled
- **THEN** upload button uses that provider directly
- **AND** no selection needed

#### Scenario: Multiple providers
- **WHEN** multiple providers are enabled
- **THEN** upload button shows dropdown to select provider
- **AND** remembers last used provider

### Requirement: Filename Pattern Configuration

The system SHALL support configurable filename patterns for uploads.

#### Scenario: Configure pattern
- **WHEN** user configures filename pattern in settings
- **THEN** system supports variables: {timestamp}, {type}, {original}, {uuid}
- **AND** applies pattern to all uploads

#### Scenario: Default pattern
- **WHEN** no custom pattern is configured
- **THEN** system uses: {type}-{timestamp}.{ext}

## MODIFIED Requirements

### Requirement: Upload Settings (from cloud-storage/spec.md)

The system SHALL persist upload settings changes immediately via the storage store.

#### Scenario: Settings UI persistence
- **WHEN** user modifies upload settings in UI
- **THEN** changes persist immediately via storage store
- **AND** reflect in all views without refresh
