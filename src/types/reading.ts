export type ReadingMode = 'my_level' | 'one_level_up';

export type ReadingText = {
  id: string;
  title: string;
  level: string;
  body: string;
  estimatedMinutes: number;
};
