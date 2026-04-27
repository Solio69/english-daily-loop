import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline';
}

export const Button: React.FC<ButtonProps> = ({ variant = 'primary', className, ...props }) => {
  const baseClasses = 'px-4 py-2 rounded-xl font-medium transition duration-200';
  const variants = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700',
    secondary: 'bg-gray-200 text-gray-800 hover:bg-gray-300',
    outline: 'border border-blue-600 text-blue-600 hover:bg-blue-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800',
  };
  
  return (
    <button className={`${baseClasses} ${variants[variant]} ${className || ''}`} {...props} />
  );
};
