import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import HistoryView from '../HistoryView';
import { HistoryItem } from '../../services/historyService';

// Mock the history service
const mockHistoryService = {
  getHistory: vi.fn(),
  deleteFromHistory: vi.fn(),
};

vi.mock('../../services/historyService', () => ({
  getHistoryService: () => mockHistoryService,
}));

// Mock components
vi.mock('../Button', () => ({
  Button: ({ children, onClick, variant, ...props }: any) => (
    <button onClick={onClick} data-variant={variant} {...props}>
      {children}
    </button>
  ),
}));

vi.mock('../Spinner', () => ({
  Spinner: ({ className }: any) => <div data-testid="spinner" className={className} />,
}));

vi.mock('../Modal', () => ({
  Modal: ({ children, isOpen, onClose, title }: any) => 
    isOpen ? (
      <div data-testid="modal">
        <div data-testid="modal-title">{title}</div>
        <button onClick={onClose} data-testid="modal-close">Close</button>
        {children}
      </div>
    ) : null,
}));

vi.mock('../Icons', () => ({
  XCircleIcon: (props: any) => <div data-testid="x-circle-icon" {...props} />,
  ClockIcon: (props: any) => <div data-testid="clock-icon" {...props} />,
  PhotoIcon: (props: any) => <div data-testid="photo-icon" {...props} />,
  TrashIcon: (props: any) => <div data-testid="trash-icon" {...props} />,
  EyeIcon: (props: any) => <div data-testid="eye-icon" {...props} />,
}));

const mockHistoryItems: HistoryItem[] = [
  {
    _id: 'item-1' as any,
    userId: 'user-1',
    prompt: 'A beautiful sunset over mountains',
    imageUrl: 'https://example.com/image1.jpg',
    title: 'Sunset Image',
    aspectRatio: '16:9',
    createdAt: Date.now() - 1000 * 60 * 60, // 1 hour ago
    metadata: {
      model: 'flux-dev',
      originalPrompt: 'sunset mountains',
    },
  },
  {
    _id: 'item-2' as any,
    userId: 'user-1',
    prompt: 'A cute cat sitting on a windowsill',
    imageUrl: 'https://example.com/image2.jpg',
    aspectRatio: '1:1',
    createdAt: Date.now() - 1000 * 60 * 60 * 24, // 1 day ago
  },
];

describe('HistoryView', () => {
  const defaultProps = {
    userId: 'user-1',
    onClose: vi.fn(),
    onImageSelect: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('displays loading state while fetching history', async () => {
    mockHistoryService.getHistory.mockImplementation(() => new Promise(() => {})); // Never resolves

    render(<HistoryView {...defaultProps} />);

    expect(screen.getByText('Loading your history...')).toBeInTheDocument();
    expect(screen.getByTestId('spinner')).toBeInTheDocument();
  });

  it('renders history items in grid layout', async () => {
    mockHistoryService.getHistory.mockResolvedValue(mockHistoryItems);

    render(<HistoryView {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Your History')).toBeInTheDocument();
      expect(screen.getByText('(2 items)')).toBeInTheDocument();
    });

    expect(screen.getByText('Sunset Image')).toBeInTheDocument();
    expect(screen.getByText('A beautiful sunset over mountains')).toBeInTheDocument();
    expect(screen.getByText('A cute cat sitting on a windowsill')).toBeInTheDocument();
  });

  it('handles empty history state', async () => {
    mockHistoryService.getHistory.mockResolvedValue([]);

    render(<HistoryView {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('No history yet')).toBeInTheDocument();
      expect(screen.getByText('Your generated images will appear here once you start creating.')).toBeInTheDocument();
      expect(screen.getByTestId('photo-icon')).toBeInTheDocument();
    });
  });

  it('handles error state with retry option', async () => {
    const errorMessage = 'Failed to load history';
    mockHistoryService.getHistory.mockRejectedValue(new Error(errorMessage));

    render(<HistoryView {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
      expect(screen.getByText('Try Again')).toBeInTheDocument();
    });

    // Test retry functionality
    mockHistoryService.getHistory.mockResolvedValue(mockHistoryItems);
    fireEvent.click(screen.getByText('Try Again'));

    await waitFor(() => {
      expect(screen.getByText('Sunset Image')).toBeInTheDocument();
    });
  });

  it('opens detail modal when item is clicked', async () => {
    mockHistoryService.getHistory.mockResolvedValue(mockHistoryItems);

    render(<HistoryView {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Sunset Image')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Sunset Image'));

    expect(screen.getByTestId('modal')).toBeInTheDocument();
    expect(screen.getByTestId('modal-title')).toHaveTextContent('Sunset Image');
  });

  it('calls onImageSelect when item is clicked', async () => {
    mockHistoryService.getHistory.mockResolvedValue(mockHistoryItems);

    render(<HistoryView {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Sunset Image')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Sunset Image'));

    expect(defaultProps.onImageSelect).toHaveBeenCalledWith(mockHistoryItems[0]);
  });

  it('handles item deletion', async () => {
    mockHistoryService.getHistory.mockResolvedValue(mockHistoryItems);
    mockHistoryService.deleteFromHistory.mockResolvedValue(undefined);

    // Mock window.confirm
    const originalConfirm = window.confirm;
    window.confirm = vi.fn(() => true);

    render(<HistoryView {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Sunset Image')).toBeInTheDocument();
    });

    // Open detail modal
    fireEvent.click(screen.getByText('Sunset Image'));

    // Click delete button
    fireEvent.click(screen.getByTestId('trash-icon').closest('button')!);

    await waitFor(() => {
      expect(mockHistoryService.deleteFromHistory).toHaveBeenCalledWith('item-1');
    });

    // Restore window.confirm
    window.confirm = originalConfirm;
  });

  it('calls onClose when close button is clicked', async () => {
    mockHistoryService.getHistory.mockResolvedValue([]);

    render(<HistoryView {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByTestId('x-circle-icon')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('x-circle-icon').closest('button')!);

    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('formats dates correctly', async () => {
    const now = Date.now();
    const recentItem = {
      ...mockHistoryItems[0],
      createdAt: now - 1000 * 60 * 30, // 30 minutes ago
    };

    mockHistoryService.getHistory.mockResolvedValue([recentItem]);

    render(<HistoryView {...defaultProps} />);

    await waitFor(() => {
      // Should show time for recent items
      const timeElement = screen.getByText(/\d{1,2}:\d{2}/);
      expect(timeElement).toBeInTheDocument();
    });
  });
});