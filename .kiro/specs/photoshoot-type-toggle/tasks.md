# Implementation Plan

- [x] 1. Create core type definitions and utilities


  - Define PhotoshootType type and related interfaces
  - Create dynamic text provider utility function
  - Write unit tests for text provider utility
  - _Requirements: 1.1, 2.1, 2.2_

- [x] 2. Implement PhotoshootToggle component




  - Create PhotoshootToggle component with proper styling
  - Implement toggle state management and callbacks
  - Add visual indicators for current selection
  - Write unit tests for PhotoshootToggle component
  - _Requirements: 1.1, 1.2, 1.3, 5.4_

- [x] 3. Update App component state management



  - Replace WorkflowMode with PhotoshootType in App.tsx
  - Update state initialization and reset logic
  - Implement photoshoot type change handler with state clearing
  - Update resetAllState function to work with new type system
  - _Requirements: 1.2, 1.3, 1.4, 5.1_

- [x] 4. Implement dynamic UI text system


  - Update all hardcoded text references to use dynamic labels
  - Modify file upload sections to show contextual labels
  - Update error messages to be photoshoot-type aware
  - Update progress indicators and status messages
  - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [x] 5. Enhance Gemini service with photoshoot-aware prompts


  - Create product-specific prompt templates
  - Update generateFashionAnalysisAndInitialJsonPrompt to accept photoshoot type
  - Update performQaAndGenerateStudioPrompts to use appropriate templates
  - Maintain backward compatibility with existing function signatures
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 6. Update data models and interfaces


  - Rename FashionPromptData to PromptData with generic field names
  - Add photoshootType field to prompt data structure
  - Update all references to use new interface names
  - Ensure type safety across all components
  - _Requirements: 4.1, 4.2_

- [x] 7. Write comprehensive tests


  - Create integration tests for mode switching behavior
  - Test UI updates when changing photoshoot types
  - Test prompt generation for both garment and product modes
  - Verify all existing functionality works in both modes
  - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [x] 8. Update component integration and polish



  - Integrate PhotoshootToggle into main App layout
  - Test complete user workflows for both photoshoot types
  - Verify state persistence during session
  - Add any missing visual feedback or loading states
  - _Requirements: 5.1, 5.2, 5.3, 5.4_