## ADDED Requirements

### Requirement: Provider Preset Quick Navigation

The system SHALL provide quick navigation from provider preset indicators to the Settings page.

#### Scenario: Navigate to settings from preset indicator
- **WHEN** user views provider preset selector in any feature view
- **AND** the preset status indicator (API Key checkmark/cross) is displayed
- **THEN** system provides a clickable link next to the indicator
- **AND** clicking the link navigates to the Settings page (provider presets tab)

#### Scenario: Visual indication of clickable link
- **WHEN** provider preset status indicator is rendered
- **THEN** system displays a clickable edit/settings icon or text link
- **AND** link is styled consistently across all views (Image, Video, Audio, TTS, Realtime, Moderation)
