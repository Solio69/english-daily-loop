import React, { useState } from 'react';
import { Button } from '../components/Button';
import { BookOpen, Clock, Loader2, Sparkles, Plus, X } from 'lucide-react';

const MOCK_TEXT = {
  title: "A Day in the City",
  level: "My level",
  time: "3 min",
  body: "The city was alive with the sound of traffic and the chatter of people. Sarah walked down the busy street, feeling the energy of the morning. She stopped at a small café to get a cup of coffee and a croissant. The smell of fresh bread was everywhere.\n\nShe looked at her watch and realized she was almost late for her meeting. She picked up her bag and started to walk faster. The tall buildings seemed to reach for the sky, and the sun was shining brightly. It was a beautiful day to be in the city."
};

export const ReadingScreen: React.FC<{ onBack: () => void, onNext?: () => void }> = ({ onBack, onNext }) => {
  const [level, setLevel] = useState<'My level' | 'One level up'>('My level');
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState<typeof MOCK_TEXT | null>(null);
  const [selectedWord, setSelectedWord] = useState<{ word: string; index: number; x: number; y: number } | null>(null);
  const [savedWords, setSavedWords] = useState<Set<number>>(new Set());

  const handleGenerate = () => {
    setLoading(true);
    setText(null);
    setSavedWords(new Set());
    setTimeout(() => {
      setText(MOCK_TEXT);
      setLoading(false);
    }, 1500);
  };

  const handleWordClick = (word: string, index: number, e: React.MouseEvent) => {
    if (savedWords.has(index)) return;
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    setSelectedWord({ word, index, x: rect.left + rect.width / 2, y: rect.top + window.scrollY });
  };

  const handleAddWord = () => {
    if (selectedWord) {
      setSavedWords(prev => new Set(prev).add(selectedWord.index));
      setSelectedWord(null);
    }
  };

  return (
    <div className="p-4 space-y-6">
      <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 space-y-4">
        <div className="flex bg-gray-100 dark:bg-gray-900 p-1 rounded-lg">
          {(['My level', 'One level up'] as const).map((l) => (
            <button
              key={l}
              onClick={() => setLevel(l)}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${level === l ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}
            >
              {l}
            </button>
          ))}
        </div>
        <Button onClick={handleGenerate} className="w-full flex items-center justify-center gap-2 dark:bg-orange-500 dark:hover:bg-orange-600">
          <Sparkles size={18} /> Generate text
        </Button>
      </div>

      {loading && (
        <div className="flex flex-col items-center justify-center py-12 gap-3 text-gray-400 dark:text-gray-500">
          <Loader2 size={32} className="animate-spin" />
          <p>Generating text...</p>
        </div>
      )}

      {text && (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 space-y-4">
          <div className="flex justify-between items-center text-sm text-gray-500 dark:text-gray-400">
            <span className="font-medium text-gray-900 dark:text-white">{text.title}</span>
            <div className="flex items-center gap-2">
              <span className="bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded text-xs">{text.level}</span>
              <span className="flex items-center gap-1"><Clock size={14} /> {text.time}</span>
            </div>
          </div>
          <p className="text-gray-800 dark:text-gray-200 leading-relaxed text-lg">
            {text.body.split(' ').map((word, i) => {
              const cleanWord = word.replace(/[.,]/g, '');
              const isSelected = selectedWord?.index === i;
              const isSaved = savedWords.has(i);
              return (
                <span 
                  key={i} 
                  onClick={(e) => handleWordClick(cleanWord, i, e)} 
                  className={`cursor-pointer rounded px-0.5 transition-colors ${isSelected ? 'bg-blue-200 dark:bg-orange-900/40' : isSaved ? 'bg-green-200 dark:bg-green-900/40' : 'hover:bg-blue-100 dark:hover:bg-gray-700'}`}
                >
                  {word}{' '}
                </span>
              );
            })}
          </p>
        </div>
      )}

      {text && (
        <Button variant="outline" className="w-full dark:border-gray-700 dark:text-gray-200" onClick={onNext || onBack}>Done with this text</Button>
      )}

      {selectedWord && (
        <div 
          className="absolute bg-white dark:bg-gray-800 p-3 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 flex flex-col gap-2 z-50" 
          style={{ 
            top: selectedWord.y > window.innerHeight / 2 + window.scrollY ? selectedWord.y - 110 : selectedWord.y + 30, 
            left: selectedWord.x - 70 
          }}
        >
          <p className="text-xs text-center dark:text-gray-200">Add to dictionary?</p>
          <div className="flex gap-2">
            <Button onClick={handleAddWord} className="flex-1 text-xs py-1 dark:bg-orange-500 dark:hover:bg-orange-600">Add</Button>
            <Button onClick={() => setSelectedWord(null)} variant="outline" className="flex-1 text-xs py-1 dark:border-gray-700 dark:text-gray-200">Cancel</Button>
          </div>
        </div>
      )}
    </div>
  );
};
