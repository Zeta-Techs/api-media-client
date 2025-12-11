# Provider Management

API provider preset and configuration management capability.

## Requirements

### Requirement: Provider Preset Management

The system SHALL support managing multiple API provider configurations.

#### Scenario: Default presets
- **WHEN** application loads for first time
- **THEN** system provides default presets: Zeta API, Zeta Enterprise
- **AND** each preset includes name, baseUrl, empty apiKey

#### Scenario: Add preset
- **WHEN** user creates new preset
- **THEN** system generates unique ID (timestamp + random string)
- **AND** records createdAt timestamp
- **AND** persists to localStorage

#### Scenario: Update preset
- **WHEN** user modifies preset (name, baseUrl, apiKey)
- **THEN** system updates preset properties
- **AND** persists changes

#### Scenario: Delete preset
- **WHEN** user deletes preset
- **AND** more than one preset exists
- **THEN** system removes preset
- **AND** switches to first available if deleted was active

#### Scenario: Prevent last preset deletion
- **WHEN** user attempts to delete the only preset
- **THEN** system prevents deletion
- **AND** returns false

### Requirement: Active Preset Selection

The system SHALL support selecting the active API provider.

#### Scenario: Switch preset
- **WHEN** user selects different preset
- **THEN** system updates activePresetId
- **AND** persists to localStorage

#### Scenario: Computed API config
- **WHEN** accessing baseUrl or apiKey
- **THEN** system returns values from active preset

#### Scenario: API key update
- **WHEN** user updates API key
- **THEN** system updates the active preset's apiKey
- **AND** persists changes

### Requirement: Prompt Template Management

The system SHALL support managing reusable prompt templates.

#### Scenario: Add template
- **WHEN** user creates prompt template
- **THEN** system generates unique ID
- **AND** stores name, prompt, type (video/image/audio/both)
- **AND** records createdAt timestamp

#### Scenario: Update template
- **WHEN** user modifies template
- **THEN** system updates template properties
- **AND** persists changes

#### Scenario: Delete template
- **WHEN** user deletes template
- **THEN** system removes from list
- **AND** persists changes

#### Scenario: Filter templates by type
- **WHEN** accessing templates for specific feature
- **THEN** system filters by type matching or 'both'
- **AND** videoTemplates returns video/both types
- **AND** imageTemplates returns image/both types
- **AND** audioTemplates returns audio/both types

### Requirement: Theme Management

The system SHALL support theme switching.

#### Scenario: Theme toggle
- **WHEN** user toggles theme
- **THEN** system switches between 'dark' and 'light'
- **AND** persists to localStorage

#### Scenario: Theme persistence
- **WHEN** application loads
- **THEN** system restores theme from localStorage
- **AND** defaults to 'dark' if not set

### Requirement: Settings Persistence

The system SHALL persist all configuration to localStorage.

#### Scenario: Provider presets persistence
- **WHEN** presets are modified
- **THEN** system saves to localStorage key 'providerPresets'

#### Scenario: Active preset persistence
- **WHEN** active preset changes
- **THEN** system saves to localStorage key 'activePresetId'

#### Scenario: Templates persistence
- **WHEN** templates are modified
- **THEN** system saves to localStorage key 'promptTemplates'

### Requirement: Settings Import/Export

The system SHALL support importing and exporting all settings.

#### Scenario: Export settings
- **WHEN** user exports settings
- **THEN** system generates JSON with:
  - theme
  - providerPresets (with API keys)
  - activePresetId
  - promptTemplates

#### Scenario: Import settings
- **WHEN** user imports settings JSON
- **THEN** system parses and validates JSON
- **AND** merges theme, presets, templates
- **AND** persists all to localStorage
- **AND** returns true on success, false on error

#### Scenario: Partial import
- **WHEN** import JSON is missing some fields
- **THEN** system only imports present fields
- **AND** preserves existing values for missing fields

### Requirement: API Key Security Display

The system SHALL indicate API key presence without exposing it.

#### Scenario: API key indicator
- **WHEN** displaying provider status
- **THEN** system shows "API Key ✓" if apiKey is set
- **AND** shows "API Key ✗" if apiKey is empty

### Requirement: Preset Information

The system SHALL track metadata for presets and templates.

#### Scenario: Preset metadata
- **WHEN** preset is created
- **THEN** system stores: id, name, baseUrl, apiKey, createdAt

#### Scenario: Template metadata
- **WHEN** template is created
- **THEN** system stores: id, name, prompt, type, createdAt
