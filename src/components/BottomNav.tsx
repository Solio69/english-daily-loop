import React from 'react';
import { Home, BookOpen, BookText, BrainCircuit } from 'lucide-react';

interface NavItem {
  id: string;
  label: string;
  icon: React.ElementType;
}

const navItems: NavItem[] = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'exercises', label: 'Exercises', icon: BrainCircuit },
  { id: 'reading', label: 'Read', icon: BookOpen },
  { id: 'vocabulary', label: 'Words', icon: BookText },
];

export const BottomNav: React.FC<{ active: string, onChange: (id: string) => void }> = ({ active, onChange }) => {
  return (
    <div className="fixed bottom-0 left-0 right-0 mx-auto max-w-md bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 pb-safe pt-2 px-2 flex justify-around items-center h-16">
      {navItems.map(item => (
        <button
          key={item.id}
          onClick={() => onChange(item.id)}
          className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${active === item.id ? 'text-blue-600 dark:text-orange-500' : 'text-gray-500 dark:text-gray-500'}`}
        >
          <item.icon size={24} />
          <span className="text-[10px] font-medium">{item.label}</span>
        </button>
      ))}
    </div>
  );
};
