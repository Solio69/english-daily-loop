// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";

type EnglishLevel = "A1" | "A2" | "B1" | "B2";
type ReadingMinutes = 3 | 5 | 10 | 15;
type TelegramUser = {
  id: number;
};
type UserRow = {
  id: string;
  telegram_user_id: number;
};
type UserSettingsRow = {
  english_level: EnglishLevel;
  daily_reading_minutes: number;
};

type UserReadingSettings = {
  appUser: UserRow;
  appUserId: string;
  englishLevel: EnglishLevel;
  dailyReadingMinutes: ReadingMinutes;
};

type ReadingGenerationConfig = {
  wordMin: number;
  wordMax: number;
  validationWordMin: number;
  validationWordMax: number;
  maxTokens: number;
};

type OpenRouterChoice = {
  message?: {
    content?: string | Array<{ type?: string; text?: string }>;
  };
};

type OpenRouterResponse = {
  model?: string;
  choices?: OpenRouterChoice[];
  error?: {
    message?: string;
  };
};

type ClaimGenerationAttemptResult =
  | {
      ok: true;
      attemptId: string;
      usedAttempts: number;
      remainingAttempts: number;
    }
  | {
      ok: false;
      code: string;
      message: string;
      usedAttempts: number;
      remainingAttempts: number;
    };

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_PRIMARY_MODEL = "openai/gpt-oss-20b:free";
const DEFAULT_FALLBACK_MODEL = "google/gemma-3-12b-it:free";
const DEFAULT_TERTIARY_MODEL = "qwen/qwen3.6-plus:free";
const MODEL_TIMEOUT_MS = 45_000;
const AI_ERROR_MESSAGE =
  "Не удалось сгенерировать текст. Попробуй еще раз позже.";
const MAX_AUTH_AGE_SECONDS = 24 * 60 * 60;
const FREE_DAILY_GENERATION_LIMIT = 3;
const PAID_DAILY_GENERATION_LIMIT = 10;
const MOSCOW_TIME_ZONE = "Europe/Moscow";
const textEncoder = new TextEncoder();
const READING_CONFIG_BY_MINUTES: Record<
  ReadingMinutes,
  Omit<ReadingGenerationConfig, "validationWordMin" | "validationWordMax">
> = {
  3: { wordMin: 120, wordMax: 180, maxTokens: 450 },
  5: { wordMin: 220, wordMax: 320, maxTokens: 750 },
  10: { wordMin: 450, wordMax: 650, maxTokens: 1300 },
  15: { wordMin: 700, wordMax: 950, maxTokens: 1900 },
};

class AppError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const fail = (status: number, code: string, message: string): never => {
  throw new AppError(status, code, message);
};

const jsonResponse = (status: number, payload: unknown): Response =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });

const successResponse = (status: number, data: unknown): Response =>
  jsonResponse(status, { ok: true, data });

const errorResponse = (
  status: number,
  code: string,
  message: string,
): Response => jsonResponse(status, { ok: false, error: { code, message } });

const parseEnglishLevel = (value: unknown): EnglishLevel => {
  if (value === "A1" || value === "A2" || value === "B1" || value === "B2") {
    return value;
  }
  fail(
    500,
    "INVALID_ENGLISH_LEVEL",
    "User english level has an unsupported value.",
  );
};

const parseReadingMinutes = (value: unknown): ReadingMinutes => {
  if (value === 3 || value === 5 || value === 10 || value === 15) {
    return value;
  }
  fail(
    500,
    "INVALID_READING_MINUTES",
    "User reading minutes has an unsupported value.",
  );
};

const getReadingGenerationConfig = (
  readingMinutes: ReadingMinutes,
): ReadingGenerationConfig => {
  const config = READING_CONFIG_BY_MINUTES[readingMinutes];
  return {
    ...config,
    validationWordMin: Math.floor(config.wordMin * 0.8),
    validationWordMax: Math.ceil(config.wordMax * 1.2),
  };
};

const normalizeModelList = (...values: string[]): string[] =>
  Array.from(new Set(values.map((item) => item.trim()).filter(Boolean)));

const excludeModel = (models: string[], modelToExclude: string): string[] => {
  const filtered = models.filter((model) => model !== modelToExclude);
  return filtered.length === models.length ? models.slice(1) : filtered;
};

const getMoscowDate = (): string => {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: MOSCOW_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );

  return `${values.year}-${values.month}-${values.day}`;
};

