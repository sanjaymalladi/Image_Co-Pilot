import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import EditChatInterface from '../EditChatInterface';
import { RefinedPromptItem } from '../../App';

// Mock the edit service
const mockEditService = {
  editMultipleImages: vi.fn(),
  validateEditRequest: vi.fn(),
  generateContextualPrompts: vi.fn(),
};

vi.mock('../../services/editService', () => ({
  getEditService: () => mockEditService,
}));

// Mock components
vi.mock('../Button', () => ({
  Button: ({ children, onClick, disabled, type, variant, ...props }: any) => (
    <button 
      onClick={onClick} 
      disabled={disabled} 
      type={type}
      data-variant={variant}
      {...props}
    >
      {children}
    </button>
  ),
}));

vi.mock('../Spinner', () => ({
  Spinner: ({ className }: any) => <div data-testid="spinner" className={className} />,
}));

vi.mock('../Icons', () => ({
  XCircleIcon: (props: any) => <div data-testid="x-circle-icon" {...props} />,
  PaperAirplaneIcon: (props: any) => <div data-testid="paper-airplane-icon" {...props} />,
  PhotoIcon: (props: any) => <div data-testid="photo-icon" {...props} />,
  SparklesIcon: (props: any) => <div data-testid="sparkles-icon" {...props} />,
  LightBulbIcon: (props: any) => <div data-testid="lightbulb-icon" {...props} />,
}));

const mockImages: RefinedPromptItem[] = [
  {
    id: 'image-1',
    title: 'Test Image 1',
    prompt: 'A beautiful landscape',
    isCopied: false,
    isLoadingImage: false,
    aspectRatio: '16:9',
    imageUrl: 'https://example.com/image1.jpg',
  },
  {
    id: 'image-2',
    title: 'Test Image 2',
    prompt: 'A portrait photo',
    isCopied: false,
    isLoadingImage: false,
    aspectRatio: '3:4',
    imageUrl: 'https://example.com/image2.jpg',
  },
];

