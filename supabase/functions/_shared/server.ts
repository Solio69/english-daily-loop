/// <reference path="../deno-globals.d.ts" />

export type TelegramUser = {
  id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
  language_code?: string;
};

export const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-request-id",
};

export const DEFAULT_INTERNAL_ERROR_MESSAGE =
  "Внутренняя ошибка сервера. Попробуй еще раз позже.";

export const HTTP_STATUS = {
  OK: 200,
  CONFLICT: 409,
  INTERNAL_SERVER_ERROR: 500,
  BAD_GATEWAY: 502,
  GATEWAY_TIMEOUT: 504,
} as const;

const MAX_AUTH_AGE_SECONDS = 24 * 60 * 60;
const textEncoder = new TextEncoder();

export class AppError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const REQUEST_ID_HEADER = "x-request-id";
const REQUEST_ID_PATTERN = /^[a-zA-Z0-9_-]{8,80}$/;

export type SafeDiagnostics = Record<string, unknown>;
export type SafeErrorDetails = {
  errorCode: string;
  errorMessage: string;
};

const normalizeLogValue = (value: string, maxLength: number): string =>
  value.replace(/\s+/g, " ").trim().slice(0, maxLength);

const redactSensitiveLogValues = (
  value: string,
  sensitiveValues: Array<string | number>,
): string => {
  let sanitized = value
    .replace(/bearer\s+\S+/gi, "Bearer [redacted]")
    .replace(
      /(telegram_user_id|telegramUserId)\s*[=:]\s*\S+/gi,
      "$1=[redacted]",
    );

  for (const sensitiveValue of sensitiveValues) {
    const rawValue = String(sensitiveValue).trim();
    if (!rawValue) continue;
    sanitized = sanitized.split(rawValue).join("[redacted]");
  }

  return sanitized;
};

export const getSafeErrorDetails = (
  error: unknown,
  sensitiveValues: Array<string | number> = [],
): SafeErrorDetails => {
  const errorRecord =
    error && typeof error === "object"
      ? error as Record<string, unknown>
      : null;
  const rawCode = errorRecord?.code;
  const code =
    typeof rawCode === "string" || typeof rawCode === "number"
      ? String(rawCode)
      : "UNKNOWN_ERROR";
  const rawMessage =
    error instanceof Error
      ? error.message
      : typeof errorRecord?.message === "string"
        ? errorRecord.message
        : "Unknown server error.";

  return {
    errorCode: normalizeLogValue(
      redactSensitiveLogValues(code, sensitiveValues),
      80,
    ) || "UNKNOWN_ERROR",
    errorMessage: normalizeLogValue(
      redactSensitiveLogValues(rawMessage, sensitiveValues),
      300,
    ) || "Unknown server error.",
  };
};

export const createRequestId = (): string => `req_${crypto.randomUUID()}`;

export const isValidRequestId = (value: string): boolean =>
  REQUEST_ID_PATTERN.test(value);

export const getRequestId = (req: Request): string => {
  const rawRequestId = req.headers.get(REQUEST_ID_HEADER)?.trim();
  if (rawRequestId && isValidRequestId(rawRequestId)) {
    return rawRequestId;
  }

  return createRequestId();
};

export const fail = (status: number, code: string, message: string): never => {
  throw new AppError(status, code, message);
};

export const jsonResponse = (status: number, payload: unknown): Response =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });

export const successResponse = (
  status: number,
  data: unknown,
  requestId?: string,
): Response =>
  jsonResponse(status, requestId ? { ok: true, data, requestId } : { ok: true, data });

export const errorResponse = (
  status: number,
  code: string,
  message: string,
  requestId?: string,
  diagnostics?: SafeDiagnostics,
): Response =>
  jsonResponse(status, {
    ok: false,
    error: {
      code,
      message,
      ...(requestId ? { requestId } : {}),
      ...(diagnostics ? { diagnostics } : {}),
    },
  });

export const handleCorsPreflight = (req: Request): Response | null =>
  req.method === "OPTIONS"
    ? new Response("ok", { headers: CORS_HEADERS })
    : null;

