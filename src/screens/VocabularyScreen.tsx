import { CheckCircle2, RotateCcw, XCircle, Zap } from "lucide-react";
import React, { useEffect, useState } from "react";
import { Button } from "../components/Button";
import { LoadingState } from "../components/LoadingState";
import { getMockReviewQueue } from "../services/mockServices";
import { VocabularyItem } from "../types";

export const VocabularyScreen: React.FC<{
  onBack: () => void;
  onNext?: () => void;
}> = ({ onBack, onNext }) => {
  const [queue, setQueue] = useState<VocabularyItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showBack, setShowBack] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMockReviewQueue().then((data) => {
      setQueue(data);
      setLoading(false);
    });
  }, []);

  const handleNext = () => {
    if (currentIndex + 1 >= queue.length) {
      if (onNext) {
        onNext();
      } else {
        setCurrentIndex((prev) => prev + 1);
      }
    } else {
      setCurrentIndex((prev) => prev + 1);
      setShowBack(false);
    }
  };

  if (loading) return <LoadingState message="Загружаем слова..." />;
  if (queue.length === 0)
    return (
      <div className="p-4 text-center dark:text-gray-200">
        Слов для повторения пока нет
      </div>
    );
  if (currentIndex >= queue.length)
    return (
      <div className="p-4 text-center space-y-4">
        <CheckCircle2 size={48} className="mx-auto text-green-500" />
        <h2 className="text-2xl font-bold dark:text-white">
          Повторение завершено!
        </h2>
        <Button
          className="w-full py-4 dark:bg-orange-500 dark:hover:bg-orange-600"
          onClick={onNext || onBack}
        >
          Продолжить
        </Button>
      </div>
    );

  const item = queue[currentIndex];

  return (
    <div className="p-3 space-y-3 w-full max-w-full overflow-hidden">
      <header className="flex justify-between items-center text-sm text-gray-500 dark:text-gray-400">
        <div className="flex items-center gap-1">
          <Zap size={16} /> Повторение
        </div>
        <div>
          {currentIndex + 1} / {queue.length}
        </div>
      </header>

      <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 text-center min-h-[200px] flex flex-col justify-center items-center w-full">
        <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          {showBack ? item.translation : item.word}
        </h3>
        {showBack && (
          <p className="text-gray-600 dark:text-gray-400 text-base italic">
            "{item.example}"
          </p>
        )}
      </div>

      <Button
        className="w-full py-3 text-base dark:bg-orange-500 dark:hover:bg-orange-600"
        onClick={() => setShowBack(!showBack)}
      >
        <RotateCcw size={18} className="mr-2" />
        {showBack ? "Показать слово" : "Показать перевод"}
      </Button>

      {showBack && (
        <div className="grid grid-cols-2 gap-2 w-full">
          <Button
            variant="outline"
            className="py-3 text-base dark:border-gray-700 dark:text-gray-200"
            onClick={handleNext}
          >
            <XCircle size={18} className="mr-2" /> Снова
          </Button>
          <Button
            className="py-3 text-base dark:bg-green-600 dark:hover:bg-green-700"
            onClick={handleNext}
          >
            <CheckCircle2 size={18} className="mr-2" /> Знаю
          </Button>
        </div>
      )}
    </div>
  );
};
