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
  metadata?: AiDiagnosticsMetadata | null;
  details?: {
    targetLevel?: string | null;
    readingMinutes?: number | null;
    targetWordMin?: number | null;
    targetWordMax?: number | null;
    validationWordMin?: number | null;
    validationWordMax?: number | null;
    outputWordCount?: number | null;
    englishLevel?: string | null;
    requestedCount?: number | null;
    preparedCount?: number | null;
    failedCount?: number | null;
  };
};

export const sanitizeDiagnosticMessage = (message: string): string =>
  message
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 300);

const boundedCount = (value: number | null | undefined): number | null =>
  typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 100_000
    ? value
    : null;

const boundedDuration = (value: number): number =>
  Number.isFinite(value) ? Math.min(Math.max(Math.round(value), 0), 120_000) : 0;

export const buildSafeAiDiagnostics = ({
  functionName,
  requestId,
  promptVersion,
  modelChain,
  stage,
  durationMs,
  metadata = null,
  details = {},
}: BuildSafeAiDiagnosticsParams): SafeDiagnostics => ({
  functionName,
  requestId,
  promptVersion,
  modelChain,
  model: metadata?.model && modelChain?.includes(metadata.model) ? metadata.model : null,
  stage,
  durationMs: boundedDuration(durationMs),
  completionTokens: boundedCount(metadata?.completionTokens),
  reasoningTokens: boundedCount(metadata?.reasoningTokens),
  providerStatus:
    typeof metadata?.providerStatus === "number" &&
    Number.isInteger(metadata.providerStatus) &&
    metadata.providerStatus >= 100 &&
    metadata.providerStatus <= 599
      ? metadata.providerStatus
      : null,
  ...(functionName === "generate-reading-text"
    ? {
        targetLevel: details.targetLevel === "A1" || details.targetLevel === "A2" || details.targetLevel === "B1" || details.targetLevel === "B2" ? details.targetLevel : null,
        readingMinutes: boundedCount(details.readingMinutes),
        targetWordMin: boundedCount(details.targetWordMin),
        targetWordMax: boundedCount(details.targetWordMax),
        validationWordMin: boundedCount(details.validationWordMin),
        validationWordMax: boundedCount(details.validationWordMax),
        outputWordCount: boundedCount(details.outputWordCount),
      }
    : {
        englishLevel: details.englishLevel === "A1" || details.englishLevel === "A2" || details.englishLevel === "B1" || details.englishLevel === "B2" ? details.englishLevel : null,
        requestedCount: boundedCount(details.requestedCount),
        preparedCount: boundedCount(details.preparedCount),
        failedCount: boundedCount(details.failedCount),
      }),
});
