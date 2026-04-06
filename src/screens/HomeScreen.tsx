import React from 'react';
import { Button } from '../components/Button';
import { mockUser } from '../data/mockData';
import { Zap, BookOpen, BrainCircuit, Flame, Settings, CheckCircle2, Clock, Target, ChevronRight } from 'lucide-react';
import { ThemeToggle } from '../components/ThemeToggle';

export const HomeScreen: React.FC<{ onNavigate: (screen: string) => void, onStartFlow: () => void, isLessonFinished: boolean }> = ({ onNavigate, onStartFlow, isLessonFinished }) => {
  return (
    <div className="p-4 space-y-8">
      <header className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Welcome back,</p>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{mockUser.name}!</h1>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 px-3 py-1.5 rounded-full text-sm font-semibold">
              <Flame size={16} />
              {mockUser.streak}
            </div>
            <ThemeToggle />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Today Progress</h2>
            <Settings size={14} onClick={() => onNavigate('settings')} className="text-gray-300 dark:text-gray-600 hover:text-gray-500 dark:hover:text-gray-400 cursor-pointer transition-colors" />
          </div>
          
          <div className="flex justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className={`p-1.5 rounded-full ${isLessonFinished ? 'bg-green-50 dark:bg-green-900/20 text-green-600' : 'bg-green-50 dark:bg-green-900/20 text-green-600'}`}><CheckCircle2 size={14} /></div>
              <div>
                <p className="text-xs font-medium text-gray-700 dark:text-gray-200">Exercises</p>
                <p className="text-[10px] text-gray-400 dark:text-gray-500">{isLessonFinished ? 'Done' : 'Done'}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className={`p-1.5 rounded-full ${isLessonFinished ? 'bg-green-50 dark:bg-green-900/20 text-green-600' : 'bg-blue-50 dark:bg-orange-900/20 text-blue-600 dark:text-orange-400'}`}><Clock size={14} /></div>
              <div>
                <p className="text-xs font-medium text-gray-700 dark:text-gray-200">Reading</p>
                <p className={`text-[10px] ${isLessonFinished ? 'text-green-500' : 'text-blue-500 dark:text-orange-500'}`}>{isLessonFinished ? 'Done' : 'In progress'}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className={`p-1.5 rounded-full ${isLessonFinished ? 'bg-green-50 dark:bg-green-900/20 text-green-600' : 'bg-gray-50 dark:bg-gray-700 text-gray-400 dark:text-gray-500'}`}><Target size={14} /></div>
              <div>
                <p className="text-xs font-medium text-gray-700 dark:text-gray-200">Review</p>
                <p className={`text-[10px] ${isLessonFinished ? 'text-green-500' : 'text-gray-400 dark:text-gray-500'}`}>{isLessonFinished ? 'Done' : 'Not started'}</p>
              </div>
            </div>
          </div>

          <div className="flex gap-1.5 pt-3 border-t border-gray-50 dark:border-gray-700">
            <span className="px-2 py-0.5 bg-gray-50 dark:bg-gray-700 rounded text-[10px] text-gray-500 dark:text-gray-400">5m Ex</span>
            <span className="px-2 py-0.5 bg-gray-50 dark:bg-gray-700 rounded text-[10px] text-gray-500 dark:text-gray-400">3m Read</span>
            <span className="px-2 py-0.5 bg-gray-50 dark:bg-gray-700 rounded text-[10px] text-gray-500 dark:text-gray-400">10 words</span>
          </div>
        </div>
      </header>

      <section className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
        <h2 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">Today's Plan</h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="font-bold text-lg text-gray-900 dark:text-white">{isLessonFinished ? 'Lesson 2: Completed!' : 'Lesson 2: Basic Statements'}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">{isLessonFinished ? 'Great job for today!' : 'Grammar Focus: Sentence structure'}</p>
          </div>
          {isLessonFinished ? (
            <div className="flex items-center gap-1.5 text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-3 py-1.5 rounded-full text-xs font-medium">
              <CheckCircle2 size={14} />
              <span>Completed</span>
            </div>
          ) : (
            <Button onClick={onStartFlow} className="rounded-full px-5 dark:bg-orange-500 dark:hover:bg-orange-600">Continue</Button>
          )}
        </div>
      </section>
    </div>
  );
};
