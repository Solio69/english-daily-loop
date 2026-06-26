import { useCallback, useEffect, useState } from "react";
import type { ToastTone } from "../components/Toast";

export type ShowToast = (message: string, tone?: ToastTone) => void;

export const useToast = () => {
  const [toastText, setToastText] = useState<string | null>(null);
  const [toastTone, setToastTone] = useState<ToastTone>("default");

  const showToast = useCallback<ShowToast>(
    (message, tone = "default") => {
      setToastText(message);
      setToastTone(tone);
    },
    [],
  );

  const hideToast = useCallback(() => {
    setToastText(null);
  }, []);

  useEffect(() => {
    if (!toastText) return;
    const timeout = window.setTimeout(hideToast, 2500);
    return () => window.clearTimeout(timeout);
  }, [hideToast, toastText]);

  return {
    toastText,
    toastTone,
    showToast,
    hideToast,
  };
};
