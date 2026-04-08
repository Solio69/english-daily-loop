import { CheckCircle2 } from "lucide-react";
import React, { useEffect, useState } from "react";
import { Button } from "../components/Button";
import {
  checkMockExerciseAnswer,
  getMockExercisesForLesson,
} from "../services/mockServices";
import { Exercise } from "../types";

export const ExercisesScreen: React.FC<{
  onBack: () => void;
  onNext?: () => void;
}> = ({ onBack, onNext }) => {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedWords, setSelectedWords] = useState<string[]>([]);
  const [availableWords, setAvailableWords] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<"correct" | "incorrect" | null>(
    null,
  );
  const [summary, setSummary] = useState({ correct: 0, incorrect: 0 });
  const [isSessionFinished, setIsSessionFinished] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMockExercisesForLesson("l1").then((data) => {
      setExercises(data);
      if (data.length > 0) {
        setAvailableWords(data[0].options || []);
      }
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (exercises.length > 0) {
      setAvailableWords(exercises[currentIndex].options || []);
      setSelectedWords([]);
    }
  }, [currentIndex, exercises]);

  const handleSubmit = async () => {
    const answer = selectedWords.join(" ");
    const isCorrect = await checkMockExerciseAnswer(
      exercises[currentIndex].id,
      answer,
    );
    setFeedback(isCorrect ? "correct" : "incorrect");
    setSummary((prev) => ({
      ...prev,
      [isCorrect ? "correct" : "incorrect"]:
        prev[isCorrect ? "correct" : "incorrect"] + 1,
    }));
  };

  const handleNext = () => {
    setFeedback(null);
    setSelectedWords([]);
    if (currentIndex + 1 >= exercises.length) {
      if (onNext) {
        onNext();
      } else {
        setIsSessionFinished(true);
      }
    } else {
      setCurrentIndex((prev) => prev + 1);
    }
  };

  const addWord = (word: string, index: number) => {
    setSelectedWords([...selectedWords, word]);
    setAvailableWords(availableWords.filter((_, i) => i !== index));
  };

  const removeWord = (word: string, index: number) => {
    setAvailableWords([...availableWords, word]);
    setSelectedWords(selectedWords.filter((_, i) => i !== index));
  };

  if (loading)
    return (
      <div className="p-4 dark:text-gray-200">Загружаем упражнения...</div>
    );

  if (isSessionFinished)
    return (
      <div className="p-6 text-center space-y-6">
        <CheckCircle2 size={64} className="mx-auto text-green-500" />
        <h2 className="text-3xl font-bold dark:text-white">
          Сессия завершена!
        </h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-2xl">
            <p className="text-sm text-green-600 dark:text-green-400">Верно</p>
            <p className="text-2xl font-bold text-green-800 dark:text-green-300">
              {summary.correct}
            </p>
          </div>
          <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-2xl">
            <p className="text-sm text-red-600 dark:text-red-400">Ошибки</p>
            <p className="text-2xl font-bold text-red-800 dark:text-red-300">
              {summary.incorrect}
            </p>
          </div>
        </div>
        <Button
          className="w-full py-4 dark:bg-orange-500 dark:hover:bg-orange-600"
          onClick={() => (window.location.href = "/")}
        >
          Продолжить
        </Button>
      </div>
    );

  const exercise = exercises[currentIndex];

  return (
    <div className="p-4 space-y-4 max-w-md mx-auto">
      <header className="flex justify-between items-center text-sm text-gray-500 dark:text-gray-400 mb-2">
        <span>Урок 1</span>
        <span>5 мин</span>
        <span>
          {currentIndex + 1} / {exercises.length}
        </span>
      </header>

      <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 space-y-6">
        <p className="text-xl font-bold text-gray-900 dark:text-white">
          {exercise.prompt}
        </p>

        {/* Answer Area */}
        <div className="min-h-[60px] p-4 bg-gray-50 dark:bg-gray-900 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700 flex flex-wrap gap-2">
          {selectedWords.length === 0 && (
            <p className="text-gray-400 dark:text-gray-600 w-full text-center">
              Нажимай на слова, чтобы собрать предложение
            </p>
          )}
          {selectedWords.map((word, i) => (
            <button
              key={i}
              className="px-3 py-1.5 bg-blue-100 dark:bg-orange-900/40 text-blue-800 dark:text-orange-200 rounded-lg font-medium"
              onClick={() => removeWord(word, i)}
            >
              {word}
            </button>
          ))}
        </div>

        {/* Word Bank */}
        <div className="flex flex-wrap gap-2">
          {availableWords.map((word, i) => (
            <button
              key={i}
              className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-xl font-medium"
              onClick={() => addWord(word, i)}
            >
              {word}
            </button>
          ))}
        </div>
      </div>

      {!feedback ? (
        <Button
          className="w-full py-4 text-lg dark:bg-orange-500 dark:hover:bg-orange-600"
          onClick={handleSubmit}
          disabled={selectedWords.length === 0}
        >
          Проверить
        </Button>
      ) : (
        <div
          className={`p-6 rounded-3xl ${feedback === "correct" ? "bg-green-50 dark:bg-green-900/20" : "bg-red-50 dark:bg-red-900/20"}`}
        >
          <p
            className={`font-bold ${feedback === "correct" ? "text-green-800 dark:text-green-300" : "text-red-800 dark:text-red-300"}`}
          >
            {feedback === "correct" ? "Верно!" : "Есть ошибка"}
          </p>
          <p className="text-gray-700 dark:text-gray-300 mt-2">
            Правильный ответ: {exercise.correctAnswer}
          </p>
          <Button
            className={`w-full mt-4 ${feedback === "correct" ? "bg-green-600 dark:bg-green-700" : "bg-red-600 dark:bg-red-700"}`}
            onClick={handleNext}
          >
            Следующее упражнение
          </Button>
        </div>
      )}
    </div>
  );
};