const getDailyGenerationLimit = async (
  supabase: ReturnType<typeof createClient>,
  user: UserRow,
): Promise<number> => {
  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from("user_subscriptions")
    .select("id")
    .eq("user_id", user.id)
    .lte("starts_at", nowIso)
    .gt("ends_at", nowIso)
    .limit(1);

  if (error) {
    console.error("[generate-reading-text] failed to load subscription", {
      appUserId: user.id,
      error: error.message,
    });
    fail(500, "SUBSCRIPTION_LOAD_FAILED", "Failed to load subscription.");
  }

  return (data ?? []).length > 0
    ? PAID_DAILY_GENERATION_LIMIT
    : FREE_DAILY_GENERATION_LIMIT;
};

const claimGenerationAttempt = async (
  supabase: ReturnType<typeof createClient>,
  userId: string,
  attemptDate: string,
  dailyLimit: number,
): Promise<Extract<ClaimGenerationAttemptResult, { ok: true }>> => {
  const { data, error } = await supabase.rpc(
    "claim_reading_generation_attempt",
    {
      p_user_id: userId,
      p_attempt_date: attemptDate,
      p_daily_limit: dailyLimit,
      p_provider: "openrouter",
    },
  );

  if (error) {
    console.error("[generate-reading-text] failed to claim attempt", {
      appUserId: userId,
      attemptDate,
      error: error.message,
    });
    fail(500, "ATTEMPT_CLAIM_FAILED", "Failed to save generation attempt.");
  }

  const result = data as ClaimGenerationAttemptResult | null;
  if (!result) {
    fail(500, "ATTEMPT_CLAIM_FAILED", "Empty attempt claim result.");
  }

  if (!result.ok) {
    fail(
      result.code === "GENERATION_ATTEMPTS_EXHAUSTED" ? 429 : 500,
      result.code,
      result.message,
    );
  }

  return result;
};

const stripCodeFence = (raw: string): string => {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("```")) {
    return trimmed;
  }

  return trimmed
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();
};

const toBufferSource = (value: Uint8Array): BufferSource => {
  const view = new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  return view as BufferSource;
};

const toHex = (bytes: Uint8Array): string =>
  Array.from(bytes)
    .map((item) => item.toString(16).padStart(2, "0"))
    .join("");

const timingSafeEqual = (a: string, b: string): boolean => {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
};

const hmacSha256 = async (
  key: Uint8Array,
  data: string,
): Promise<Uint8Array> => {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    toBufferSource(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    cryptoKey,
    toBufferSource(textEncoder.encode(data)),
  );
  return new Uint8Array(signature);
};

const buildDataCheckString = (params: URLSearchParams): string => {
  const pairs: string[] = [];
  for (const [key, value] of params.entries()) {
    if (key === "hash") continue;
    pairs.push(`${key}=${value}`);
  }
  pairs.sort((a, b) => a.localeCompare(b));
  return pairs.join("\n");
};

const parseInitData = (
  rawInitData: string,
): { params: URLSearchParams; user: TelegramUser } => {
  const params = new URLSearchParams(rawInitData);
  const userRaw = params.get("user");
  if (!userRaw) {
    fail(401, "AUTH_VALIDATION_FAILED", "Field user is missing in initData.");
  }

  let user: TelegramUser;
  try {
    user = JSON.parse(userRaw) as TelegramUser;
  } catch {
    fail(
      401,
      "AUTH_VALIDATION_FAILED",
      "Field user in initData has invalid JSON.",
    );
  }

  if (!user.id) {
    fail(
      401,
      "AUTH_VALIDATION_FAILED",
      "telegram user id is missing in initData.",
    );
  }

  return { params, user };
};

const validateTelegramInitData = async (
  rawInitData: string,
  botToken: string,
): Promise<TelegramUser> => {
  const { params, user } = parseInitData(rawInitData);
  const receivedHash = params.get("hash");
  if (!receivedHash) {
    fail(401, "AUTH_VALIDATION_FAILED", "hash is missing in initData.");
  }

  const authDateRaw = params.get("auth_date");
  if (!authDateRaw) {
    fail(401, "AUTH_VALIDATION_FAILED", "auth_date is missing in initData.");
  }

  const authDate = Number(authDateRaw);
  if (!Number.isFinite(authDate)) {
    fail(401, "AUTH_VALIDATION_FAILED", "auth_date in initData is invalid.");
  }

  const now = Math.floor(Date.now() / 1000);
  if (now - authDate > MAX_AUTH_AGE_SECONDS) {
    fail(
      401,
      "AUTH_VALIDATION_FAILED",
      "Telegram initData is too old. Reopen the Mini App.",
    );
  }

  const dataCheckString = buildDataCheckString(params);
  const secretKey = await hmacSha256(
    textEncoder.encode("WebAppData"),
    botToken,
  );
  const expectedHash = toHex(await hmacSha256(secretKey, dataCheckString));

  if (!timingSafeEqual(expectedHash, receivedHash.toLowerCase())) {
    fail(
      401,
      "AUTH_VALIDATION_FAILED",
      "Telegram initData signature is not valid.",
    );
  }

  return user;
};

