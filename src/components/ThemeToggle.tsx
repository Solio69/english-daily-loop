import React from "react";
import { Moon, Send, Sun } from "lucide-react";
import { useTheme } from "../context/ThemeContext";
import type { ThemePreference } from "../context/ThemeContext";

const THEME_OPTIONS: Array<{
  value: ThemePreference;
  label: string;
  icon: React.ElementType;
}> = [
  { value: "system", label: "Как в Telegram", icon: Send },
  { value: "light", label: "Светлая тема", icon: Sun },
  { value: "dark", label: "Темная тема", icon: Moon },
];

export const ThemeToggle: React.FC = () => {
  const { themePreference, setThemePreference } = useTheme();

  return (
    <div
      aria-label="Выбор темы"
      className="glass-control flex h-9 shrink-0 items-center gap-1 rounded-[18px] p-1"
      role="radiogroup"
    >
      {THEME_OPTIONS.map(({ value, label, icon: Icon }) => {
        const isActive = themePreference === value;

        return (
          <button
            key={value}
            type="button"
            aria-label={label}
            aria-checked={isActive}
            role="radio"
            title={label}
            onClick={() => setThemePreference(value)}
            className={`grid h-7 w-9 place-items-center rounded-[13px] transition active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)] ${
              isActive
                ? "bg-[var(--primary-soft)] text-[var(--primary)] shadow-primary-glow"
                : "text-[var(--text-muted)] hover:text-[var(--primary)]"
            }`}
          >
            <Icon size={15} strokeWidth={2.2} />
          </button>
        );
      })}
    </div>
  );
};
