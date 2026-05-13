import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'accent';
}

export const Button: React.FC<ButtonProps> = ({ variant = 'primary', className, ...props }) => {
  const baseClasses =
    'inline-flex min-h-11 items-center justify-center gap-2 rounded-[22px] px-5 py-3 font-heading text-sm font-semibold transition duration-200 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]';
  const variants = {
    primary:
      'bg-[var(--accent-coral)] text-white shadow-coral-glow hover:brightness-105',
    secondary:
      'glass-control text-[var(--primary)] hover:border-[var(--border-strong)]',
    outline:
      'border border-[var(--border-strong)] bg-transparent text-[var(--primary)] hover:bg-[var(--primary-soft)]',
    accent:
      'bg-[var(--accent-coral)] text-white shadow-coral-glow hover:brightness-105',
  };
  
  return (
    <button className={`${baseClasses} ${variants[variant]} ${className || ''}`} {...props} />
  );
};
