import { RefObject, useEffect } from "react";

type ScrollIntoViewOptions = {
  topOffset?: number;
  bottomOffset?: number;
};

export const useScrollIntoViewOnExpand = (
  isExpanded: boolean,
  targetRef: RefObject<HTMLElement | null>,
  { topOffset = 16, bottomOffset = 120 }: ScrollIntoViewOptions = {},
) => {
  useEffect(() => {
    if (!isExpanded || !targetRef.current) {
      return;
    }

    const target = targetRef.current;
    const frame = window.requestAnimationFrame(() => {
      const rect = target.getBoundingClientRect();
      const visibleBottom = window.innerHeight - bottomOffset;

      if (rect.top < topOffset || rect.bottom > visibleBottom) {
        const nextTop = window.scrollY + rect.top - topOffset;
        window.scrollTo({
          top: Math.max(0, nextTop),
          behavior: "smooth",
        });
      }
    });

    return () => window.cancelAnimationFrame(frame);
  }, [bottomOffset, isExpanded, targetRef, topOffset]);
};
