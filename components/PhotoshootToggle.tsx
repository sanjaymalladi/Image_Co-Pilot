// @ts-nocheck

import React from 'react';
import { PhotoshootType } from '../types/photoshoot';
import { ShoppingBagIcon, CubeIcon } from '@heroicons/react/24/outline';

interface PhotoshootToggleProps {
  photoshootType: PhotoshootType;
  onPhotoshootTypeChange: (type: PhotoshootType) => void;
  disabled?: boolean;
}

export const PhotoshootToggle: React.FC<PhotoshootToggleProps> = ({
  photoshootType,
  onPhotoshootTypeChange,
  disabled = false
}) => {
  const baseButtonStyle = "flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-secondary focus:ring-offset-primary disabled:cursor-not-allowed";
  
  const activeStyle = "bg-secondary text-primary shadow-sm";
  const inactiveStyle = "bg-primary text-secondary hover:bg-muted/10 border border-muted hover:border-secondary";
  const disabledStyle = "opacity-50";

  const handleToggle = (type: PhotoshootType) => {
    if (!disabled && type !== photoshootType) {
      onPhotoshootTypeChange(type);
    }
  };

  return (
    <div className="flex items-center gap-1 p-1 bg-muted/10 rounded-lg border border-muted/20">
      <button
        onClick={() => handleToggle('garment')}
        disabled={disabled}
        className={`
          ${baseButtonStyle}
          ${photoshootType === 'garment' ? activeStyle : inactiveStyle}
          ${disabled ? disabledStyle : ''}
        `}
        aria-pressed={photoshootType === 'garment'}
        aria-label="Switch to garment photoshoot mode"
      >
        <ShoppingBagIcon className="w-4 h-4" />
        Garment
      </button>
      
      <button
        onClick={() => handleToggle('product')}
        disabled={disabled}
        className={`
          ${baseButtonStyle}
          ${photoshootType === 'product' ? activeStyle : inactiveStyle}
          ${disabled ? disabledStyle : ''}
        `}
        aria-pressed={photoshootType === 'product'}
        aria-label="Switch to product photoshoot mode"
      >
        <CubeIcon className="w-4 h-4" />
        Product
      </button>
    </div>
  );
};