describe('EditChatInterface', () => {
  const defaultProps = {
    currentImages: mockImages,
    onEditComplete: vi.fn(),
    onClose: vi.fn(),
    editMode: 'all' as const,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockEditService.validateEditRequest.mockReturnValue({ valid: true });
    mockEditService.generateContextualPrompts.mockReturnValue([
      'Change the color to blue',
      'Make it brighter',
      'Add more contrast',
    ]);
  });

  it('renders with welcome message for all mode', () => {
    render(<EditChatInterface {...defaultProps} />);

    expect(screen.getByText('Edit 2 Images')).toBeInTheDocument();
    expect(screen.getByText(/Ready to edit 2 images/)).toBeInTheDocument();
  });

  it('renders with welcome message for single mode', () => {
    render(
      <EditChatInterface 
        {...defaultProps} 
        editMode="single" 
        selectedImageId="image-1"
      />
    );

    expect(screen.getByText('Edit Image')).toBeInTheDocument();
    expect(screen.getByText(/Ready to edit your selected image/)).toBeInTheDocument();
  });

  it('allows user to type and submit edit requests', async () => {
    mockEditService.editMultipleImages.mockResolvedValue({
      results: [
        { success: true, imageUrl: 'https://example.com/edited1.jpg' },
        { success: true, imageUrl: 'https://example.com/edited2.jpg' },
      ],
      successCount: 2,
      failureCount: 0,
    });

    render(<EditChatInterface {...defaultProps} />);

    const input = screen.getByPlaceholderText('Describe the changes you want to make...');
    const submitButton = screen.getByTestId('paper-airplane-icon').closest('button');

    fireEvent.change(input, { target: { value: 'Make it blue' } });
    fireEvent.click(submitButton!);

    expect(screen.getByText('Make it blue')).toBeInTheDocument();

    await waitFor(() => {
      expect(mockEditService.editMultipleImages).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            prompt: 'Make it blue',
            inputImage: 'https://example.com/image1.jpg',
          }),
        ]),
        expect.any(Function)
      );
    });
  });

  it('shows suggestions when lightbulb button is clicked', () => {
    render(<EditChatInterface {...defaultProps} />);

    const suggestionsButton = screen.getByTestId('lightbulb-icon').closest('button');
    fireEvent.click(suggestionsButton!);

    expect(screen.getByText('Suggestions:')).toBeInTheDocument();
    expect(screen.getByText('Change the color to blue')).toBeInTheDocument();
    expect(screen.getByText('Make it brighter')).toBeInTheDocument();
  });

  it('applies suggestion when clicked', () => {
    render(<EditChatInterface {...defaultProps} />);

    const suggestionsButton = screen.getByTestId('lightbulb-icon').closest('button');
    fireEvent.click(suggestionsButton!);

    const suggestion = screen.getByText('Change the color to blue');
    fireEvent.click(suggestion);

    const input = screen.getByPlaceholderText('Describe the changes you want to make...');
    expect(input).toHaveValue('Change the color to blue');
  });

  it('handles edit errors gracefully', async () => {
    mockEditService.validateEditRequest.mockReturnValue({
      valid: false,
      error: 'Invalid prompt',
    });

    render(<EditChatInterface {...defaultProps} />);

    const input = screen.getByPlaceholderText('Describe the changes you want to make...');
    const submitButton = screen.getByTestId('paper-airplane-icon').closest('button');

    fireEvent.change(input, { target: { value: 'Invalid edit' } });
    fireEvent.click(submitButton!);

    await waitFor(() => {
      expect(screen.getByText('Error: Invalid prompt')).toBeInTheDocument();
    });
  });

  it('shows processing state during edit', async () => {
    let resolveEdit: (value: any) => void;
    const editPromise = new Promise((resolve) => {
      resolveEdit = resolve;
    });
    mockEditService.editMultipleImages.mockReturnValue(editPromise);

    render(<EditChatInterface {...defaultProps} />);

    const input = screen.getByPlaceholderText('Describe the changes you want to make...');
    const submitButton = screen.getByTestId('paper-airplane-icon').closest('button');

    fireEvent.change(input, { target: { value: 'Make it blue' } });
    fireEvent.click(submitButton!);

    expect(screen.getByText('Processing edits for 2 images...')).toBeInTheDocument();
    expect(screen.getByTestId('spinner')).toBeInTheDocument();

    // Resolve the promise
    resolveEdit!({
      results: [
        { success: true, imageUrl: 'https://example.com/edited1.jpg' },
        { success: true, imageUrl: 'https://example.com/edited2.jpg' },
      ],
      successCount: 2,
      failureCount: 0,
    });

    await waitFor(() => {
      expect(screen.getByText(/Successfully edited 2 images/)).toBeInTheDocument();
    });
  });

  it('displays edited images in chat', async () => {
    mockEditService.editMultipleImages.mockResolvedValue({
      results: [
        { success: true, imageUrl: 'https://example.com/edited1.jpg' },
        { success: true, imageUrl: 'https://example.com/edited2.jpg' },
      ],
      successCount: 2,
      failureCount: 0,
    });

    render(<EditChatInterface {...defaultProps} />);

    const input = screen.getByPlaceholderText('Describe the changes you want to make...');
    const submitButton = screen.getByTestId('paper-airplane-icon').closest('button');

    fireEvent.change(input, { target: { value: 'Make it blue' } });
    fireEvent.click(submitButton!);

    await waitFor(() => {
      const editedImages = screen.getAllByAltText('Edited result');
      expect(editedImages).toHaveLength(2);
      expect(editedImages[0]).toHaveAttribute('src', 'https://example.com/edited1.jpg');
      expect(editedImages[1]).toHaveAttribute('src', 'https://example.com/edited2.jpg');
    });
  });

  it('calls onEditComplete with updated images', async () => {
    mockEditService.editMultipleImages.mockResolvedValue({
      results: [
        { success: true, imageUrl: 'https://example.com/edited1.jpg' },
        { success: true, imageUrl: 'https://example.com/edited2.jpg' },
      ],
      successCount: 2,
      failureCount: 0,
    });

    render(<EditChatInterface {...defaultProps} />);

    const input = screen.getByPlaceholderText('Describe the changes you want to make...');
    const submitButton = screen.getByTestId('paper-airplane-icon').closest('button');

    fireEvent.change(input, { target: { value: 'Make it blue' } });
    fireEvent.click(submitButton!);

    await waitFor(() => {
      expect(defaultProps.onEditComplete).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            id: 'image-1',
            imageUrl: 'https://example.com/edited1.jpg',
          }),
          expect.objectContaining({
            id: 'image-2',
            imageUrl: 'https://example.com/edited2.jpg',
          }),
        ])
      );
    });
  });

  it('handles mixed success and failure results', async () => {
    mockEditService.editMultipleImages.mockResolvedValue({
      results: [
        { success: true, imageUrl: 'https://example.com/edited1.jpg' },
        { success: false, error: 'Edit failed' },
      ],
      successCount: 1,
      failureCount: 1,
    });

    render(<EditChatInterface {...defaultProps} />);

    const input = screen.getByPlaceholderText('Describe the changes you want to make...');
    const submitButton = screen.getByTestId('paper-airplane-icon').closest('button');

    fireEvent.change(input, { target: { value: 'Make it blue' } });
    fireEvent.click(submitButton!);

    await waitFor(() => {
      expect(screen.getByText(/1 images edited successfully, 1 failed/)).toBeInTheDocument();
    });
  });

  it('calls onClose when close button is clicked', () => {
    render(<EditChatInterface {...defaultProps} />);

    const closeButton = screen.getByTestId('x-circle-icon').closest('button');
    fireEvent.click(closeButton!);

    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('disables input and buttons during processing', async () => {
    let resolveEdit: (value: any) => void;
    const editPromise = new Promise((resolve) => {
      resolveEdit = resolve;
    });
    mockEditService.editMultipleImages.mockReturnValue(editPromise);

    render(<EditChatInterface {...defaultProps} />);

    const input = screen.getByPlaceholderText('Describe the changes you want to make...');
    const submitButton = screen.getByTestId('paper-airplane-icon').closest('button');
    const suggestionsButton = screen.getByTestId('lightbulb-icon').closest('button');

    fireEvent.change(input, { target: { value: 'Make it blue' } });
    fireEvent.click(submitButton!);

    expect(input).toBeDisabled();
    expect(submitButton).toBeDisabled();
    expect(suggestionsButton).toBeDisabled();

    // Resolve the promise
    resolveEdit!({
      results: [{ success: true, imageUrl: 'https://example.com/edited.jpg' }],
      successCount: 1,
      failureCount: 0,
    });

    await waitFor(() => {
      expect(input).not.toBeDisabled();
      expect(submitButton).not.toBeDisabled();
      expect(suggestionsButton).not.toBeDisabled();
    });
  });
});