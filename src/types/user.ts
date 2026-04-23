import { SubscriptionSummary } from "./subscription";

export type UserSettings = {
  englishLevel: "A1" | "A2" | "B1" | "B2";
  dailyExerciseMinutes: number;
  dailyReadingMinutes: number;
  dailyReviewWords: number;
};

export type AppUser = {
  id: string;
  telegramUserId: number;
  firstName: string | null;
  settingsCompletedAt: string | null;
  firstTextCompletedAt: string | null;
  settings: UserSettings | null;
  subscription: SubscriptionSummary;
};

export type SaveUserSettingsInput = UserSettings;
