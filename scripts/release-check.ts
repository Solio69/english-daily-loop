import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { currentRelease, type CurrentRelease } from "../src/constants/currentRelease";

type ReleaseCheckArtifacts = {
  packageVersion: string;
  currentRelease: CurrentRelease;
  changelog: string;
};

const SEMVER_PATTERN =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

const escapeRegExp = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const isValidIsoCalendarDate = (value: string): boolean => {
  const match = ISO_DATE_PATTERN.exec(value);
  if (!match) {
    return false;
  }

  const [, year, month, day] = match;
  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(Number(year), Number(month) - 1, Number(day));

  return (
    date.getUTCFullYear() === Number(year) &&
    date.getUTCMonth() === Number(month) - 1 &&
    date.getUTCDate() === Number(day)
  );
};

export const validateReleaseArtifacts = ({
  packageVersion,
  currentRelease: release,
  changelog,
}: ReleaseCheckArtifacts): string[] => {
  const errors: string[] = [];

  if (!SEMVER_PATTERN.test(packageVersion)) {
    errors.push(
      `package.json: version "${packageVersion}" должна иметь формат MAJOR.MINOR.PATCH.`,
    );
  }

  if (release.version !== packageVersion) {
    errors.push(
      `src/constants/currentRelease.ts: version "${release.version}" не совпадает с package.json version "${packageVersion}".`,
    );
  }

  if (!ISO_DATE_PATTERN.test(release.releasedAt)) {
    errors.push(
      `src/constants/currentRelease.ts: releasedAt "${release.releasedAt}" должна иметь формат YYYY-MM-DD.`,
    );
  } else if (!isValidIsoCalendarDate(release.releasedAt)) {
    errors.push(
      `src/constants/currentRelease.ts: releasedAt "${release.releasedAt}" не является существующей календарной датой.`,
    );
  }

  if (release.items.length < 1 || release.items.length > 5) {
    errors.push(
      `src/constants/currentRelease.ts: items должна содержать от 1 до 5 пунктов, получено ${release.items.length}.`,
    );
  }

  if (release.items.some((item) => !item.trim())) {
    errors.push(
      "src/constants/currentRelease.ts: items не должна содержать пустые пункты.",
    );
  }

  const releaseHeadingPattern = new RegExp(
    `^## \\[${escapeRegExp(packageVersion)}\\] - ${escapeRegExp(release.releasedAt)}$`,
    "m",
  );

  if (!releaseHeadingPattern.test(changelog)) {
    errors.push(
      `CHANGELOG.md: не найден heading "## [${packageVersion}] - ${release.releasedAt}".`,
    );
  }

  if (!/^## \[Unreleased\]$/m.test(changelog)) {
    errors.push('CHANGELOG.md: не найдена секция "## [Unreleased]".');
  }

  return errors;
};

export const checkReleaseArtifacts = (
  projectRoot: string,
): string[] => {
  const packageJsonPath = path.join(projectRoot, "package.json");
  const changelogPath = path.join(projectRoot, "CHANGELOG.md");
  const packageJson = JSON.parse(
    readFileSync(packageJsonPath, "utf8"),
  ) as { version?: unknown };
  const packageVersion =
    typeof packageJson.version === "string" ? packageJson.version : "";

  return validateReleaseArtifacts({
    packageVersion,
    currentRelease,
    changelog: readFileSync(changelogPath, "utf8"),
  });
};

const isDirectRun =
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  const projectRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
  );
  const errors = checkReleaseArtifacts(projectRoot);

  if (errors.length > 0) {
    console.error("Проверка релизных артефактов завершилась с ошибками:");
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exitCode = 1;
  } else {
    console.log(
      `Релизные артефакты согласованы: версия ${currentRelease.version}, дата ${currentRelease.releasedAt}.`,
    );
  }
}
