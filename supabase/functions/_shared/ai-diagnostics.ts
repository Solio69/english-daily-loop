/// <reference path="../deno-globals.d.ts" />

import type { SafeDiagnostics } from "./server.ts";

export type AiDiagnosticsMetadata = {
  model?: string | null;
  finishReason?: string | null;
  completionTokens?: number | null;
  reasoningTokens?: number | null;
  providerStatus?: number | null;
  providerErrorCode?: string | number | null;
};

type BuildSafeAiDiagnosticsParams = {
  functionName: string;
  requestId: string;
  promptVersion: string;
  modelChain: string[] | null;
  stage: string;
  durationMs: number;
  error: unknown;
  metadata?: AiDiagnosticsMetadata | null;
  details?: Record<string, unknown>;
};

export const sanitizeDiagnosticMessage = (message: string): string =>
  message
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 300);

const normalizeProviderErrorCode = (
  value: string | number | null | undefined,
): string | null => (value == null ? null : String(value));

export const buildSafeAiDiagnostics = ({
  functionName,
  requestId,
  promptVersion,
  modelChain,
  stage,
  durationMs,
  error,
  metadata = null,
  details = {},
}: BuildSafeAiDiagnosticsParams): SafeDiagnostics => ({
  functionName,
  requestId,
  promptVersion,
  modelChain,
  model: metadata?.model ?? null,
  stage,
  ...details,
  durationMs,
  finishReason: metadata?.finishReason ?? null,
  completionTokens: metadata?.completionTokens ?? null,
  reasoningTokens: metadata?.reasoningTokens ?? null,
  providerStatus: metadata?.providerStatus ?? null,
  providerErrorCode: normalizeProviderErrorCode(metadata?.providerErrorCode),
  errorMessage:
    error instanceof Error
      ? sanitizeDiagnosticMessage(error.message)
      : "Unknown AI error.",
});
