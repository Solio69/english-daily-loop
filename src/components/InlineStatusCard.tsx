import { Check, Info, TriangleAlert, XCircle } from "lucide-react";
import React from "react";

export type InlineStatusVariant = "success" | "warning" | "error" | "info";

type InlineStatusCardProps = {
  variant: InlineStatusVariant;
  title: string;
  description?: string;
  className?: string;
};

const STATUS_CONFIG = {
  success: {
    icon: Check,
    iconClass: "text-[var(--primary)]",
    iconWrapClass:
      "border-[var(--primary)] bg-[var(--primary-soft)] shadow-[0_0_32px_var(--primary-glow)]",
  },
  warning: {
    icon: TriangleAlert,
    iconClass: "text-[var(--accent-warm)]",
    iconWrapClass:
      "border-[var(--accent-warm)] bg-[var(--accent-warm-soft)] shadow-warm-glow",
  },
  error: {
    icon: XCircle,
    iconClass: "text-[var(--accent-coral)]",
    iconWrapClass:
      "border-[var(--accent-coral)] bg-[rgba(255,107,97,0.12)] shadow-[0_0_34px_var(--accent-coral-glow)]",
  },
  info: {
    icon: Info,
    iconClass: "text-[var(--primary)]",
    iconWrapClass:
      "border-[var(--border-strong)] bg-[var(--primary-soft)] shadow-[0_0_28px_var(--primary-glow)]",
  },
} satisfies Record<
  InlineStatusVariant,
  {
    icon: React.ElementType;
    iconClass: string;
    iconWrapClass: string;
  }
>;

export const InlineStatusCard: React.FC<InlineStatusCardProps> = ({
  variant,
  title,
  description,
  className,
}) => {
  const config = STATUS_CONFIG[variant];
  const Icon = config.icon;

  return (
    <section
      className={`glass-card flex items-center gap-3 rounded-[20px] p-4 ${className ?? ""}`}
    >
      <div
        className={`grid size-12 shrink-0 place-items-center rounded-full border backdrop-blur-[18px] ${config.iconWrapClass}`}
      >
        <Icon className={`size-6 ${config.iconClass}`} strokeWidth={2.4} />
      </div>

      <div className="min-w-0">
        <h2 className="font-heading text-base font-semibold leading-6 text-[var(--text-primary)]">
          {title}
        </h2>
        {description ? (
          <p className="mt-1 text-sm leading-5 text-[var(--text-secondary)]">
            {description}
          </p>
        ) : null}
      </div>
    </section>
  );
};