export const assertPostRequest = (req: Request): void => {
  if (req.method !== "POST") {
    fail(405, "METHOD_NOT_ALLOWED", "Method Not Allowed");
  }
};

export const parseJsonBody = async <TBody>(req: Request): Promise<TBody> => {
  try {
    return (await req.json()) as TBody;
  } catch {
    return fail(400, "INVALID_JSON", "Request body must be valid JSON.");
  }
};

export const getRequiredEnv = <TKey extends string>(
  keys: TKey[],
): Record<TKey, string> => {
  const values = {} as Record<TKey, string>;

  for (const key of keys) {
    const value = Deno.env.get(key)?.trim();
    if (!value) {
      return fail(
        500,
        "SERVER_ENV_MISCONFIGURED",
        "Server env vars are not configured.",
      );
    }

    const requiredValue: string = value;
    values[key] = requiredValue;
  }

  return values;
};

export const getOptionalEnv = (key: string): string | null =>
  Deno.env.get(key)?.trim() || null;

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

const isTelegramUser = (value: unknown): value is TelegramUser =>
  Boolean(
    value &&
    typeof value === "object" &&
    "id" in value &&
    typeof (value as { id?: unknown }).id === "number" &&
    Number.isFinite((value as { id: number }).id),
  );

export const validateTelegramInitData = async (
  rawInitData: string,
  botToken: string,
): Promise<TelegramUser> => {
  const params = new URLSearchParams(rawInitData);
  const userRaw = params.get("user");
  const receivedHash = params.get("hash");
  const authDateRaw = params.get("auth_date");

  if (!userRaw) {
    return fail(
      401,
      "AUTH_VALIDATION_FAILED",
      "Telegram initData is incomplete.",
    );
  }
  if (!receivedHash) {
    return fail(
      401,
      "AUTH_VALIDATION_FAILED",
      "Telegram initData is incomplete.",
    );
  }
  if (!authDateRaw) {
    return fail(
      401,
      "AUTH_VALIDATION_FAILED",
      "Telegram initData is incomplete.",
    );
  }

  const userJson: string = userRaw;
  const hash: string = receivedHash;
  const authDateValue: string = authDateRaw;

  const authDate = Number(authDateValue);
  if (!Number.isFinite(authDate)) {
    return fail(
      401,
      "AUTH_VALIDATION_FAILED",
      "Telegram auth_date is invalid.",
    );
  }

  const now = Math.floor(Date.now() / 1000);
  if (now - authDate > MAX_AUTH_AGE_SECONDS) {
    return fail(
      401,
      "AUTH_VALIDATION_FAILED",
      "Telegram initData is too old. Reopen the Mini App.",
    );
  }

  let parsedUser: unknown;
  try {
    parsedUser = JSON.parse(userJson);
  } catch {
    return fail(
      401,
      "AUTH_VALIDATION_FAILED",
      "Telegram user payload is invalid.",
    );
  }

  if (!isTelegramUser(parsedUser)) {
    return fail(
      401,
      "AUTH_VALIDATION_FAILED",
      "Telegram user id is missing.",
    );
  }

  const user: TelegramUser = parsedUser;

  const dataCheckString = buildDataCheckString(params);
  const secretKey = await hmacSha256(
    textEncoder.encode("WebAppData"),
    botToken,
  );
  const expectedHash = toHex(await hmacSha256(secretKey, dataCheckString));

  if (!timingSafeEqual(expectedHash, hash.toLowerCase())) {
    return fail(
      401,
      "AUTH_VALIDATION_FAILED",
      "Telegram initData signature is not valid.",
    );
  }

  return user;
};

export const getTelegramUserFromBody = async (
  body: { initData?: unknown },
  botToken: string,
): Promise<TelegramUser> => {
  const initData =
    typeof body?.initData === "string" ? body.initData.trim() : "";

  if (!initData) {
    fail(400, "INIT_DATA_REQUIRED", "initData is required.");
  }

  return validateTelegramInitData(initData, botToken);
};
