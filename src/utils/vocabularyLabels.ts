const PART_OF_SPEECH_LABELS: Record<string, string> = {
  noun: "существительное",
  verb: "глагол",
  adjective: "прилагательное",
  adverb: "наречие",
  preposition: "предлог",
  conjunction: "союз",
  pronoun: "местоимение",
  phrase: "фраза",
  other: "другое",
};

export const getPartOfSpeechLabel = (value: string): string =>
  PART_OF_SPEECH_LABELS[value] ?? value;
