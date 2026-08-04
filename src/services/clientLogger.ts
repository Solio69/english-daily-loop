export type ClientLogLevel = "info" | "warning" | "error";

export type ClientLogEvent = {
  id: string;
  createdAt: string;
  level: ClientLogLevel;
  event: string;
  details?: Record<string, unknown>;
};

const STORAGE_KEY = "edl.diagnostics.events";
const MAX_EVENTS = 100;
const MAX_STRING_LENGTH = 500;
const MAX_ARRAY_LENGTH = 20;
const MAX_DEPTH = 4;
const SENSITIVE_KEY_PATTERN =
  /(authorization|bearer|body|content|hash|initdata|key|password|prompt|raw|secret|stack|text|token)/i;
const SAFE_DIAGNOSTIC_KEYS = new Set(["promptversion"]);

const isSensitiveDiagnosticKey = (key: string): boolean =>
  !SAFE_DIAGNOSTIC_KEYS.has(key.toLowerCase()) &&
  SENSITIVE_KEY_PATTERN.test(key);

const canUseSessionStorage = (): boolean => {
  try {
    return typeof window !== "undefined" && Boolean(window.sessionStorage);
  } catch {
    return false;
  }
};

const createEventId = (): string => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `evt_${crypto.randomUUID()}`;
  }

  return `evt_${Date.now()}_${Math.random().toString(36).slice(2)}`;
};

const sanitizeValue = (value: unknown, depth = 0): unknown => {
  if (depth > MAX_DEPTH) return "[truncated]";
  if (value === null || value === undefined) return value;
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "string") {
    return value.length > MAX_STRING_LENGTH
      ? `${value.slice(0, MAX_STRING_LENGTH)}...`
      : value;
  }
  if (Array.isArray(value)) {
    return value
      .slice(0, MAX_ARRAY_LENGTH)
      .map((item) => sanitizeValue(item, depth + 1));
  }
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        isSensitiveDiagnosticKey(key)
          ? "[redacted]"
          : sanitizeValue(item, depth + 1),
      ]),
    );
  }

  return String(value);
};

export const sanitizeClientLogDetails = (
  details?: Record<string, unknown>,
): Record<string, unknown> | undefined => {
  if (!details) return undefined;
  return sanitizeValue(details) as Record<string, unknown>;
};

const readEvents = (): ClientLogEvent[] => {
  if (!canUseSessionStorage()) return [];

  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ClientLogEvent[]) : [];
  } catch {
    return [];
  }
};

const writeEvents = (events: ClientLogEvent[]): void => {
  if (!canUseSessionStorage()) return;

  try {
    window.sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(events.slice(-MAX_EVENTS)),
    );
  } catch {
    // Diagnostics must never break the product flow.
  }
};

const addEvent = (
  level: ClientLogLevel,
  event: string,
  details?: Record<string, unknown>,
): void => {
  const nextEvent: ClientLogEvent = {
    id: createEventId(),
    createdAt: new Date().toISOString(),
    level,
    event,
    details: sanitizeClientLogDetails(details),
  };

  writeEvents([...readEvents(), nextEvent]);
};

export const clientLogger = {
  info: (event: string, details?: Record<string, unknown>) =>
    addEvent("info", event, details),
  warning: (event: string, details?: Record<string, unknown>) =>
    addEvent("warning", event, details),
  error: (event: string, details?: Record<string, unknown>) =>
    addEvent("error", event, details),
  getSnapshot: (): ClientLogEvent[] => readEvents(),
  clear: (): void => {
    if (!canUseSessionStorage()) return;
    window.sessionStorage.removeItem(STORAGE_KEY);
  },
};
