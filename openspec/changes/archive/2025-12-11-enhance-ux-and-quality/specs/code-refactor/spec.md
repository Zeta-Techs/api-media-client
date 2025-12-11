# Code Refactor Spec Delta

**Related Specs**: All view specs, composables

## ADDED Requirements

### Requirement: Unified Blob URL Management

The system SHALL use useBlobUrl composable consistently across all views.

#### Scenario: Automatic URL cleanup
- **WHEN** new blob is set via useBlobUrl
- **THEN** system automatically revokes previous URL
- **AND** creates new URL for the blob

#### Scenario: Component unmount cleanup
- **WHEN** component using useBlobUrl unmounts
- **THEN** system automatically revokes all created URLs
- **AND** no manual cleanup needed in component

#### Scenario: Multiple URLs per component
- **WHEN** component needs multiple blob URLs
- **THEN** useBlobUrl supports multiple named URLs
- **AND** each can be set/cleaned independently

### Requirement: Unified Form Persistence

The system SHALL use useFormPersist composable consistently across all views.

#### Scenario: Debounced save
- **WHEN** form values change
- **THEN** system debounces localStorage write (default 500ms)
- **AND** prevents excessive writes during rapid input

#### Scenario: Exclude non-serializable fields
- **WHEN** form contains File or Blob fields
- **THEN** useFormPersist excludes these from persistence
- **AND** only serializable fields are saved

#### Scenario: Forced save on unmount
- **WHEN** component unmounts with pending changes
- **THEN** system immediately saves current state
- **AND** ensures no data loss

#### Scenario: Restore on mount
- **WHEN** component mounts with useFormPersist
- **THEN** system restores previously saved values
- **AND** applies to provided form ref

### Requirement: Unified Error Handling

The system SHALL use useApiError composable for consistent error handling.

#### Scenario: API error classification
- **WHEN** API call fails
- **THEN** useApiError classifies error as: abort, network, api, unknown
- **AND** provides appropriate user message

#### Scenario: Abort error handling
- **WHEN** request is aborted (user cancellation)
- **THEN** system clears error message
- **AND** does not show error notification

#### Scenario: Error message display
- **WHEN** API error occurs
- **THEN** errorMessage ref contains user-friendly message
- **AND** can be bound to NAlert component

### Requirement: Shared Type Definitions

The system SHALL define shared types in central location.

#### Scenario: SubtitleItem type
- **WHEN** component needs SubtitleItem type
- **THEN** imports from '@/types'
- **AND** type is defined once in types/index.ts

#### Scenario: Type consistency
- **WHEN** multiple components use same data structure
- **THEN** all use shared type definition
- **AND** no duplicate interface definitions

## MODIFIED Requirements

### Requirement: AudioView Implementation

The system SHALL use unified composables for AudioView implementation.

#### Scenario: Blob URL handling
- **WHEN** AudioView manages audio blob
- **THEN** uses useBlobUrl instead of manual URL.createObjectURL
- **AND** removes manual onUnmounted cleanup

#### Scenario: Form persistence
- **WHEN** AudioView persists form state
- **THEN** uses useFormPersist instead of manual localStorage code
- **AND** removes saveFormSettings/loadFormSettings functions

### Requirement: ImageView Implementation

The system SHALL use unified composables for ImageView implementation.

#### Scenario: Blob URL handling
- **WHEN** ImageView manages image blobs
- **THEN** uses useBlobUrl for each generated image
- **AND** cleanup handled automatically

### Requirement: VideoView Implementation

The system SHALL use unified composables for VideoView implementation.

#### Scenario: Form persistence addition
- **WHEN** VideoView loads
- **THEN** restores form state from localStorage
- **AND** uses useFormPersist (currently missing)

### Requirement: TTSView Implementation

The system SHALL use unified composables for TTSView implementation.

#### Scenario: Unified patterns
- **WHEN** TTSView handles audio result
- **THEN** uses useBlobUrl and useFormPersist
- **AND** matches other view patterns

### Requirement: RealtimeView Implementation

The system SHALL use shared type definitions for RealtimeView implementation.

#### Scenario: Type import
- **WHEN** RealtimeView uses SubtitleItem
- **THEN** imports from '@/types/index.ts'
- **AND** removes local interface definition
