// @ts-nocheck

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { PhotoshootToggle } from '../PhotoshootToggle';
import { PhotoshootType } from '../../types/photoshoot';

describe('PhotoshootToggle', () => {
  const mockOnChange = jest.fn();

  beforeEach(() => {
    mockOnChange.mockClear();
  });

  it('renders both toggle options', () => {
    render(
      <PhotoshootToggle
        photoshootType="garment"
        onPhotoshootTypeChange={mockOnChange}
      />
    );

    expect(screen.getByText('Garment')).toBeInTheDocument();
    expect(screen.getByText('Product')).toBeInTheDocument();
  });

  it('shows garment as active when garment type is selected', () => {
    render(
      <PhotoshootToggle
        photoshootType="garment"
        onPhotoshootTypeChange={mockOnChange}
      />
    );

    const garmentButton = screen.getByLabelText('Switch to garment photoshoot mode');
    const productButton = screen.getByLabelText('Switch to product photoshoot mode');

    expect(garmentButton).toHaveAttribute('aria-pressed', 'true');
    expect(productButton).toHaveAttribute('aria-pressed', 'false');
  });

  it('shows product as active when product type is selected', () => {
    render(
      <PhotoshootToggle
        photoshootType="product"
        onPhotoshootTypeChange={mockOnChange}
      />
    );

    const garmentButton = screen.getByLabelText('Switch to garment photoshoot mode');
    const productButton = screen.getByLabelText('Switch to product photoshoot mode');

    expect(garmentButton).toHaveAttribute('aria-pressed', 'false');
    expect(productButton).toHaveAttribute('aria-pressed', 'true');
  });

  it('calls onPhotoshootTypeChange when clicking inactive option', () => {
    render(
      <PhotoshootToggle
        photoshootType="garment"
        onPhotoshootTypeChange={mockOnChange}
      />
    );

    const productButton = screen.getByLabelText('Switch to product photoshoot mode');
    fireEvent.click(productButton);

    expect(mockOnChange).toHaveBeenCalledWith('product');
  });

  it('does not call onPhotoshootTypeChange when clicking active option', () => {
    render(
      <PhotoshootToggle
        photoshootType="garment"
        onPhotoshootTypeChange={mockOnChange}
      />
    );

    const garmentButton = screen.getByLabelText('Switch to garment photoshoot mode');
    fireEvent.click(garmentButton);

    expect(mockOnChange).not.toHaveBeenCalled();
  });

  it('disables both buttons when disabled prop is true', () => {
    render(
      <PhotoshootToggle
        photoshootType="garment"
        onPhotoshootTypeChange={mockOnChange}
        disabled={true}
      />
    );

    const garmentButton = screen.getByLabelText('Switch to garment photoshoot mode');
    const productButton = screen.getByLabelText('Switch to product photoshoot mode');

    expect(garmentButton).toBeDisabled();
    expect(productButton).toBeDisabled();
  });

  it('does not call onPhotoshootTypeChange when disabled', () => {
    render(
      <PhotoshootToggle
        photoshootType="garment"
        onPhotoshootTypeChange={mockOnChange}
        disabled={true}
      />
    );

    const productButton = screen.getByLabelText('Switch to product photoshoot mode');
    fireEvent.click(productButton);

    expect(mockOnChange).not.toHaveBeenCalled();
  });

  it('applies correct CSS classes for active state', () => {
    render(
      <PhotoshootToggle
        photoshootType="garment"
        onPhotoshootTypeChange={mockOnChange}
      />
    );

    const garmentButton = screen.getByLabelText('Switch to garment photoshoot mode');
    expect(garmentButton).toHaveClass('bg-secondary', 'text-primary');
  });

  it('applies correct CSS classes for inactive state', () => {
    render(
      <PhotoshootToggle
        photoshootType="garment"
        onPhotoshootTypeChange={mockOnChange}
      />
    );

    const productButton = screen.getByLabelText('Switch to product photoshoot mode');
    expect(productButton).toHaveClass('bg-primary', 'text-secondary');
  });
});