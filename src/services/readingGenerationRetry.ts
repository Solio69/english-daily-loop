import { EdgeFunctionError } from "./edgeFunctionErrors";

export const retryUnknownGenerationOutcome = async <TResult>(
  requestId: string,
  invoke: (requestId: string) => Promise<TResult>,
): Promise<TResult> => {
  try {
    return await invoke(requestId);
  } catch (error) {
    if (!(error instanceof EdgeFunctionError) || error.code) {
      throw error;
    }

    return invoke(requestId);
  }
};
