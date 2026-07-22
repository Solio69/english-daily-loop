import type { BottomNavItemId } from "../components/BottomNav";

const SETTINGS_REQUIRED_NAV_ITEMS: BottomNavItemId[] = [
  "reading",
  "vocabulary",
  "materials",
];

export const getDisabledNavItems = (
  isSettingsCompleted: boolean,
): BottomNavItemId[] =>
  isSettingsCompleted ? [] : [...SETTINGS_REQUIRED_NAV_ITEMS];
