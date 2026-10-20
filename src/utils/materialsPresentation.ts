const DATE_FORMATTER = new Intl.DateTimeFormat('ru-RU', {
  timeZone: 'Europe/Moscow',
  day: 'numeric',
  month: 'long',
})

const TIME_FORMATTER = new Intl.DateTimeFormat('ru-RU', {
  timeZone: 'Europe/Moscow',
  hour: '2-digit',
  minute: '2-digit',
})

export const formatCompletedDateTime = (value: string): string =>
  `${DATE_FORMATTER.format(new Date(value))}, ${TIME_FORMATTER.format(new Date(value))}`

export const getModelLabel = (model: string): string => {
  const modelName = model.split('/').pop()?.replace(':free', '')
  return modelName || model
}
