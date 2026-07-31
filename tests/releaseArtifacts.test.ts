import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  checkReleaseArtifacts,
  validateReleaseArtifacts,
} from "../scripts/release-check";
import { currentRelease } from "../src/constants/currentRelease";

const validArtifacts = {
  packageVersion: "0.1.1",
  currentRelease,
  changelog: [
    "# Changelog",
    "",
    "## [Unreleased]",
    "",
    "## [0.1.1] - 2026-07-24",
  ].join("\n"),
};

test("current release contains the approved single user-facing entry", () => {
  assert.equal(currentRelease.version, "0.1.1");
  assert.equal(currentRelease.releasedAt, "2026-07-24");
  assert.deepEqual(currentRelease.items, [
    "Приложение запоминает место чтения и возвращает к нему после повторного открытия.",
    "Незавершённый текст сохраняется, а новый учебный день начинается в 5 утра.",
    "Главная точнее показывает прогресс урока и количество прочитанных текстов.",
    "Повторение слов корректнее отображает завершённый план и новые карточки.",
  ]);
  assert.equal(Object.isFrozen(currentRelease), true);
  assert.equal(Object.isFrozen(currentRelease.items), true);
});

test("release check accepts the repository artifacts", () => {
  const projectRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
  );

  assert.deepEqual(checkReleaseArtifacts(projectRoot), []);
});

test("release check reports an invalid package version", () => {
  assert.match(
    validateReleaseArtifacts({
      ...validArtifacts,
      packageVersion: "v0.1",
    }).join("\n"),
    /package\.json.*MAJOR\.MINOR\.PATCH/,
  );
});

test("release check reports a current release version mismatch", () => {
  assert.match(
    validateReleaseArtifacts({
      ...validArtifacts,
      currentRelease: { ...currentRelease, version: "0.1.2" },
    }).join("\n"),
    /currentRelease\.ts.*не совпадает/,
  );
});

test("release check reports an invalid release date", () => {
  assert.match(
    validateReleaseArtifacts({
      ...validArtifacts,
      currentRelease: { ...currentRelease, releasedAt: "24.07.2026" },
    }).join("\n"),
    /currentRelease\.ts.*YYYY-MM-DD/,
  );
});

test("release check rejects a day outside the calendar month", () => {
  assert.match(
    validateReleaseArtifacts({
      ...validArtifacts,
      currentRelease: { ...currentRelease, releasedAt: "2026-02-30" },
    }).join("\n"),
    /src\/constants\/currentRelease\.ts.*2026-02-30.*календарной датой/,
  );
});

test("release check rejects a month outside the calendar year", () => {
  assert.match(
    validateReleaseArtifacts({
      ...validArtifacts,
      currentRelease: { ...currentRelease, releasedAt: "2026-13-01" },
    }).join("\n"),
    /src\/constants\/currentRelease\.ts.*2026-13-01.*календарной датой/,
  );
});

test("release check reports invalid item count and blank items", () => {
  assert.match(
    validateReleaseArtifacts({
      ...validArtifacts,
      currentRelease: { ...currentRelease, items: [] },
    }).join("\n"),
    /от 1 до 5/,
  );
  assert.match(
    validateReleaseArtifacts({
      ...validArtifacts,
      currentRelease: { ...currentRelease, items: [" "] },
    }).join("\n"),
    /пустые пункты/,
  );
});

test("release check reports missing changelog release heading", () => {
  assert.match(
    validateReleaseArtifacts({
      ...validArtifacts,
      changelog: "## [Unreleased]\n\n## [0.1.1] - 2026-07-23",
    }).join("\n"),
    /CHANGELOG\.md.*0\.1\.1.*2026-07-24/,
  );
});

test("release check reports a missing Unreleased section", () => {
  assert.match(
    validateReleaseArtifacts({
      ...validArtifacts,
      changelog: "## [0.1.1] - 2026-07-24",
    }).join("\n"),
    /CHANGELOG\.md.*Unreleased/,
  );
});
