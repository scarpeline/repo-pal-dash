import { useState, useCallback, useRef, useEffect } from "react";

interface SwipeState {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  isSwiping: boolean;
}

interface SwipeResult {
  direction: "left" | "right" | "up" | "down" | null;
  distance: number;
  isSwipe: boolean;
}

export function useSwipe(
  onSwipeLeft?: () => void,
  onSwipeRight?: () => void,
  onSwipeUp?: () => void,
  onSwipeDown?: () => void,
  threshold: number = 50
) {
  const [swipeState, setSwipeState] = useState<SwipeState | null>(null);
  const elementRef = useRef<HTMLElement | null>(null);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    const touch = e.touches[0];
    setSwipeState({
      startX: touch.clientX,
      startY: touch.clientY,
      endX: touch.clientX,
      endY: touch.clientY,
      isSwiping: true,
    });
  }, []);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!swipeState?.isSwiping) return;
    const touch = e.touches[0];
    setSwipeState(prev => prev ? {
      ...prev,
      endX: touch.clientX,
      endY: touch.clientY,
    } : null);
  }, [swipeState?.isSwiping]);

  const handleTouchEnd = useCallback(() => {
    if (!swipeState) return;

    const deltaX = swipeState.endX - swipeState.startX;
    const deltaY = swipeState.endY - swipeState.startY;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    // Determinar direção
    if (absX > absY && absX > threshold) {
      // Swipe horizontal
      if (deltaX > 0) {
        onSwipeRight?.();
      } else {
        onSwipeLeft?.();
      }
    } else if (absY > absX && absY > threshold) {
      // Swipe vertical
      if (deltaY > 0) {
        onSwipeDown?.();
      } else {
        onSwipeUp?.();
      }
    }

    setSwipeState(null);
  }, [swipeState, onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown, threshold]);

  const ref = useCallback((node: HTMLElement | null) => {
    if (elementRef.current) {
      elementRef.current.removeEventListener("touchstart", handleTouchStart);
      elementRef.current.removeEventListener("touchmove", handleTouchMove);
      elementRef.current.removeEventListener("touchend", handleTouchEnd);
    }

    elementRef.current = node;

    if (node) {
      node.addEventListener("touchstart", handleTouchStart, { passive: true });
      node.addEventListener("touchmove", handleTouchMove, { passive: true });
      node.addEventListener("touchend", handleTouchEnd, { passive: true });
    }
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  return { ref, swipeState };
}
