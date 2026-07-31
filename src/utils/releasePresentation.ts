const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export const formatReleaseDate = (value: string): string => {
  const match = ISO_DATE_PATTERN.exec(value);

  if (!match) {
    return value.trim() || "Дата не указана";
  }

  const [, year, month, day] = match;
  const date = new Date(
    Date.UTC(Number(year), Number(month) - 1, Number(day), 12),
  );

  if (
    date.getUTCFullYear() !== Number(year) ||
    date.getUTCMonth() !== Number(month) - 1 ||
    date.getUTCDate() !== Number(day)
  ) {
    return value;
  }

  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Moscow",
  }).format(date);
};