const getUserReadingSettingsFromDb = async (
  supabase: ReturnType<typeof createClient>,
  telegramUserId: number,
): Promise<UserReadingSettings> => {
  const { data: userRow, error: userError } = await supabase
    .from("users")
    .select("id, telegram_user_id")
    .eq("telegram_user_id", telegramUserId)
    .maybeSingle();

  if (userError) {
    console.error("[generate-reading-text] failed to load user", {
      telegramUserId,
      error: userError.message,
    });
    fail(500, "USER_FIND_FAILED", "Failed to load user profile.");
  }

  if (!userRow) {
    fail(
      404,
      "USER_NOT_FOUND",
      "User profile was not found. Complete Telegram auth first.",
    );
  }

  const appUser = userRow as UserRow;
  const { data: settingsRow, error: settingsError } = await supabase
    .from("user_settings")
    .select("english_level, daily_reading_minutes")
    .eq("user_id", appUser.id)
    .maybeSingle();

  if (settingsError) {
    console.error("[generate-reading-text] failed to load user settings", {
      appUserId: appUser.id,
      error: settingsError.message,
    });
    fail(500, "SETTINGS_LOAD_FAILED", "Failed to load user settings.");
  }

  if (!settingsRow) {
    fail(409, "SETTINGS_NOT_COMPLETED", "User settings are not completed yet.");
  }

  const settings = settingsRow as UserSettingsRow;
  return {
    appUser,
    appUserId: appUser.id,
    englishLevel: parseEnglishLevel(settings.english_level),
    dailyReadingMinutes: parseReadingMinutes(settings.daily_reading_minutes),
  };
};

const extractOpenRouterContent = (
  payload: OpenRouterResponse,
): string | null => {
  const choice = payload.choices?.[0];
  const content = choice?.message?.content;
  if (!content) return null;

  if (typeof content === "string") {
    return content;
  }

  const joined = content
    .filter((part) => part?.type === "text" && typeof part.text === "string")
    .map((part) => part.text)
    .join("\n")
    .trim();

  return joined || null;
};

const buildPrompt = (
  targetLevel: EnglishLevel,
  readingMinutes: ReadingMinutes,
  config: ReadingGenerationConfig,
): string => `You are an English teacher.
Create one reading text for level ${targetLevel} and a ${readingMinutes}-minute reading session.

Rules:
- output only valid JSON
- no markdown, no code fences
- title must be 3-8 words
- body must be ${config.wordMin}-${config.wordMax} words, simple and natural for level ${targetLevel}
- estimatedMinutes must be exactly ${readingMinutes}
- level must be exactly "${targetLevel}"

JSON schema:
{
  "title": "string",
  "body": "string",
  "estimatedMinutes": ${readingMinutes},
  "level": "${targetLevel}"
}`;

const parseGeneratedJson = (
  raw: string,
  targetLevel: EnglishLevel,
  readingMinutes: ReadingMinutes,
  config: ReadingGenerationConfig,
): { title: string; body: string; estimatedMinutes: number; level: string } => {
  const parsed = JSON.parse(stripCodeFence(raw)) as {
    title?: unknown;
    body?: unknown;
    estimatedMinutes?: unknown;
    level?: unknown;
  };

  if (typeof parsed.title !== "string" || !parsed.title.trim()) {
    throw new Error("Generated JSON has invalid title.");
  }
  if (typeof parsed.body !== "string") {
    throw new Error("Generated JSON has invalid body.");
  }

  const wordCount = parsed.body.trim().split(/\s+/).filter(Boolean).length;
  if (
    wordCount < config.validationWordMin ||
    wordCount > config.validationWordMax
  ) {
    throw new Error(
      `Generated body has ${wordCount} words, expected ${config.validationWordMin}-${config.validationWordMax}.`,
    );
  }

  return {
    title: parsed.title.trim(),
    body: parsed.body.trim(),
    estimatedMinutes: readingMinutes,
    level: targetLevel,
  };
};

