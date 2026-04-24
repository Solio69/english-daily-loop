import React from "react";

export type ToastTone = "default" | "onboarding" | "success" | "error";

type ToastProps = {
  message: string;
  tone?: ToastTone;
};

const TOAST_STYLES: Record<ToastTone, string> = {
  default: "bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900",
  onboarding: "bg-pink-500 text-white dark:bg-pink-500 dark:text-white",
  success: "bg-green-500 text-white dark:bg-orange-500 dark:text-white",
  error: "bg-[#DD3D4C] text-white dark:bg-[#DD3D4C] dark:text-white",
};

export const Toast: React.FC<ToastProps> = ({ message, tone = "default" }) => {
  return (
    <div
      className={`fixed top-4 left-1/2 z-50 w-[calc(100%-3rem)] max-w-md -translate-x-1/2 rounded-lg px-4 py-3 text-sm shadow-lg ${TOAST_STYLES[tone]}`}
    >
      {message}
    </div>
  );
};
