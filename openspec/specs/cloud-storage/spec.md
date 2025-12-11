# Cloud Storage

Cloud storage integration for uploading and managing generated media files.

## Requirements

### Requirement: Multi-Provider Support

The system SHALL support multiple cloud storage providers.

#### Scenario: S3-compatible storage
- **WHEN** user configures S3 provider
- **THEN** system accepts: endpoint, bucket, region, accessKeyId, secretAccessKey
- **AND** supports optional pathPrefix and publicUrl

#### Scenario: WebDAV storage
- **WHEN** user configures WebDAV provider
- **THEN** system accepts: endpoint, username, password, basePath

#### Scenario: Provider switching
- **WHEN** user has multiple providers configured
- **THEN** system allows enabling/disabling individual providers
- **AND** routes uploads to enabled providers

### Requirement: S3 Authentication

The system SHALL implement AWS Signature V4 signing for S3 requests.

#### Scenario: Request signing
- **WHEN** S3 request is made
- **THEN** system generates AWS Signature V4 headers
- **AND** includes x-amz-date, x-amz-content-sha256, Authorization headers

#### Scenario: Signature calculation
- **WHEN** calculating signature
- **THEN** system computes SHA-256 payload hash
- **AND** builds canonical request
- **AND** derives signing key using HMAC-SHA256 chain
- **AND** signs with derived key

### Requirement: S3 URL Styles

The system SHALL support different S3 URL addressing styles.

#### Scenario: Path-style URL
- **WHEN** forcePathStyle is true
- **THEN** system builds URL as: {endpoint}/{bucket}/{key}

#### Scenario: Virtual-hosted-style URL
- **WHEN** forcePathStyle is false
- **THEN** system builds URL as: {bucket}.{endpoint}/{key}

#### Scenario: Public URL override
- **WHEN** publicUrl is configured
- **THEN** system returns public URL for uploaded files instead of S3 URL

### Requirement: WebDAV Operations

The system SHALL implement WebDAV protocol operations.

#### Scenario: WebDAV upload
- **WHEN** uploading to WebDAV
- **THEN** system uses PUT method with Basic authentication
- **AND** auto-creates parent directories using MKCOL

#### Scenario: Directory creation
- **WHEN** uploading to nested path
- **THEN** system recursively creates directories
- **AND** handles 405 Method Not Allowed (directory exists)

#### Scenario: WebDAV connection test
- **WHEN** testing WebDAV connection
- **THEN** system uses PROPFIND method
- **AND** verifies authentication and endpoint accessibility

### Requirement: File Upload

The system SHALL support uploading files to configured providers.

#### Scenario: Upload with progress
- **WHEN** uploading file
- **THEN** system reports progress via callback
- **AND** uses XMLHttpRequest for progress tracking

#### Scenario: Upload result
- **WHEN** upload completes
- **THEN** system returns: success, url, path, error (if failed)

#### Scenario: Upload cancellation
- **WHEN** upload is cancelled via AbortSignal
- **THEN** system aborts XMLHttpRequest
- **AND** throws AbortError

### Requirement: Content Type Detection

The system SHALL detect and set appropriate content types.

#### Scenario: Content type from blob
- **WHEN** uploading blob without explicit type
- **THEN** system uses blob.type if available
- **AND** falls back to application/octet-stream

#### Scenario: Explicit content type
- **WHEN** contentType option is provided
- **THEN** system uses provided content type

### Requirement: Connection Testing

The system SHALL support testing storage provider connections.

#### Scenario: S3 connection test
- **WHEN** testing S3 connection
- **THEN** system sends HEAD request to bucket
- **AND** returns success/failure with message

#### Scenario: WebDAV connection test
- **WHEN** testing WebDAV connection
- **THEN** system sends PROPFIND request to base path
- **AND** returns success/failure with message

### Requirement: File Management Operations

The system SHALL support file management operations.

#### Scenario: Delete file
- **WHEN** deleting file
- **THEN** system sends DELETE request
- **AND** returns success/failure

#### Scenario: Check file existence
- **WHEN** checking if file exists
- **THEN** system sends HEAD request
- **AND** returns boolean result

### Requirement: Path Prefix Support

The system SHALL support path prefix for organizing uploads.

#### Scenario: S3 path prefix
- **WHEN** pathPrefix is configured
- **THEN** system prepends prefix to all keys: {prefix}/{filename}

#### Scenario: WebDAV base path
- **WHEN** basePath is configured
- **THEN** system appends base path to endpoint URL

### Requirement: Upload Settings

The system SHALL support configurable upload behavior.

#### Scenario: Auto-upload setting
- **WHEN** auto-upload is enabled
- **THEN** system automatically uploads completed task results

#### Scenario: Filename patterns
- **WHEN** generating upload filename
- **THEN** system supports patterns with timestamp, original name, etc.

### Requirement: Provider Configuration Persistence

The system SHALL persist storage provider configurations.

#### Scenario: Save configuration
- **WHEN** user configures storage provider
- **THEN** system saves to localStorage

#### Scenario: Load configuration
- **WHEN** application loads
- **THEN** system restores provider configurations from localStorage

### Requirement: Settings Import/Export

The system SHALL support importing and exporting storage settings.

#### Scenario: Export settings
- **WHEN** user exports storage settings
- **THEN** system includes all provider configurations and upload settings

#### Scenario: Import settings
- **WHEN** user imports storage settings
- **THEN** system merges with existing configuration
- **AND** validates required fields
