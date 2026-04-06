import React from 'react';
import { BottomNav } from './BottomNav';

export const Layout: React.FC<{ children: React.ReactNode, activeNav: string, onNavChange: (id: string) => void }> = ({ children, activeNav, onNavChange }) => {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 pb-20">
      <main className="max-w-md mx-auto">{children}</main>
      <BottomNav active={activeNav} onChange={onNavChange} />
    </div>
  );
};
