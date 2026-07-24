import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const settingsSource = readFileSync("src/screens/SettingsScreen.tsx", "utf8");
const cardSource = readFileSync(
  "src/components/settings/AppVersionCard.tsx",
  "utf8",
);
const modalSource = readFileSync(
  "src/components/settings/ReleaseNotesModal.tsx",
  "utf8",
);
const supportModalSource = readFileSync(
  "src/components/settings/SupportReportCard.tsx",
  "utf8",
);

test("version card stays between support report and feedback", () => {
  const supportIndex = settingsSource.indexOf("<SupportReportCard");
  const versionIndex = settingsSource.indexOf("<AppVersionCard");
  const feedbackIndex = settingsSource.indexOf("{feedbackTelegramUrl ?");

  assert.ok(supportIndex >= 0);
  assert.ok(versionIndex > supportIndex);
  assert.ok(feedbackIndex > versionIndex);
});

test("version card is one accessible button without read state", () => {
  assert.match(cardSource, /<button[\s\S]*aria-label=/);
  assert.doesNotMatch(cardSource, /<button[\s\S]*<button/);
  assert.match(cardSource, /Открыть описание версии/);
  assert.doesNotMatch(
    [settingsSource, cardSource, modalSource].join("\n"),
    /localStorage|unread|hasRead|isRead/,
  );
});

test("release notes modal has the agreed accessible close behavior", () => {
  assert.match(modalSource, /role="dialog"/);
  assert.match(modalSource, /aria-modal="true"/);
  assert.match(modalSource, /aria-labelledby=/);
  assert.match(modalSource, /event\.key === "Escape"/);
  assert.match(modalSource, /aria-label="Закрыть"/);
  assert.match(modalSource, /document\.body\.style\.overflow = "hidden"/);
  assert.doesNotMatch(modalSource, /onClick=\{onClose\}[\s\S]*role="dialog"/);
});

test("release notes modal traps forward and backward keyboard focus", () => {
  assert.match(modalSource, /FOCUSABLE_ELEMENT_SELECTOR/);
  assert.match(modalSource, /querySelectorAll<HTMLElement>/);
  assert.match(modalSource, /event\.key !== "Tab"/);
  assert.match(modalSource, /event\.shiftKey/);
  assert.match(modalSource, /lastElement\.focus\(\)/);
  assert.match(modalSource, /firstElement\.focus\(\)/);
  assert.match(modalSource, /closeButtonRef\.current\?\.focus\(\)/);
  assert.match(settingsSource, /appVersionCardRef\.current\?\.focus\(\)/);
});

test("release notes surface stays above the dimmed backdrop", () => {
  const styles = readFileSync("src/index.css", "utf8");

  assert.match(modalSource, /glass-card glass-modal/);
  assert.match(
    styles,
    /\.glass-card\.glass-modal[\s\S]*var\(--surface-strong\)[\s\S]*var\(--background\)/,
  );
});

test("support report modal uses the same untinted glass surface", () => {
  assert.match(supportModalSource, /glass-card glass-modal/);
});
