import React from 'react';
import { BottomNav } from './BottomNav';

type LayoutProps = {
  children: React.ReactNode;
  activeNav: string;
  onNavChange: (id: string) => void;
  showBottomNav?: boolean;
  disabledNavItems?: string[];
  onDisabledNavClick?: (id: string) => void;
};

export const Layout: React.FC<LayoutProps> = ({
  children,
  activeNav,
  onNavChange,
  showBottomNav = true,
  disabledNavItems = [],
  onDisabledNavClick,
}) => {
  return (
    <div className={`min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 ${showBottomNav ? 'pb-20' : ''}`}>
      <main className="max-w-md mx-auto">{children}</main>
      {showBottomNav && (
        <BottomNav
          active={activeNav}
          onChange={onNavChange}
          disabledItems={disabledNavItems}
          onDisabledClick={onDisabledNavClick}
        />
      )}
    </div>
  );
};
