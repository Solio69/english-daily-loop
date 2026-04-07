import { supabase } from '../lib/supabase';
import { ReadingMode, ReadingText } from '../types/reading';

type ReadingTextRow = {
  id: string;
  title: string;
  level: string;
  body: string;
  estimated_minutes: number;
};

const fetchReadingTextsByMode = async (mode: ReadingMode): Promise<ReadingText[]> => {
  const { data, error } = await supabase
    .from('reading_texts')
    .select('id, title, level, body, estimated_minutes')
    .eq('tier', mode)
    .eq('is_active', true);

  if (error) {
    throw new Error('Could not load text. Please try again.');
  }

  const rows = (data ?? []) as ReadingTextRow[];
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    level: row.level,
    body: row.body,
    estimatedMinutes: row.estimated_minutes,
  }));
};

export const getRandomReadingText = async (mode: ReadingMode): Promise<ReadingText> => {
  const texts = await fetchReadingTextsByMode(mode);
  if (texts.length === 0) {
    throw new Error('No texts found for selected mode.');
  }

  return texts[Math.floor(Math.random() * texts.length)];
};
