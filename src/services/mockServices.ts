import { mockReadingTexts, mockVocabulary } from '../data/mockData';
import { ReadingText, VocabularyItem } from '../types';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const getMockReadingText = async (level: string): Promise<ReadingText> => {
  await delay(1000);
  return mockReadingTexts[0];
};

export const saveMockVocabularyItem = async (item: VocabularyItem): Promise<void> => {
  await delay(200);
  console.log('Word saved:', item);
};

export const getMockReviewQueue = async (): Promise<VocabularyItem[]> => {
  await delay(600);
  return mockVocabulary;
};
