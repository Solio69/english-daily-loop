export type CurrentRelease = {
  version: string;
  releasedAt: string;
  items: readonly string[];
};

export const currentRelease: CurrentRelease = Object.freeze({
  version: "0.1.1",
  releasedAt: "2026-07-24",
  items: Object.freeze([
    "Приложение запоминает место чтения и возвращает к нему после повторного открытия.",
    "Незавершённый текст сохраняется, а новый учебный день начинается в 5 утра.",
    "Главная точнее показывает прогресс урока и количество прочитанных текстов.",
    "Повторение слов корректнее отображает завершённый план и новые карточки.",
  ]),
});
