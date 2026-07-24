export type AppEnvironment =
  | "production"
  | "preview"
  | "telegram-dev"
  | "development";

export type ReleaseMetadata = {
  appVersion: string;
  buildId: string;
  environment: AppEnvironment;
};

const APP_ENVIRONMENTS: readonly AppEnvironment[] = [
  "production",
  "preview",
  "telegram-dev",
  "development",
];

export const createReleaseMetadata = (
  values: Partial<ReleaseMetadata>,
): ReleaseMetadata => {
  const environment = APP_ENVIRONMENTS.includes(
    values.environment as AppEnvironment,
  )
    ? (values.environment as AppEnvironment)
    : "development";

  return {
    appVersion: values.appVersion?.trim() || "unknown",
    buildId: values.buildId?.trim() || "local",
    environment,
  };
};

export const releaseMetadata: Readonly<ReleaseMetadata> = Object.freeze(
  createReleaseMetadata({
    appVersion:
      typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : undefined,
    buildId: typeof __BUILD_ID__ === "string" ? __BUILD_ID__ : undefined,
    environment:
      typeof __APP_ENVIRONMENT__ === "string"
        ? __APP_ENVIRONMENT__
        : undefined,
  }),
);
