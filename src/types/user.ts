import { HomeProgress } from "./homeProgress";
import { SubscriptionSummary } from "./subscription";

export type UserSettings = {
  englishLevel: "A1" | "A2" | "B1" | "B2";
  dailyReadingMinutes: number;
};

export type AppRole = "admin" | "tester" | "user";

export type AppUser = {
  id: string;
  telegramUserId: number;
  role: AppRole;
  firstName: string | null;
  streakDays: number;
  completedReadingTextCount: number | null;
  settingsCompletedAt: string | null;
  firstTextCompletedAt: string | null;
  settings: UserSettings | null;
  subscription: SubscriptionSummary;
  homeProgress: HomeProgress;
};

export type SaveUserSettingsInput = UserSettings;
