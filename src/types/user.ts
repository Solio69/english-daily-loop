import { HomeProgress } from "./homeProgress";
import { SubscriptionSummary } from "./subscription";

export type UserSettings = {
  englishLevel: "A1" | "A2" | "B1" | "B2";
  dailyReadingMinutes: number;
};

export type AppUser = {
  id: string;
  telegramUserId: number;
  firstName: string | null;
  streakDays: number;
  settingsCompletedAt: string | null;
  firstTextCompletedAt: string | null;
  settings: UserSettings | null;
  subscription: SubscriptionSummary;
  homeProgress: HomeProgress;
};

export type SaveUserSettingsInput = UserSettings;
