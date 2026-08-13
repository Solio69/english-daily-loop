import process from "node:process";

export const isWindows = process.platform === "win32";

export const commands = {
  npx: "npx",
  pnpm: "pnpm",
  docker: "docker",
};

export const localProjectId = "english-daily-loop";
export const envFilePath = ".env.telegram.local";
export const envTemplatePath = ".env.telegram.example";
export const productionTelegramBotUsername = "@english_daily_loop_bot";
// TODO: Local Telegram tunnels must use IPv4 loopback; localhost can resolve to ::1 on Windows.
export const localFrontendTunnelTarget = "http://127.0.0.1:3000";
export const localApiTunnelTarget = "http://127.0.0.1:54321";
// TODO: Local tool path is machine-specific; keep downloaded cloudflared binary out of git.
export const cloudflaredExecutable = isWindows
  ? ".\\tools\\cloudflared.exe"
  : "./tools/cloudflared";

// TODO: Keep this list in sync with Supabase Edge Functions required by local Telegram flows.
export const edgeFunctionNames = [
  "approve-vocabulary-card",
  "approve-vocabulary-cards",
  "auth-telegram",
  "save-user-settings",
  "activate-subscription",
  "complete-reading-text",
  "delete-pending-vocabulary-word",
  "dev-tools",
  "get-reading-state",
  "get-reading-history",
  "get-vocabulary-review-state",
  "get-vocabulary-state",
  "get-vocabulary-words",
  "generate-reading-text",
  "prepare-vocabulary-cards",
  "review-vocabulary-word",
  "save-reading-position",
  "save-vocabulary-word",
  "submit-support-report",
  "telegram-bot-webhook",
];
