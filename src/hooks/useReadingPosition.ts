import { useCallback, useEffect, useRef, useState } from "react";
import { saveReadingPosition } from "../services/readingService";
import { clientLogger } from "../services/clientLogger";
import { ReadingText } from "../types/reading";
import {
  getReachedReadingParagraphIndex,
  getReadingPositionRestoreKey,
} from "../utils/readingPosition";
import { ReadingPositionSync } from "../utils/readingPositionSync";

const POSITION_VIEWPORT_OFFSET = 96;
const SCROLL_TOP_BUTTON_THRESHOLD = 320;

type UseReadingPositionResult = {
  registerParagraph: (
    paragraphIndex: number,
    element: HTMLParagraphElement | null,
  ) => void;
  isScrollTopVisible: boolean;
  positionError: string | null;
  retryPositionSave: () => void;
  scrollToPageTop: () => void;
};

export const useReadingPosition = (
  text: ReadingText | null,
  isContentVisible = true,
): UseReadingPositionResult => {
  const paragraphElementsRef = useRef(
    new Map<number, HTMLParagraphElement>(),
  );
  const isProgrammaticScrollRef = useRef(true);
  const animationFrameRef = useRef<number | null>(null);
  const [isScrollTopVisible, setIsScrollTopVisible] = useState(false);
  const [positionError, setPositionError] = useState<string | null>(null);
  const syncRef = useRef<ReadingPositionSync | null>(null);
  const restoreKey = getReadingPositionRestoreKey(
    text?.id ?? null,
    text?.lastReadParagraphIndex ?? null,
    isContentVisible,
  );

  if (syncRef.current === null) {
    syncRef.current = new ReadingPositionSync({
      save: saveReadingPosition,
      onSaved: () => {
        setPositionError(null);
      },
      onError: (error, operation) => {
        clientLogger.warning("reading_position_save_failed", {
          readingTextId: operation.readingTextId,
          paragraphIndex: operation.paragraphIndex,
        });
        setPositionError(
          error instanceof Error
            ? error.message
            : "Не удалось сохранить позицию чтения.",
        );
      },
    });
  }

  const registerParagraph = useCallback(
    (paragraphIndex: number, element: HTMLParagraphElement | null) => {
      if (element) {
        paragraphElementsRef.current.set(paragraphIndex, element);
      } else {
        paragraphElementsRef.current.delete(paragraphIndex);
      }
    },
    [],
  );

  useEffect(() => {
    const sync = syncRef.current;
    sync?.setActiveText(
      restoreKey ? (text?.id ?? null) : null,
      restoreKey ? (text?.lastReadParagraphIndex ?? null) : null,
    );
    setPositionError(null);
    setIsScrollTopVisible(false);
    isProgrammaticScrollRef.current = true;

    if (!text || !restoreKey) {
      isProgrammaticScrollRef.current = false;
      return;
    }

    let releaseFrame: number | null = null;
    const restoreFrame = window.requestAnimationFrame(() => {
      if (text.lastReadParagraphIndex === null) {
        window.scrollTo({ top: 0, behavior: "auto" });
      } else {
        const paragraph = paragraphElementsRef.current.get(
          text.lastReadParagraphIndex,
        );
        if (paragraph) {
          paragraph.scrollIntoView({ block: "start", behavior: "auto" });
        } else {
          window.scrollTo({ top: 0, behavior: "auto" });
        }
      }

      releaseFrame = window.requestAnimationFrame(() => {
        isProgrammaticScrollRef.current = false;
        setIsScrollTopVisible(
          window.scrollY > SCROLL_TOP_BUTTON_THRESHOLD,
        );
      });
    });

    return () => {
      window.cancelAnimationFrame(restoreFrame);
      if (releaseFrame !== null) {
        window.cancelAnimationFrame(releaseFrame);
      }
      sync?.cancelScheduled();
    };
  }, [restoreKey]);

  useEffect(() => {
    if (!text || !isContentVisible) return;

    const updatePosition = () => {
      animationFrameRef.current = null;
      setIsScrollTopVisible(
        window.scrollY > SCROLL_TOP_BUTTON_THRESHOLD,
      );

      if (isProgrammaticScrollRef.current) {
        return;
      }

      const reachedIndex = getReachedReadingParagraphIndex(
        Array.from(paragraphElementsRef.current.entries()).map(
          ([index, element]) => ({
            index,
            top: element.getBoundingClientRect().top,
          }),
        ),
        POSITION_VIEWPORT_OFFSET,
      );

      if (reachedIndex !== null) {
        syncRef.current?.schedule(reachedIndex);
      }
    };

    const requestPositionUpdate = () => {
      if (animationFrameRef.current !== null) {
        return;
      }
      animationFrameRef.current = window.requestAnimationFrame(updatePosition);
    };

    window.addEventListener("scroll", requestPositionUpdate, {
      passive: true,
    });
    window.addEventListener("resize", requestPositionUpdate);
    requestPositionUpdate();

    return () => {
      window.removeEventListener("scroll", requestPositionUpdate);
      window.removeEventListener("resize", requestPositionUpdate);
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [isContentVisible, text?.id]);

  useEffect(
    () => () => {
      syncRef.current?.dispose();
    },
    [],
  );

  const retryPositionSave = useCallback(() => {
    setPositionError(null);
    syncRef.current?.retryFailed();
  }, []);

  const scrollToPageTop = useCallback(() => {
    isProgrammaticScrollRef.current = true;
    setIsScrollTopVisible(false);
    setPositionError(null);
    syncRef.current?.reset();
    window.scrollTo({ top: 0, behavior: "auto" });

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        isProgrammaticScrollRef.current = false;
      });
    });
  }, []);

  return {
    registerParagraph,
    isScrollTopVisible,
    positionError,
    retryPositionSave,
    scrollToPageTop,
  };
};
