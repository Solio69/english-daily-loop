type RussianPluralForms = {
  one: string
  few: string
  many: string
}

export const getRussianPlural = (
  count: number,
  { one, few, many }: RussianPluralForms,
) => {
  const value = Math.abs(count)
  const lastTwoDigits = value % 100
  const lastDigit = value % 10

  if (lastTwoDigits >= 11 && lastTwoDigits <= 14) return many
  if (lastDigit === 1) return one
  if (lastDigit >= 2 && lastDigit <= 4) return few
  return many
}

export const formatRussianCount = (count: number, forms: RussianPluralForms) =>
  `${count} ${getRussianPlural(count, forms)}`

export const cardAttemptForms: RussianPluralForms = {
  one: 'попытка',
  few: 'попытки',
  many: 'попыток',
}

export const wordWithoutCardForms: RussianPluralForms = {
  one: 'слово без карточки',
  few: 'слова без карточек',
  many: 'слов без карточек',
}

export const approvalWaitingForms: RussianPluralForms = {
  one: 'ждет подтверждения',
  few: 'ждут подтверждения',
  many: 'ждут подтверждения',
}
