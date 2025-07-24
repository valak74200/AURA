import { useState, useEffect } from 'react';

export interface UseSkeletonOptions {
  delay?: number;
  minDuration?: number;
}

export const useSkeleton = (
  isLoading: boolean,
  options: UseSkeletonOptions = {}
) => {
  const { delay = 0, minDuration = 500 } = options;
  const [showSkeleton, setShowSkeleton] = useState(false);
  const [startTime, setStartTime] = useState<number | null>(null);

  useEffect(() => {
    let timeoutId: number;

    if (isLoading) {
      // Démarrer le skeleton après le délai
      timeoutId = setTimeout(() => {
        setShowSkeleton(true);
        setStartTime(Date.now());
      }, delay);
    } else if (showSkeleton && startTime) {
      // S'assurer que le skeleton est affiché pendant la durée minimale
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, minDuration - elapsed);
      
      timeoutId = setTimeout(() => {
        setShowSkeleton(false);
        setStartTime(null);
      }, remaining);
    } else {
      setShowSkeleton(false);
      setStartTime(null);
    }

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [isLoading, delay, minDuration, showSkeleton, startTime]);

  return showSkeleton;
};

export const useSkeletonWithData = <T>(
  data: T | null | undefined,
  options: UseSkeletonOptions = {}
) => {
  const isLoading = data === null || data === undefined;
  return useSkeleton(isLoading, options);
};

export const useSkeletonList = <T>(
  items: T[] | null | undefined,
  options: UseSkeletonOptions = {}
) => {
  const isLoading = !items || items.length === 0;
  return useSkeleton(isLoading, options);
};