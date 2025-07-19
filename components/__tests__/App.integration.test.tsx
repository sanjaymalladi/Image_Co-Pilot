// @ts-nocheck

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ClerkProvider } from '@clerk/clerk-react';
import App from '../../App';

// Mock the services
jest.mock('../../services/geminiService', () => ({
  generateFashionAnalysisAndInitialJsonPrompt: jest.fn(),
  performQaAndGenerateStudioPrompts: jest.fn(),
  generateSingleImage: jest.fn(),
  generateInitialQaImage: jest.fn(),
  generateImagePack: jest.fn(),
}));

jest.mock('../../services/replicateService', () => ({
  generateImageViaReplicate: jest.fn(),
}));

jest.mock('../../services/historyService', () => ({
  createHistoryService: jest.fn(() => ({
    saveToHistory: jest.fn(),
  })),
}));

jest.mock('../../lib/convex', () => ({}));

// Mock Clerk
const mockClerkProvider = ({ children }: { children: React.ReactNode }) => (
  <div data-testid="mock-clerk-provider">{children}</div>
);

jest.mock('@clerk/clerk-react', () => ({
  ClerkProvider: mockClerkProvider,
  SignedIn: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SignedOut: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  UserButton: () => <div data-testid="user-button">User Button</div>,
  SignInButton: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useUser: () => ({ user: null }),
}));

describe('App Integration Tests - Photoshoot Type Switching', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render with default garment photoshoot type', () => {
    render(<App />);
    
    // Check that the PhotoshootToggle is rendered
    expect(screen.getByText('Garment')).toBeInTheDocument();
    expect(screen.getByText('Product')).toBeInTheDocument();
    
    // Check that garment is selected by default
    const garmentButton = screen.getByLabelText('Switch to garment photoshoot mode');
    expect(garmentButton).toHaveAttribute('aria-pressed', 'true');
  });

  it('should update UI text when switching from garment to product mode', async () => {
    render(<App />);
    
    // Initially should show garment-specific text
    expect(screen.getByText(/Upload your garment/)).toBeInTheDocument();
    
    // Switch to product mode
    const productButton = screen.getByLabelText('Switch to product photoshoot mode');
    fireEvent.click(productButton);
    
    // Should now show product-specific text
    await waitFor(() => {
      expect(screen.getByText(/Upload your product/)).toBeInTheDocument();
    });
    
    // Check that product is now selected
    expect(productButton).toHaveAttribute('aria-pressed', 'true');
    const garmentButton = screen.getByLabelText('Switch to garment photoshoot mode');
    expect(garmentButton).toHaveAttribute('aria-pressed', 'false');
  });

  it('should update upload labels when switching photoshoot types', async () => {
    render(<App />);
    
    // Initially should show "Garment Image(s)"
    expect(screen.getByText('Upload Garment Images')).toBeInTheDocument();
    
    // Switch to product mode
    const productButton = screen.getByLabelText('Switch to product photoshoot mode');
    fireEvent.click(productButton);
    
    // Should now show "Upload Product Images"
    await waitFor(() => {
      expect(screen.getByText('Upload Product Images')).toBeInTheDocument();
    });
    
    // Switch back to garment mode
    const garmentButton = screen.getByLabelText('Switch to garment photoshoot mode');
    fireEvent.click(garmentButton);
    
    // Should show garment labels again
    await waitFor(() => {
      expect(screen.getByText('Upload Garment Images')).toBeInTheDocument();
    });
  });

  it('should show appropriate pack descriptions based on photoshoot type', async () => {
    render(<App />);
    
    // Mock file upload to show pack selection
    const fileInput = screen.getByLabelText(/Upload Garment Images/);
    const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
    
    fireEvent.change(fileInput, { target: { files: [mockFile] } });
    
    // Wait for pack selection to appear
    await waitFor(() => {
      expect(screen.getByText('Studio Pack (4 Images)')).toBeInTheDocument();
    });
    
    // Select studio pack to show description
    const studioCheckbox = screen.getByRole('checkbox', { name: /Studio Pack/ });
    fireEvent.click(studioCheckbox);
    
    // Should show garment-specific studio description
    await waitFor(() => {
      expect(screen.getByText(/Professional studio shots with clean backgrounds/)).toBeInTheDocument();
    });
    
    // Switch to product mode
    const productButton = screen.getByLabelText('Switch to product photoshoot mode');
    fireEvent.click(productButton);
    
    // Upload a product image
    await waitFor(() => {
      const productFileInput = screen.getByLabelText(/Upload Product Images/);
      fireEvent.change(productFileInput, { target: { files: [mockFile] } });
    });
    
    // Select studio pack again
    await waitFor(() => {
      const productStudioCheckbox = screen.getByRole('checkbox', { name: /Studio Pack/ });
      fireEvent.click(productStudioCheckbox);
    });
    
    // Should show product-specific studio description
    await waitFor(() => {
      expect(screen.getByText(/Professional studio shots highlighting product features/)).toBeInTheDocument();
    });
  });

  it('should clear state when switching photoshoot types', async () => {
    render(<App />);
    
    // Upload a file in garment mode
    const fileInput = screen.getByLabelText(/Upload Garment Images/);
    const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
    fireEvent.change(fileInput, { target: { files: [mockFile] } });
    
    // Wait for file to be processed
    await waitFor(() => {
      expect(screen.getByText('Generate Image Pack')).toBeInTheDocument();
    });
    
    // Switch to product mode
    const productButton = screen.getByLabelText('Switch to product photoshoot mode');
    fireEvent.click(productButton);
    
    // The pack generation section should be gone (state cleared)
    await waitFor(() => {
      expect(screen.queryByText('Generate Image Pack')).not.toBeInTheDocument();
    });
  });

  it('should maintain photoshoot type selection during session', () => {
    render(<App />);
    
    // Switch to product mode
    const productButton = screen.getByLabelText('Switch to product photoshoot mode');
    fireEvent.click(productButton);
    
    // Product should remain selected
    expect(productButton).toHaveAttribute('aria-pressed', 'true');
    
    // Upload a file and the product context should be maintained
    const fileInput = screen.getByLabelText(/Upload Product Images/);
    expect(fileInput).toBeInTheDocument();
  });

  it('should disable toggle when loading', async () => {
    const { generateFashionAnalysisAndInitialJsonPrompt } = require('../../services/geminiService');
    
    // Mock a long-running operation
    generateFashionAnalysisAndInitialJsonPrompt.mockImplementation(
      () => new Promise(resolve => setTimeout(resolve, 1000))
    );
    
    render(<App />);
    
    // Upload a file to trigger analysis
    const fileInput = screen.getByLabelText(/Upload Garment Images/);
    const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
    fireEvent.change(fileInput, { target: { files: [mockFile] } });
    
    // Wait for pack generation to appear and click generate
    await waitFor(() => {
      const generateButton = screen.getByText(/Generate/);
      fireEvent.click(generateButton);
    });
    
    // Toggle should be disabled during loading
    const garmentButton = screen.getByLabelText('Switch to garment photoshoot mode');
    const productButton = screen.getByLabelText('Switch to product photoshoot mode');
    
    expect(garmentButton).toBeDisabled();
    expect(productButton).toBeDisabled();
  });
});