import type { ServiceClient } from "./app.ts";
import { assertAdminRole } from "./access.ts";
import type { ParsedDevToolInput } from "./dev-tools-contract.ts";
import { executeDevToolAction } from "./dev-tools-actions.ts";
import { fail } from "./server.ts";

export const assertDevToolsEnabled = (
  value: string | null | undefined,
): void => {
  if (value !== "true") {
    fail(403, "DEV_TOOLS_DISABLED", "Dev tools are disabled.");
  }
};

type AuthorizedActionParams = {
  supabase: ServiceClient;
  userId: string;
  studyDate: string;
  input: ParsedDevToolInput;
};

export const runAuthorizedDevToolAction = async ({
  supabase,
  userId,
  studyDate,
  input,
}: AuthorizedActionParams) => {
  await assertAdminRole(supabase, userId, "[dev-tools]");
  return executeDevToolAction(supabase, userId, studyDate, input);
};
