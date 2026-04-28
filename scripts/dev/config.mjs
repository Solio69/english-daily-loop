import process from "node:process";

export const isWindows = process.platform === "win32";

export const commands = {
  npx: "npx",
  pnpm: "pnpm",
  docker: "docker",
};

export const localProjectId = "english-daily-loop";
export const envFilePath = ".env.local";
export const localSupabaseApiUrl = "http://127.0.0.1:55421";
export const frontendLocalUrl = "http://localhost:3000";
export const localFrontendTunnelTarget = "http://localhost:3000";
export const localApiTunnelTarget = "http://localhost:55421";
export const cloudflaredExecutable = isWindows
  ? ".\\tools\\cloudflared.exe"
  : "./tools/cloudflared";

export const devScenarios = {
  fresh: {
    telegramUserId: 999000001,
    description: "new user without saved settings",
  },
  onboarded: {
    telegramUserId: 999000002,
    description: "settings saved, first text is not completed",
  },
  "active-text": {
    telegramUserId: 999000003,
    description: "active reading text exists",
  },
  "completed-today": {
    telegramUserId: 999000004,
    description: "daily reading is already completed",
  },
  paid: {
    telegramUserId: 999000005,
    description: "active paid subscription",
  },
  history: {
    telegramUserId: 999000006,
    description: "completed reading history is populated",
  },
};

export const edgeFunctionNames = [
  "auth-telegram",
  "save-user-settings",
  "activate-subscription",
  "complete-reading-text",
  "get-reading-state",
  "get-reading-history",
  "generate-reading-text",
];

export function parseDevArgs(args = process.argv.slice(2)) {
  const modeArg = args.find((arg) => arg.startsWith("--mode="));
  const mode = modeArg?.split("=")[1] ?? "telegram";
  const scenarioName = args.find((arg) => !arg.startsWith("--")) ?? "fresh";
  const activeScenario = devScenarios[scenarioName];

  return {
    mode,
    scenarioName,
    activeScenario,
  };
}
