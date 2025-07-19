# Design Document

## Overview

This design replaces the Simple/Advanced workflow toggle with a Garment/Product photoshoot type selection, maintaining all existing functionality while providing contextually appropriate user interfaces and AI prompts. The solution leverages the existing architecture and simply adapts the presentation layer and prompt generation to be photoshoot-type aware.

## Architecture

### State Management Changes

The application will replace the `WorkflowMode` type and state with a `PhotoshootType`:

```typescript
type PhotoshootType = 'garment' | 'product';
const [photoshootType, setPhotoshootType] = useState<PhotoshootType>('garment');
```

### Component Structure

The existing component hierarchy remains unchanged. The main App component will pass the `photoshootType` down to child components that need to adapt their behavior or presentation.

### Service Layer Adaptations

The Gemini service will be enhanced to accept a photoshoot type parameter and use appropriate prompt templates for analysis and generation.

## Components and Interfaces

### PhotoshootType Toggle Component

A new toggle component will replace the existing Simple/Advanced toggle:

```typescript
interface PhotoshootToggleProps {
  photoshootType: PhotoshootType;
  onPhotoshootTypeChange: (type: PhotoshootType) => void;
  disabled?: boolean;
}
```

### Dynamic Text Provider

A utility function will provide contextually appropriate text based on photoshoot type:

```typescript
interface PhotoshootLabels {
  uploadMainLabel: string;
  uploadMainDescription: string;
  analysisTitle: string;
  mainItemName: string; // "garment" or "product"
  studioDescription: string;
  lifestyleDescription: string;
}

const getPhotoshootLabels = (type: PhotoshootType): PhotoshootLabels
```

### Enhanced Gemini Service Interface

The existing Gemini service functions will be enhanced to accept photoshoot type:

```typescript
interface AnalysisOptions {
  photoshootType: PhotoshootType;
}

generateFashionAnalysisAndInitialJsonPrompt(
  garmentImages: ImageInput[],
  backgroundRefImages?: ImageInput[],
  modelRefImages?: ImageInput[],
  options?: AnalysisOptions
): Promise<FashionPromptData>
```

## Data Models

### Photoshoot Configuration

```typescript
interface PhotoshootConfig {
  type: PhotoshootType;
  labels: PhotoshootLabels;
  promptTemplates: {
    analysisTemplate: string;
    studioTemplate: string;
    lifestyleTemplate: string;
  };
}
```

### Enhanced Prompt Data

The existing `FashionPromptData` interface will be renamed to be more generic:

```typescript
interface PromptData {
  itemAnalysis: string; // renamed from garmentAnalysis
  qaChecklist: string;
  initialJsonPrompt: string;
  photoshootType: PhotoshootType; // new field
}
```

## Error Handling

### Validation Updates

Error messages will be dynamically generated based on photoshoot type:
- "Please upload 1 or 2 garment image(s)" → "Please upload 1 or 2 product image(s)"
- File validation remains the same but error messages adapt

### Error Recovery

The existing error handling patterns remain unchanged. The photoshoot type context will be preserved during error states.

## Testing Strategy

### Unit Tests

1. **PhotoshootToggle Component Tests**
   - Toggle state changes
   - Disabled state handling
   - Callback invocation

2. **Dynamic Text Provider Tests**
   - Correct labels for garment mode
   - Correct labels for product mode
   - Edge case handling

3. **Enhanced Gemini Service Tests**
   - Garment-specific prompt generation
   - Product-specific prompt generation
   - Backward compatibility

### Integration Tests

1. **Mode Switching Tests**
   - State reset on mode change
   - UI updates on mode change
   - Prompt adaptation on mode change

2. **End-to-End Workflow Tests**
   - Complete garment photoshoot flow
   - Complete product photoshoot flow
   - Feature parity between modes

### Visual Regression Tests

1. **UI Consistency Tests**
   - Toggle appearance and behavior
   - Label updates across all screens
   - Icon and description changes

## Implementation Approach

### Phase 1: Core Infrastructure
- Replace WorkflowMode with PhotoshootType
- Create dynamic text provider
- Update state management

### Phase 2: UI Adaptations
- Implement PhotoshootToggle component
- Update all UI text to use dynamic labels
- Test mode switching behavior

### Phase 3: Service Enhancements
- Enhance Gemini service with photoshoot-aware prompts
- Create product-specific prompt templates
- Test prompt quality and relevance

### Phase 4: Integration and Polish
- End-to-end testing
- Performance optimization
- Documentation updates

## Prompt Template Strategy

### Garment Mode Prompts
- Focus on fashion terminology (fit, silhouette, fabric, styling)
- Consider fashion contexts (runway, street style, editorial)
- Emphasize wearability and fashion appeal

### Product Mode Prompts
- Focus on product features and benefits
- Consider use case scenarios and target demographics
- Emphasize functionality and lifestyle integration

### Template Structure
Both modes will use the same prompt structure but with different vocabulary and context:

```
Analysis Phase: [Type-specific analysis approach]
QA Phase: [Type-specific quality criteria]
Generation Phase: [Type-specific scene and styling]
```

## Backward Compatibility

The changes maintain full backward compatibility:
- All existing API signatures remain functional
- History data structure unchanged
- Image generation pipeline unchanged
- Edit and download features unchanged

## Performance Considerations

- No performance impact expected
- Prompt template selection adds minimal overhead
- State management changes are lightweight
- UI updates are reactive and efficient