const requestOpenRouter = async (
  models: string[],
  prompt: string,
  apiKey: string,
  maxTokens: number,
): Promise<{ content: string; usedModel: string }> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), MODEL_TIMEOUT_MS);

  try {
    let response: Response;
    try {
      response = await fetch(OPENROUTER_URL, {
        method: "POST",
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          models,
          temperature: 0.7,
          max_tokens: maxTokens,
          messages: [{ role: "user", content: prompt }],
        }),
      });
    } catch (error) {
      if (
        error instanceof Error &&
        (error.name === "AbortError" ||
          error.message.includes("signal has been aborted"))
      ) {
        throw new Error(
          "AI-модели не ответили вовремя. Попробуй еще раз чуть позже.",
        );
      }

      throw error;
    }

    const payload = (await response.json()) as OpenRouterResponse;
    if (!response.ok) {
      const details =
        payload.error?.message ??
        `OpenRouter request failed with status ${response.status}.`;
      throw new Error(details);
    }

    const content = extractOpenRouterContent(payload);
    if (!content) {
      throw new Error("OpenRouter returned empty content.");
    }

    return {
      content,
      usedModel: payload.model?.trim() || models[0],
    };
  } finally {
    clearTimeout(timeoutId);
  }
};

const generateWithFallback = async (
  models: string[],
  prompt: string,
  apiKey: string,
  targetLevel: EnglishLevel,
  readingMinutes: ReadingMinutes,
  config: ReadingGenerationConfig,
) => {
  let remainingModels = [...models];
  let lastErrorMessage = "Unknown generation error.";

  while (remainingModels.length > 0) {
    let routed: { content: string; usedModel: string };

    try {
      routed = await requestOpenRouter(
        remainingModels,
        prompt,
        apiKey,
        config.maxTokens,
      );
    } catch (error) {
      lastErrorMessage =
        error instanceof Error ? error.message : "Unknown generation error.";
      console.error("[generate-reading-text] model routing failed", {
        models: remainingModels,
        error: lastErrorMessage,
      });
      throw new Error(lastErrorMessage);
    }

    try {
      const generated = parseGeneratedJson(
        routed.content,
        targetLevel,
        readingMinutes,
        config,
      );
      return {
        ...generated,
        usedModel: routed.usedModel,
      };
    } catch (error) {
      lastErrorMessage =
        error instanceof Error ? error.message : "Unknown generation error.";
      console.error("[generate-reading-text] generated content validation failed", {
        usedModel: routed.usedModel,
        candidateModels: remainingModels,
        error: lastErrorMessage,
      });
      remainingModels = excludeModel(remainingModels, routed.usedModel);
    }
  }

  throw new Error(lastErrorMessage);
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return errorResponse(405, "METHOD_NOT_ALLOWED", "Method Not Allowed");
  }

  let startedAttempt:
    | { supabase: ReturnType<typeof createClient>; attemptId: string }
    | null = null;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim();
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim();
    const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN")?.trim();
    const openRouterApiKey = Deno.env.get("OPENROUTER_API_KEY")?.trim();
    const primaryModel =
      Deno.env.get("OPENROUTER_MODEL_PRIMARY")?.trim() || DEFAULT_PRIMARY_MODEL;
    const fallbackModel =
      Deno.env.get("OPENROUTER_MODEL_FALLBACK")?.trim() ||
      DEFAULT_FALLBACK_MODEL;
    const tertiaryModel =
      Deno.env.get("OPENROUTER_MODEL_TERTIARY")?.trim() ||
      DEFAULT_TERTIARY_MODEL;

    if (!supabaseUrl || !serviceRoleKey || !botToken || !openRouterApiKey) {
      return errorResponse(
        500,
        "SERVER_ENV_MISCONFIGURED",
        "Server env vars are not configured.",
      );
    }

    let body: { initData?: unknown };
    try {
      body = (await req.json()) as { initData?: unknown };
    } catch {
      fail(400, "INVALID_JSON", "Request body must be valid JSON.");
    }

    const initData =
      typeof body?.initData === "string" ? body.initData.trim() : "";
    if (!initData) {
      fail(400, "INIT_DATA_REQUIRED", "initData is required.");
    }

    const tgUser = await validateTelegramInitData(initData, botToken);
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });
    const settings = await getUserReadingSettingsFromDb(supabase, tgUser.id);
    const today = getMoscowDate();
    const dailyLimit = await getDailyGenerationLimit(
      supabase,
      settings.appUser,
    );

    const { data: completionRow, error: completionError } = await supabase
      .from("user_daily_reading_completions")
      .select("id")
      .eq("user_id", settings.appUserId)
      .eq("completed_date", today)
      .maybeSingle();

    if (completionError) {
      console.error("[generate-reading-text] failed to load completion", {
        appUserId: settings.appUserId,
        error: completionError.message,
      });
      fail(500, "COMPLETION_LOAD_FAILED", "Failed to load reading completion.");
    }

    if (completionRow) {
      fail(
        409,
        "DAILY_READING_ALREADY_COMPLETED",
        "Текст на сегодня уже прочитан.",
      );
    }

    const claimedAttempt = await claimGenerationAttempt(
      supabase,
      settings.appUserId,
      today,
      dailyLimit,
    );

    startedAttempt = {
      supabase,
      attemptId: claimedAttempt.attemptId,
    };

    const targetLevel = settings.englishLevel;
    const config = getReadingGenerationConfig(settings.dailyReadingMinutes);
    const prompt = buildPrompt(
      targetLevel,
      settings.dailyReadingMinutes,
      config,
    );
    const models = normalizeModelList(
      primaryModel,
      fallbackModel,
      tertiaryModel,
    );

    console.log("[generate-reading-text] start", {
      telegramUserId: tgUser.id,
      appUserId: settings.appUserId,
      attemptId: startedAttempt.attemptId,
      attemptDate: today,
      usedAttempts: claimedAttempt.usedAttempts,
      remainingAttempts: claimedAttempt.remainingAttempts,
      dailyLimit,
      baseLevel: settings.englishLevel,
      dailyReadingMinutes: settings.dailyReadingMinutes,
      targetLevel,
      targetWords: `${config.wordMin}-${config.wordMax}`,
      validationWords: `${config.validationWordMin}-${config.validationWordMax}`,
      maxTokens: config.maxTokens,
      models,
    });

    const generated = await generateWithFallback(
      models,
      prompt,
      openRouterApiKey,
      targetLevel,
      settings.dailyReadingMinutes,
      config,
    );

    const fallbackUsed = generated.usedModel !== models[0];
    const { error: activeTextError } = await supabase
      .from("user_active_reading_texts")
      .upsert(
        {
          user_id: settings.appUserId,
          title: generated.title,
          body: generated.body,
          level: generated.level,
          estimated_minutes: generated.estimatedMinutes,
          provider: "openrouter",
          model: generated.usedModel,
          fallback_used: fallbackUsed,
          generated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );

    if (activeTextError) {
      console.error("[generate-reading-text] failed to save active text", {
        appUserId: settings.appUserId,
        attemptId: startedAttempt.attemptId,
        error: activeTextError.message,
      });
      fail(500, "ACTIVE_TEXT_SAVE_FAILED", "Failed to save generated text.");
    }

    const { error: attemptUpdateError } = await supabase
      .from("reading_generation_attempts")
      .update({
        status: "succeeded",
        provider: "openrouter",
        model: generated.usedModel,
        error_code: null,
        error_message: null,
      })
      .eq("id", startedAttempt.attemptId);

    if (attemptUpdateError) {
      console.error("[generate-reading-text] failed to update attempt", {
        appUserId: settings.appUserId,
        attemptId: startedAttempt.attemptId,
        error: attemptUpdateError.message,
      });
    }

    return successResponse(200, {
      text: {
        id: `active-${settings.appUserId}`,
        title: generated.title,
        body: generated.body,
        level: generated.level,
        estimatedMinutes: generated.estimatedMinutes,
      },
      generation: {
        provider: "openrouter",
        model: generated.usedModel,
        fallbackUsed,
      },
      dailyLimit,
      usedAttempts: claimedAttempt.usedAttempts,
      remainingAttempts: claimedAttempt.remainingAttempts,
    });
  } catch (error) {
    if (startedAttempt) {
      const code =
        error instanceof AppError ? error.code : "TEXT_GENERATION_FAILED";
      const message =
        error instanceof Error ? error.message : "Unknown generation error.";
      const { error: updateError } = await startedAttempt.supabase
        .from("reading_generation_attempts")
        .update({
          status: "failed",
          error_code: code,
          error_message: message,
        })
        .eq("id", startedAttempt.attemptId);

      if (updateError) {
        console.error("[generate-reading-text] failed to mark attempt failed", {
          attemptId: startedAttempt.attemptId,
          error: updateError.message,
        });
      }
    }

    if (error instanceof AppError) {
      console.error("[generate-reading-text] request failed", {
        status: error.status,
        code: error.code,
        message: error.message,
      });
      return errorResponse(error.status, error.code, error.message);
    }

    const message =
      error instanceof Error ? error.message : "Unknown generation error.";
    console.error("[generate-reading-text] failed", { message });
    return errorResponse(502, "TEXT_GENERATION_FAILED", AI_ERROR_MESSAGE);
  }
});
