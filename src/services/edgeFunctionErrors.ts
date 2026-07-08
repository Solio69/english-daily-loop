export type FunctionError = {
  ok: false;
  error: {
    code: string;
    message: string;
    requestId?: string;
    diagnostics?: Record<string, unknown>;
  };
};

export type FunctionSuccess<TData> = {
  ok: true;
  data: TData;
  requestId?: string;
};

export type FunctionResponse<TData> = FunctionSuccess<TData> | FunctionError;

export class EdgeFunctionError extends Error {
  code?: string;
  requestId: string;
  diagnostics?: Record<string, unknown>;

  constructor({
    message,
    code,
    requestId,
    diagnostics,
  }: {
    message: string;
    code?: string;
    requestId: string;
    diagnostics?: Record<string, unknown>;
  }) {
    super(requestId ? `${message}\nID ошибки: ${requestId}` : message);
    this.name = "EdgeFunctionError";
    this.code = code;
    this.requestId = requestId;
    this.diagnostics = diagnostics;
  }
}

export const buildEdgeFunctionError = ({
  message,
  fallbackMessage,
  code,
  requestId,
  diagnostics,
}: {
  message?: string;
  fallbackMessage: string;
  code?: string;
  requestId: string;
  diagnostics?: Record<string, unknown>;
}): EdgeFunctionError =>
  new EdgeFunctionError({
    message: message || fallbackMessage,
    code,
    requestId,
    diagnostics,
  });

export const getFunctionErrorPayload = async (
  error: unknown,
): Promise<FunctionError | null> => {
  const context =
    error && typeof error === "object" && "context" in error
      ? (error as { context?: unknown }).context
      : null;

  if (!(context instanceof Response)) return null;

  try {
    const payload = (await context.clone().json()) as FunctionError | null;
    return payload && "error" in payload ? payload : null;
  } catch {
    return null;
  }
};

export const getSuccessDiagnostics = <TData>(
  payload: FunctionSuccess<TData>,
): Record<string, unknown> | null => {
  const diagnostics =
    payload.data &&
    typeof payload.data === "object" &&
    "diagnostics" in payload.data
      ? (payload.data as { diagnostics?: unknown }).diagnostics
      : null;

  return diagnostics && typeof diagnostics === "object" && !Array.isArray(diagnostics)
    ? (diagnostics as Record<string, unknown>)
    : null;
};
