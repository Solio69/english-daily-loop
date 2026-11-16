/// <reference path="../deno-globals.d.ts" />

const DISALLOWED_TEXT_PATTERNS = [
  /<\s*script\b/i,
  /<\s*iframe\b/i,
  /\bjavascript\s*:/i,
  /\bon(?:error|load|click)\s*=/i,
  /```/,
  /\bsystem prompt\b/i,
  /\bdeveloper message\b/i,
  /\bignore (?:all )?(?:previous|prior) instructions\b/i,
];

export const normalizePlainText = (value: string): string =>
  value.replace(/\s+/g, " ").trim();

export const countWords = (value: string): number =>
  normalizePlainText(value).split(/\s+/).filter(Boolean).length;

export const assertSafeText = (field: string, value: string): void => {
  const blockedPattern = DISALLOWED_TEXT_PATTERNS.find((pattern) =>
    pattern.test(value),
  );

  if (blockedPattern) {
    throw new Error(`${field} contains disallowed content.`);
  }
};

export const assertAsciiEnglishText = (field: string, value: string): void => {
  // deno-lint-ignore no-control-regex -- Tabs and line breaks are intentionally allowed.
  if (!/^[\x09\x0A\x0D\x20-\x7E]+$/.test(value)) {
    throw new Error(`${field} must contain only English text.`);
  }
};

export const stripCodeFence = (raw: string): string => {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("```")) {
    return trimmed;
  }

  return trimmed
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();
};
