import React from 'react';
import { Home, BookOpen, BookText, BrainCircuit } from 'lucide-react';

interface NavItem {
  id: string;
  label: string;
  icon: React.ElementType;
}

const navItems: NavItem[] = [
  { id: 'home', label: 'Главная', icon: Home },
  { id: 'exercises', label: 'Упражнения', icon: BrainCircuit },
  { id: 'reading', label: 'Текст', icon: BookOpen },
  { id: 'vocabulary', label: 'Слова', icon: BookText },
];

type BottomNavProps = {
  active: string;
  onChange: (id: string) => void;
  disabledItems?: string[];
  onDisabledClick?: (id: string) => void;
};

export const BottomNav: React.FC<BottomNavProps> = ({ active, onChange, disabledItems = [], onDisabledClick }) => {
  return (
    <div className="fixed inset-x-0 bottom-0 z-20 px-2 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-1.5">
      <nav className="mx-auto grid max-w-[430px] grid-cols-4 rounded-[22px] border border-[var(--border)] bg-[var(--surface-strong)] p-1.5 shadow-primary-glow backdrop-blur-[24px] min-[480px]:max-w-[390px]">
        {navItems.map((item) => {
          const isDisabled = disabledItems.includes(item.id);
          const isActive = active === item.id;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              aria-label={item.label}
              aria-current={isActive ? "page" : undefined}
              onClick={() => (isDisabled ? onDisabledClick?.(item.id) : onChange(item.id))}
              className={`flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-[18px] px-0.5 py-1.5 text-[9px] font-semibold leading-none transition active:scale-[0.98] min-[390px]:text-[10px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)] ${
                isActive
                  ? 'bg-[var(--primary-soft)] text-[var(--primary)] shadow-primary-glow'
                  : 'text-[var(--text-muted)] hover:bg-[var(--surface)]'
              } ${isDisabled ? 'opacity-40' : ''}`}
          >
            <Icon size={19} strokeWidth={2.2} />
            <span className="block max-w-full truncate">{item.label}</span>
          </button>
          );
        })}
      </nav>
    </div>
  );
};

