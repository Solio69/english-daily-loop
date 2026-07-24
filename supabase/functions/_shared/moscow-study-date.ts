/// <reference path="../deno-globals.d.ts" />

export const MOSCOW_TIME_ZONE = "Europe/Moscow";
export const STUDY_DAY_START_HOUR = 5;

const formatDateParts = (year: number, month: number, day: number): string =>
  `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

const getPreviousCalendarDate = (
  year: number,
  month: number,
  day: number,
): string => {
  const previousDate = new Date(Date.UTC(year, month - 1, day));
  previousDate.setUTCDate(previousDate.getUTCDate() - 1);

  return formatDateParts(
    previousDate.getUTCFullYear(),
    previousDate.getUTCMonth() + 1,
    previousDate.getUTCDate(),
  );
};

export const getMoscowStudyDate = (date = new Date()): string => {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: MOSCOW_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );

  const year = Number(values.year);
  const month = Number(values.month);
  const day = Number(values.day);
  const hour = Number(values.hour);

  return hour < STUDY_DAY_START_HOUR
    ? getPreviousCalendarDate(year, month, day)
    : formatDateParts(year, month, day);
};
