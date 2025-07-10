// @ts-nocheck

import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary';
  size?: 'sm' | 'default';
}

export const Button: React.FC<ButtonProps> = ({ children, className, variant = 'primary', size = 'default', ...props }) => {
  const baseStyle = "font-semibold rounded-lg transition-all duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 flex items-center justify-center gap-2";
  
  const variantStyles = {
    primary: "bg-secondary hover:bg-black text-primary focus:ring-secondary focus:ring-offset-primary disabled:bg-muted disabled:text-primary disabled:cursor-not-allowed shadow-sm hover:shadow-md",
    secondary: "bg-primary hover:bg-muted/20 text-secondary focus:ring-secondary focus:ring-offset-primary disabled:bg-muted/10 disabled:text-muted disabled:cursor-not-allowed border border-muted hover:border-secondary",
  };

  const sizeStyles = {
    sm: "text-xs py-1 px-2",
    default: "text-sm py-2.5 px-5",
  };

  return (
    <button
      className={`${baseStyle} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};
