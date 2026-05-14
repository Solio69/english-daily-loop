import React from "react";
import { Check, TriangleAlert, X, XCircle } from "lucide-react";

export type AppToastVariant = "success" | "warning" | "error";
export type ToastTone = "default" | "onboarding" | "success" | "error";

export type AppToastProps = {
  variant: AppToastVariant;
  title: string;
  description?: string;
  onClose?: () => void;
  className?: string;
};

export type ToastViewportProps = {
  toast: {
    variant: AppToastVariant;
    title: string;
    description?: string;
  } | null;
  onClose: () => void;
};

type ToastProps = {
  message: string;
  tone?: ToastTone;
  onClose?: () => void;
};

const cx = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(" ");

const toastConfig = {
  success: {
    icon: Check,
    iconClass: "text-[#1F78E8] dark:text-[#6BD8FF]",
    iconWrapClass:
      "border-[rgba(31,120,232,0.26)] bg-[rgba(31,120,232,0.10)] shadow-[0_0_28px_rgba(31,120,232,0.22)] dark:border-[rgba(107,216,255,0.30)] dark:bg-[rgba(107,216,255,0.12)] dark:shadow-[0_0_30px_rgba(107,216,255,0.30)]",
    rootGlowClass:
      "border-[rgba(93,143,205,0.24)] bg-[rgba(255,255,255,0.72)] shadow-[0_20px_60px_rgba(42,88,145,0.14),inset_0_1px_0_rgba(255,255,255,0.72)] dark:border-[rgba(129,192,255,0.24)] dark:bg-[rgba(18,43,76,0.72)] dark:shadow-[0_24px_80px_rgba(0,0,0,0.42),inset_0_1px_0_rgba(255,255,255,0.14)]",
  },
  warning: {
    icon: TriangleAlert,
    iconClass: "text-[#F59E0B] dark:text-[#FFD17A]",
    iconWrapClass:
      "border-[rgba(245,158,11,0.28)] bg-[rgba(245,158,11,0.12)] shadow-[0_0_28px_rgba(245,158,11,0.24)] dark:border-[rgba(255,209,122,0.30)] dark:bg-[rgba(255,209,122,0.13)] dark:shadow-[0_0_30px_rgba(255,209,122,0.30)]",
    rootGlowClass:
      "border-[rgba(245,158,11,0.22)] bg-[rgba(255,251,244,0.74)] shadow-[0_20px_60px_rgba(145,96,24,0.13),inset_0_1px_0_rgba(255,255,255,0.72)] dark:border-[rgba(255,209,122,0.24)] dark:bg-[rgba(38,47,62,0.72)] dark:shadow-[0_24px_80px_rgba(0,0,0,0.42),inset_0_1px_0_rgba(255,255,255,0.14)]",
  },
  error: {
    icon: XCircle,
    iconClass: "text-[#EF4444] dark:text-[#FF7A6E]",
    iconWrapClass:
      "border-[rgba(239,68,68,0.24)] bg-[rgba(239,68,68,0.10)] shadow-[0_0_28px_rgba(239,68,68,0.22)] dark:border-[rgba(255,122,110,0.30)] dark:bg-[rgba(255,122,110,0.12)] dark:shadow-[0_0_30px_rgba(255,122,110,0.30)]",
    rootGlowClass:
      "border-[rgba(239,68,68,0.20)] bg-[rgba(255,247,247,0.74)] shadow-[0_20px_60px_rgba(145,42,42,0.12),inset_0_1px_0_rgba(255,255,255,0.72)] dark:border-[rgba(255,122,110,0.24)] dark:bg-[rgba(46,43,61,0.72)] dark:shadow-[0_24px_80px_rgba(0,0,0,0.42),inset_0_1px_0_rgba(255,255,255,0.14)]",
  },
} satisfies Record<
  AppToastVariant,
  {
    icon: React.ElementType;
    iconClass: string;
    iconWrapClass: string;
    rootGlowClass: string;
  }
>;

const toneToVariant: Record<ToastTone, AppToastVariant> = {
  default: "warning",
  onboarding: "warning",
  success: "success",
  error: "error",
};

export function AppToast({
  variant,
  title,
  description,
  onClose,
  className,
}: AppToastProps) {
  const config = toastConfig[variant];
  const Icon = config.icon;

  return (
    <div
      role="status"
      aria-live={variant === "error" ? "assertive" : "polite"}
      className={cx(
        "pointer-events-auto flex min-h-[70px] w-[calc(100%-32px)] max-w-[390px] items-center gap-3 rounded-[28px] border px-3.5 py-3 backdrop-blur-[24px] transition-all",
        config.rootGlowClass,
        className,
      )}
      style={{ animation: "app-toast-enter 220ms ease-out" }}
    >
      <div
        className={cx(
          "grid size-14 shrink-0 place-items-center rounded-full border backdrop-blur-[18px] min-[390px]:size-16",
          config.iconWrapClass,
        )}
      >
        <Icon className={cx("size-6 min-[390px]:size-7", config.iconClass)} strokeWidth={2.4} />
      </div>

      <div className="min-w-0 flex-1">
        <p className="font-heading text-[15px] font-bold leading-[1.3] tracking-[0.01em] text-[#071133] min-[390px]:text-[16px] dark:text-[#F2F7FF]">
          {title}
        </p>
        {description ? (
          <p className="mt-1 text-[14px] font-normal leading-[1.45] text-[#50678F] dark:text-[#AFC1DA]">
            {description}
          </p>
        ) : null}
      </div>

      {onClose ? (
        <button
          type="button"
          aria-label="Закрыть уведомление"
          onClick={onClose}
          className="grid size-9 shrink-0 place-items-center rounded-full text-[#7D8BA8] transition hover:bg-black/5 hover:text-[#071133] active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)] dark:text-[#AFC1DA] dark:hover:bg-white/10 dark:hover:text-white"
        >
          <X className="size-5" strokeWidth={2.2} />
        </button>
      ) : null}
    </div>
  );
}

export function ToastViewport({ toast, onClose }: ToastViewportProps) {
  if (!toast) return null;

  return (
    <div className="fixed left-1/2 top-[calc(env(safe-area-inset-top)+20px)] z-[100] flex w-full -translate-x-1/2 justify-center px-4">
      <AppToast
        variant={toast.variant}
        title={toast.title}
        description={toast.description}
        onClose={onClose}
      />
    </div>
  );
}

export const Toast: React.FC<ToastProps> = ({
  message,
  tone = "default",
  onClose,
}) => (
  <ToastViewport
    toast={{
      variant: toneToVariant[tone],
      title: message,
    }}
    onClose={onClose ?? (() => undefined)}
  />
);
