import { useCallback, useEffect, useState } from "react";
import { getCurrentAppUser } from "../services/userService";
import type { AppUser } from "../types/user";
import { getMoscowDate } from "../utils/moscowDate";
import type { ShowToast } from "./useToast";

type UseAppUserProfileParams = {
  onReady: () => void;
  showToast: ShowToast;
};

export const useAppUserProfile = ({
  onReady,
  showToast,
}: UseAppUserProfileParams) => {
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [profileSnapshotDate, setProfileSnapshotDate] = useState(() =>
    getMoscowDate(),
  );

  const appUserId = appUser?.id ?? null;

  const refreshCurrentUser = useCallback(async () => {
    const user = await getCurrentAppUser();
    setAppUser(user);
    setProfileSnapshotDate(getMoscowDate());
    return user;
  }, []);

  useEffect(() => {
    const bootstrap = async () => {
      try {
        window.Telegram?.WebApp?.ready?.();
        await refreshCurrentUser();
        onReady();
      } catch (error) {
        showToast(
          error instanceof Error
            ? error.message
            : "Не удалось загрузить профиль пользователя.",
          "error",
        );
      } finally {
        setIsBootstrapping(false);
      }
    };

    bootstrap();
  }, [onReady, refreshCurrentUser, showToast]);

  useEffect(() => {
    if (isBootstrapping || !appUserId) return;

    let isRefreshing = false;
    const refreshIfDateChanged = async () => {
      if (document.visibilityState === "hidden") return;

      const currentDate = getMoscowDate();
      if (currentDate === profileSnapshotDate || isRefreshing) return;

      isRefreshing = true;
      try {
        await refreshCurrentUser();
      } catch (error) {
        showToast(
          error instanceof Error
            ? error.message
            : "Не удалось обновить дневной прогресс.",
          "error",
        );
      } finally {
        isRefreshing = false;
      }
    };
    const refreshHandler = () => {
      void refreshIfDateChanged();
    };

    window.addEventListener("focus", refreshHandler);
    document.addEventListener("visibilitychange", refreshHandler);
    const interval = window.setInterval(refreshHandler, 60_000);

    return () => {
      window.removeEventListener("focus", refreshHandler);
      document.removeEventListener("visibilitychange", refreshHandler);
      window.clearInterval(interval);
    };
  }, [
    appUserId,
    isBootstrapping,
    profileSnapshotDate,
    refreshCurrentUser,
    showToast,
  ]);

  return {
    appUser,
    setAppUser,
    isBootstrapping,
    refreshCurrentUser,
  };
};
