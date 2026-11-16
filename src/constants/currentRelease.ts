export type CurrentRelease = {
  version: string
  releasedAt: string
  items: readonly string[]
}

export const currentRelease: CurrentRelease = Object.freeze({
  version: '1.1.17',
  releasedAt: '2026-11-16',
  items: Object.freeze([
    'Если при открытии приложения произошла ошибка, вход можно повторить.',

    'Отчёт об ошибке отправляется с более безопасной диагностикой.',
    'Окном отчёта об ошибке удобнее управлять с клавиатуры.',
  ]),
})
