# Photoshoot Type Toggle - Testing Plan

## Overview
This document outlines the comprehensive testing strategy for the photoshoot type toggle feature, covering integration tests, UI behavior tests, and service functionality tests.

## Test Categories

### 1. Integration Tests for Mode Switching Behavior

#### Test: Default State
- **Scenario**: Application loads with default settings
- **Expected**: Garment photoshoot type is selected by default
- **Verification**: PhotoshootToggle shows garment as active, UI shows garment-specific labels

#### Test: Mode Switching
- **Scenario**: User switches from garment to product mode
- **Expected**: All UI text updates immediately, state is cleared
- **Verification**: 
  - Upload labels change from "Upload Garment Images" to "Upload Product Images"
  - Pack descriptions update to product-specific text
  - Any uploaded files are cleared
  - Toggle shows product as active

#### Test: State Persistence
- **Scenario**: User selects product mode and performs actions
- **Expected**: Product mode remains active throughout session
- **Verification**: Mode doesn't revert unexpectedly during operations

### 2. UI Updates When Changing Photoshoot Types

#### Test: Upload Section Updates
- **Scenario**: Switch between garment and product modes
- **Expected**: Upload section adapts contextually
- **Verification**:
  - Main upload label changes appropriately
  - Upload description text updates
  - File type validation messages use correct item names

#### Test: Pack Description Updates
- **Scenario**: Select pack types in different photoshoot modes
- **Expected**: Pack descriptions reflect the selected photoshoot type
- **Verification**:
  - Studio pack shows garment-specific description in garment mode
  - Studio pack shows product-specific description in product mode
  - Lifestyle pack descriptions update appropriately

#### Test: Error Message Updates
- **Scenario**: Trigger validation errors in different modes
- **Expected**: Error messages use appropriate terminology
- **Verification**:
  - Upload errors mention "garment" or "product" as appropriate
  - Analysis errors use correct item names
  - Generation errors reflect the selected photoshoot type

#### Test: Progress Indicator Updates
- **Scenario**: Start generation process in different modes
- **Expected**: Progress messages adapt to photoshoot type
- **Verification**:
  - Analysis step mentions correct item type
  - Generation steps use appropriate terminology

### 3. Prompt Generation for Both Modes

#### Test: Garment Mode Prompt Generation
- **Scenario**: Generate analysis and prompts in garment mode
- **Expected**: Prompts focus on fashion-specific attributes
- **Verification**:
  - System instructions mention fashion terminology
  - Analysis covers fabric, fit, styling attributes
  - QA checklist includes garment-specific checks
  - Studio prompts consider fashion photography needs

#### Test: Product Mode Prompt Generation
- **Scenario**: Generate analysis and prompts in product mode
- **Expected**: Prompts focus on product-specific attributes
- **Verification**:
  - System instructions mention product terminology
  - Analysis covers materials, features, functionality
  - QA checklist includes product-specific checks
  - Studio prompts consider product photography needs

#### Test: Two-Item Scenarios
- **Scenario**: Upload two images in each mode
- **Expected**: Prompts handle multiple items appropriately
- **Verification**:
  - Garment mode handles garment ensembles correctly
  - Product mode handles product combinations correctly
  - Analysis separates items when distinct
  - Prompts feature both items when appropriate

### 4. Existing Functionality Verification

#### Test: Image Generation Pipeline
- **Scenario**: Complete image generation in both modes
- **Expected**: All generation features work identically
- **Verification**:
  - Studio image generation works in both modes
  - Lifestyle image generation works in both modes
  - Single image generation functions correctly
  - Pack generation produces expected results

#### Test: History and Editing Features
- **Scenario**: Use history and editing features in both modes
- **Expected**: Features work regardless of photoshoot type
- **Verification**:
  - Images save to history correctly
  - Edit functionality works for all generated images
  - Download features function properly
  - Full-screen modal works correctly

#### Test: Progress Tracking
- **Scenario**: Monitor progress during generation in both modes
- **Expected**: Progress tracking works consistently
- **Verification**:
  - Progress steps are appropriate for each mode
  - Time estimates are reasonable
  - Error handling works correctly
  - Progress completes successfully

### 5. Error Handling and Edge Cases

#### Test: Service Error Handling
- **Scenario**: API errors occur during analysis/generation
- **Expected**: Errors are handled gracefully with appropriate messages
- **Verification**:
  - Error messages use correct terminology for the active mode
  - User can recover from errors
  - State remains consistent after errors

#### Test: File Upload Validation
- **Scenario**: Upload invalid files in different modes
- **Expected**: Validation messages are contextually appropriate
- **Verification**:
  - File size errors mention correct item type
  - File type errors use appropriate terminology
  - File count errors reflect the selected mode

#### Test: Network Connectivity
- **Scenario**: Network issues during generation
- **Expected**: Graceful degradation and recovery
- **Verification**:
  - Appropriate error messages for network issues
  - User can retry operations
  - State is preserved during network issues

## Test Implementation Notes

### Required Test Setup
- Jest for unit testing
- React Testing Library for component testing
- Mock implementations for external services
- Test utilities for file upload simulation

### Mock Requirements
- Gemini API service mocks
- Replicate service mocks
- Clerk authentication mocks
- File system operation mocks
- Network request mocks

### Test Data
- Sample garment images for testing
- Sample product images for testing
- Mock API responses for different scenarios
- Error response samples for error handling tests

## Success Criteria

### Functional Requirements
- ✅ All existing functionality works in both photoshoot modes
- ✅ UI updates immediately when switching modes
- ✅ Prompts are contextually appropriate for each mode
- ✅ Error messages use correct terminology
- ✅ State management works correctly

### Performance Requirements
- Mode switching should be instantaneous
- No memory leaks during mode switching
- Consistent performance across both modes

### Usability Requirements
- Clear visual feedback for mode selection
- Intuitive behavior when switching modes
- Consistent user experience across modes

## Test Coverage Goals
- 90%+ code coverage for photoshoot-related functionality
- 100% coverage of mode switching logic
- Complete coverage of UI text updates
- Full coverage of service prompt generation
- Comprehensive error handling coverage

## Automated Testing Strategy
- Unit tests for utility functions
- Integration tests for component interactions
- End-to-end tests for complete workflows
- Visual regression tests for UI consistency
- Performance tests for mode switching speed

This testing plan ensures comprehensive coverage of the photoshoot type toggle feature while maintaining the quality and reliability of existing functionality.