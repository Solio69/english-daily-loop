import React, { useState } from 'react';
import { Button } from '../components/Button';
import { ChevronLeft } from 'lucide-react';

export const SettingsScreen: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [level, setLevel] = useState('A1');
  const [time, setTime] = useState(10);
  const [words, setWords] = useState(10);

  return (
    <div className="p-4 space-y-8">
      <button onClick={onBack} className="flex items-center gap-1 text-gray-500 dark:text-gray-400 text-sm hover:text-gray-700 dark:hover:text-gray-300">
        <ChevronLeft size={20} /> Back
      </button>
      
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Session settings</h1>

      <div className="space-y-6">
        {/* Text Level */}
        <section>
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Text level</h2>
          <div className="flex bg-gray-100 dark:bg-gray-900 p-1 rounded-full">
            {['A1', 'A2', 'B1', 'B2'].map((option) => (
              <button
                key={option}
                onClick={() => setLevel(option)}
                className={`flex-1 py-2 text-sm font-medium rounded-full transition-colors ${
                  level === option ? 'bg-green-500 text-white shadow-sm' : 'text-gray-500 dark:text-gray-400'
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        </section>

        {/* Exercise Time */}
        <section>
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Exercise time</h2>
          <div className="grid grid-cols-4 gap-2">
            {[5, 10, 15, 20].map((value) => (
              <button
                key={value}
                onClick={() => setTime(value)}
                className={`py-2 text-sm font-medium rounded-xl transition-colors ${
                  time === value ? 'bg-green-500 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                }`}
              >
                {value}m
              </button>
            ))}
          </div>
        </section>

        {/* Words to Review */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Words to review</h2>
            <span className="text-[10px] text-gray-400 dark:text-gray-500">MVP setting</span>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {[5, 10, 15, 20].map((value) => (
              <button
                key={value}
                onClick={() => setWords(value)}
                className={`py-2 text-sm font-medium rounded-xl transition-colors ${
                  words === value ? 'bg-green-500 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                }`}
              >
                {value}
              </button>
            ))}
          </div>
        </section>
      </div>

      <Button onClick={onBack} className="w-full rounded-full py-3 text-base dark:bg-orange-500 dark:hover:bg-orange-600">Save</Button>
    </div>
  );
};
