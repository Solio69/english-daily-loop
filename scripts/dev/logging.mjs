import process from "node:process";

// TODO: Local launch UX helpers for terminal readability only.
export const color = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  cyan: "\x1b[96m",
  green: "\x1b[92m",
  yellow: "\x1b[93m",
  blue: "\x1b[94m",
  magenta: "\x1b[95m",
  red: "\x1b[91m",
  gray: "\x1b[90m",
};

export const useColor = Boolean(process.stdout.isTTY);

export const labelColors = {
  frontend: color.magenta,
  edge: color.blue,
  db: color.yellow,
  api: color.red,
  "tunnel-frontend": color.green,
  "tunnel-api": color.cyan,
  tunnel: color.gray,
  env: color.gray,
};

const methodColor = color.magenta;

export function withColor(text, tone) {
  if (!useColor) return text;
  return `${tone}${text}${color.reset}`;
}

function statusColor(codeText) {
  const code = Number(codeText);
  if (code >= 500) return color.red;
  if (code >= 400) return color.red;
  if (code >= 300) return color.yellow;
  if (code >= 200) return color.green;
  return color.cyan;
}

function hasErrorMarkers(line) {
  return /\b(error|failed|exception|panic|unhandled)\b/i.test(line);
}

function colorizeHttpTokens(line) {
  let next = line;
  next = next.replace(/\b(GET|POST|PUT|PATCH|DELETE|HEAD)\b/g, (method) =>
    withColor(method, `${color.bold}${methodColor}`),
  );
  next = next.replace(/"\s([1-5]\d{2})\b/g, (full, code) =>
    full.replace(code, withColor(code, `${color.bold}${statusColor(code)}`)),
  );
  next = next.replace(/\bstatus(?:=|:)\s*([1-5]\d{2})\b/gi, (full, code) =>
    full.replace(code, withColor(code, `${color.bold}${statusColor(code)}`)),
  );
  return next;
}

export function formatLogLine(rawLine, isErr) {
  let line = colorizeHttpTokens(rawLine);
  if (isErr || hasErrorMarkers(rawLine)) {
    line = withColor(line, color.red);
  }
  return line;
}
