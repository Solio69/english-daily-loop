import React from "react";
import { AlertCircle, CheckCircle2, Info, Settings } from "lucide-react";

export type ToastTone = "default" | "onboarding" | "success" | "error";

type ToastProps = {
  message: string;
  tone?: ToastTone;
};

const TOAST_STYLES: Record<ToastTone, string> = {
  default: "border-[var(--border)] text-[var(--text-primary)]",
  onboarding:
    "border-[var(--accent-warm)] bg-[var(--accent-warm-soft)] text-[var(--accent-warm)] shadow-warm-glow",
  success:
    "border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)] shadow-primary-glow",
  error:
    "border-[#DD3D4C] bg-[color-mix(in_srgb,#DD3D4C_12%,transparent)] text-[#DD3D4C]",
};

const TOAST_ICONS: Record<ToastTone, React.ElementType> = {
  default: Info,
  onboarding: Settings,
  success: CheckCircle2,
  error: AlertCircle,
};

export const Toast: React.FC<ToastProps> = ({ message, tone = "default" }) => {
  const Icon = TOAST_ICONS[tone];

  return (
    <div
      className={`glass-control fixed bottom-[calc(env(safe-area-inset-bottom)+5.75rem)] left-1/2 z-50 flex min-h-[72px] w-[calc(100%-2rem)] max-w-[430px] -translate-x-1/2 items-center gap-3 rounded-[20px] px-4 py-4 text-[15px] font-medium leading-5 backdrop-blur-[24px] min-[480px]:max-w-[390px] ${TOAST_STYLES[tone]}`}
    >
      <Icon className="shrink-0" size={20} strokeWidth={2.2} />
      <span>{message}</span>
    </div>
  );
};
