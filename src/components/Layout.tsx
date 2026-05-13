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
    <div className="min-h-[100dvh] w-full bg-[var(--background)] text-[var(--text-primary)] transition-colors">
      <main
        className={`flex min-h-[100dvh] w-full flex-col ${
          showBottomNav ? "pb-20" : ""
        }`}
      >
        <div className="flex-1">{children}</div>
        {showBottomNav && (
          <BottomNav
            active={activeNav}
            onChange={onNavChange}
            disabledItems={disabledNavItems}
            onDisabledClick={onDisabledNavClick}
          />
        )}
      </main>
    </div>
  );
};
