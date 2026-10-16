import { supabase } from "../lib/supabase";
import { clientLogger } from "./clientLogger";
import {
  buildEdgeFunctionError,
  getFunctionErrorPayload,
  getSuccessDiagnostics,
  type FunctionResponse,
} from "./edgeFunctionErrors";

const REQUEST_ID_PREFIX = "req_";

export const createRequestId = (): string => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${REQUEST_ID_PREFIX}${crypto.randomUUID()}`;
  }

  return `${REQUEST_ID_PREFIX}${Date.now()}_${Math.random().toString(36).slice(2)}`;
};

export const getTelegramInitData = (): string => {
  const initData = window.Telegram?.WebApp?.initData?.trim();
  if (!initData) {
    throw new Error("Telegram initData не найден.");
  }

  return initData;
};

export const invokeFunction = async <TData>(
  functionName: string,
  body: Record<string, unknown>,
  fallbackMessage: string,
): Promise<TData> => {
  const initData = getTelegramInitData();
  return invokeFunctionWithInitData(
    functionName,
    initData,
    body,
    fallbackMessage,
  );
};

export const invokeFunctionWithInitData = async <TData>(
  functionName: string,
  initData: string,
  body: Record<string, unknown>,
  fallbackMessage: string,
  existingRequestId?: string,
): Promise<TData> => {
  const requestId = existingRequestId ?? createRequestId();
  clientLogger.info("edge_request_started", { functionName, requestId });
  const { data, error } = await supabase.functions.invoke(functionName, {
    body: { initData, ...body },
    headers: { "x-request-id": requestId },
  });

  if (error) {
    const payload = await getFunctionErrorPayload(error);
    const edgeError = buildEdgeFunctionError({
      message: payload?.error.message,
      fallbackMessage,
      code: payload?.error.code,
      requestId: payload?.error.requestId || requestId,
      diagnostics: payload?.error.diagnostics,
    });
    clientLogger.error("edge_request_failed", {
      functionName,
      requestId: edgeError.requestId,
      code: edgeError.code,
      diagnostics: edgeError.diagnostics,
    });
    throw edgeError;
  }

  const payload = data as FunctionResponse<TData> | null;
  if (!payload) {
    const edgeError = buildEdgeFunctionError({
      fallbackMessage: "Пустой ответ от сервера.",
      requestId,
    });
    clientLogger.error("edge_request_failed", {
      functionName,
      requestId,
      code: "EMPTY_RESPONSE",
    });
    throw edgeError;
  }

  if ("error" in payload) {
    const edgeError = buildEdgeFunctionError({
      message: payload.error.message,
      fallbackMessage,
      code: payload.error.code,
      requestId: payload.error.requestId || requestId,
      diagnostics: payload.error.diagnostics,
    });
    clientLogger.error("edge_request_failed", {
      functionName,
      requestId: edgeError.requestId,
      code: edgeError.code,
      diagnostics: edgeError.diagnostics,
    });
    throw edgeError;
  }

  const successDiagnostics = getSuccessDiagnostics(payload);
  clientLogger.info("edge_request_succeeded", {
    functionName,
    requestId: payload.requestId || requestId,
  });
  if (successDiagnostics) {
    clientLogger.warning("edge_request_diagnostics", {
      functionName,
      requestId: payload.requestId || requestId,
      diagnostics: successDiagnostics,
    });
  }
  return payload.data;
};
