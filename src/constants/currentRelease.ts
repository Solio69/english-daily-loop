export type CurrentRelease = {
  version: string;
  releasedAt: string;
  items: readonly string[];
};

export const currentRelease: CurrentRelease = Object.freeze({
  version: "1.0.0",
  releasedAt: "2026-09-25",
  items: Object.freeze([
    "Бот помогает начать занятия и подсказывает, как открыть приложение.",
    "Главная приветствует с учётом текущей сессии.",
    "Серия чтения сохраняется, пока не пропущен учебный день.",
    "Ожидающее слово можно удалить прямо из текста до подготовки карточки.",
  ]),
});
