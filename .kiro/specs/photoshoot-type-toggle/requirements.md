# Requirements Document

## Introduction

This feature replaces the existing Simple/Advanced workflow toggle with a Garment/Product photoshoot type toggle, allowing users to generate professional photoshoot images for both fashion garments and general products using the same streamlined workflow. The feature maintains all existing functionality while adapting the user interface and AI prompts to be contextually appropriate for each photoshoot type.

## Requirements

### Requirement 1

**User Story:** As a user, I want to choose between garment and product photoshoot modes so that I can generate appropriate images for different types of items.

#### Acceptance Criteria

1. WHEN the application loads THEN the system SHALL display a toggle to select between "Garment" and "Product" photoshoot types
2. WHEN a user selects "Garment" mode THEN the system SHALL configure the interface for fashion garment photography
3. WHEN a user selects "Product" mode THEN the system SHALL configure the interface for general product photography
4. WHEN switching between modes THEN the system SHALL reset all current state and clear uploaded images

### Requirement 2

**User Story:** As a user, I want the interface labels and text to adapt based on my selected photoshoot type so that the experience feels tailored to my specific use case.

#### Acceptance Criteria

1. WHEN "Garment" mode is selected THEN the system SHALL display garment-specific labels like "Upload Garment Images", "Garment Analysis"
2. WHEN "Product" mode is selected THEN the system SHALL display product-specific labels like "Upload Product Images", "Product Analysis"
3. WHEN switching modes THEN the system SHALL update all relevant UI text immediately
4. WHEN displaying file upload sections THEN the system SHALL show contextually appropriate icons and descriptions

### Requirement 3

**User Story:** As a user, I want the AI analysis and prompt generation to be optimized for my selected photoshoot type so that I get the most relevant and effective results.

#### Acceptance Criteria

1. WHEN analyzing garment images THEN the system SHALL use fashion-focused prompts that consider fit, fabric, styling, and fashion contexts
2. WHEN analyzing product images THEN the system SHALL use product-focused prompts that consider features, use cases, and lifestyle contexts
3. WHEN generating studio shots THEN the system SHALL create appropriate backgrounds and lighting for the selected photoshoot type
4. WHEN generating lifestyle shots THEN the system SHALL create contextually relevant scenarios for garments vs products

### Requirement 4

**User Story:** As a user, I want all existing functionality to work seamlessly regardless of which photoshoot type I choose so that I don't lose any capabilities.

#### Acceptance Criteria

1. WHEN using either photoshoot type THEN the system SHALL maintain all image generation capabilities (studio, lifestyle, custom prompts)
2. WHEN using either photoshoot type THEN the system SHALL maintain all editing and history features
3. WHEN using either photoshoot type THEN the system SHALL maintain progress tracking and error handling
4. WHEN using either photoshoot type THEN the system SHALL maintain the same quality assurance and refinement processes

### Requirement 5

**User Story:** As a user, I want the system to remember my photoshoot type preference during my session so that I don't have to reselect it repeatedly.

#### Acceptance Criteria

1. WHEN a user selects a photoshoot type THEN the system SHALL maintain that selection throughout the session
2. WHEN refreshing the page THEN the system SHALL default to the garment photoshoot type
3. WHEN switching photoshoot types THEN the system SHALL provide clear feedback about the mode change
4. WHEN in a specific mode THEN the system SHALL visually indicate the current selection