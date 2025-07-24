import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../utils/cn';
import { useMotion } from '../../contexts/EnhancedThemeContext';

interface VirtualListProps<T> {
  items: T[];
  itemHeight: number;
  containerHeight: number;
  renderItem: (item: T, index: number, isVisible: boolean) => React.ReactNode;
  className?: string;
  overscan?: number;
  onScroll?: (scrollTop: number) => void;
  estimatedItemHeight?: number;
  variableHeight?: boolean;
  getItemHeight?: (index: number) => number;
}

function VirtualList<T>({
  items,
  itemHeight,
  containerHeight,
  renderItem,
  className,
  overscan = 5,
  onScroll,
  estimatedItemHeight,
  variableHeight = false,
  getItemHeight
}: VirtualListProps<T>) {
  const [scrollTop, setScrollTop] = useState(0);
  const scrollElementRef = useRef<HTMLDivElement>(null);
  const { shouldAnimate } = useMotion();

  // Calculer les éléments visibles
  const visibleRange = useMemo(() => {
    if (variableHeight && getItemHeight) {
      // Pour les hauteurs variables, calculer les positions
      let totalHeight = 0;
      const itemPositions: number[] = [];
      
      for (let i = 0; i < items.length; i++) {
        itemPositions[i] = totalHeight;
        totalHeight += getItemHeight(i);
      }

      const startIndex = itemPositions.findIndex(pos => pos + getItemHeight(itemPositions.indexOf(pos)) > scrollTop);
      const endIndex = itemPositions.findIndex(pos => pos > scrollTop + containerHeight);
      
      return {
        start: Math.max(0, startIndex - overscan),
        end: Math.min(items.length - 1, (endIndex === -1 ? items.length - 1 : endIndex) + overscan),
        totalHeight,
        itemPositions
      };
    } else {
      // Pour les hauteurs fixes
      const startIndex = Math.floor(scrollTop / itemHeight);
      const endIndex = Math.min(
        items.length - 1,
        Math.ceil((scrollTop + containerHeight) / itemHeight)
      );

      return {
        start: Math.max(0, startIndex - overscan),
        end: Math.min(items.length - 1, endIndex + overscan),
        totalHeight: items.length * itemHeight,
        itemPositions: null
      };
    }
  }, [scrollTop, containerHeight, itemHeight, items.length, overscan, variableHeight, getItemHeight]);

  const visibleItems = useMemo(() => {
    return items.slice(visibleRange.start, visibleRange.end + 1).map((item, index) => ({
      item,
      index: visibleRange.start + index,
      originalIndex: visibleRange.start + index
    }));
  }, [items, visibleRange.start, visibleRange.end]);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const newScrollTop = e.currentTarget.scrollTop;
    setScrollTop(newScrollTop);
    onScroll?.(newScrollTop);
  }, [onScroll]);

  const getItemTop = useCallback((index: number) => {
    if (variableHeight && visibleRange.itemPositions) {
      return visibleRange.itemPositions[index] || 0;
    }
    return index * itemHeight;
  }, [variableHeight, visibleRange.itemPositions, itemHeight]);

  const getItemHeightForIndex = useCallback((index: number) => {
    if (variableHeight && getItemHeight) {
      return getItemHeight(index);
    }
    return itemHeight;
  }, [variableHeight, getItemHeight, itemHeight]);

  return (
    <div
      ref={scrollElementRef}
      className={cn('overflow-auto', className)}
      style={{ height: containerHeight }}
      onScroll={handleScroll}
    >
      <div style={{ height: visibleRange.totalHeight, position: 'relative' }}>
        {visibleItems.map(({ item, index, originalIndex }) => (
          <motion.div
            key={originalIndex}
            initial={shouldAnimate ? { opacity: 0, y: 10 } : {}}
            animate={shouldAnimate ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.2, delay: (index - visibleRange.start) * 0.02 }}
            style={{
              position: 'absolute',
              top: getItemTop(originalIndex),
              left: 0,
              right: 0,
              height: getItemHeightForIndex(originalIndex)
            }}
          >
            {renderItem(item, originalIndex, true)}
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// Hook pour la virtualisation avec intersection observer
export const useVirtualization = <T,>(
  items: T[],
  containerRef: React.RefObject<HTMLElement>,
  itemHeight: number,
  overscan: number = 5
) => {
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 0 });
  const [scrollTop, setScrollTop] = useState(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const scrollTop = container.scrollTop;
      const containerHeight = container.clientHeight;
      
      const startIndex = Math.floor(scrollTop / itemHeight);
      const endIndex = Math.min(
        items.length - 1,
        Math.ceil((scrollTop + containerHeight) / itemHeight)
      );

      setVisibleRange({
        start: Math.max(0, startIndex - overscan),
        end: Math.min(items.length - 1, endIndex + overscan)
      });
      
      setScrollTop(scrollTop);
    };

    container.addEventListener('scroll', handleScroll);
    handleScroll(); // Initial calculation

    return () => container.removeEventListener('scroll', handleScroll);
  }, [items.length, itemHeight, overscan, containerRef]);

  const visibleItems = useMemo(() => {
    return items.slice(visibleRange.start, visibleRange.end + 1);
  }, [items, visibleRange.start, visibleRange.end]);

  const totalHeight = items.length * itemHeight;
  const offsetY = visibleRange.start * itemHeight;

  return {
    visibleItems,
    visibleRange,
    totalHeight,
    offsetY,
    scrollTop
  };
};

// Composant de grille virtualisée
export const VirtualGrid: React.FC<{
  items: any[];
  itemWidth: number;
  itemHeight: number;
  containerWidth: number;
  containerHeight: number;
  renderItem: (item: any, index: number) => React.ReactNode;
  gap?: number;
  className?: string;
}> = ({
  items,
  itemWidth,
  itemHeight,
  containerWidth,
  containerHeight,
  renderItem,
  gap = 0,
  className
}) => {
  const [scrollTop, setScrollTop] = useState(0);
  const { shouldAnimate } = useMotion();

  const columnsCount = Math.floor((containerWidth + gap) / (itemWidth + gap));
  const rowsCount = Math.ceil(items.length / columnsCount);
  const totalHeight = rowsCount * (itemHeight + gap) - gap;

  const visibleRowStart = Math.floor(scrollTop / (itemHeight + gap));
  const visibleRowEnd = Math.min(
    rowsCount - 1,
    Math.ceil((scrollTop + containerHeight) / (itemHeight + gap))
  );

  const visibleItems = useMemo(() => {
    const result = [];
    for (let row = visibleRowStart; row <= visibleRowEnd; row++) {
      for (let col = 0; col < columnsCount; col++) {
        const index = row * columnsCount + col;
        if (index < items.length) {
          result.push({
            item: items[index],
            index,
            row,
            col,
            x: col * (itemWidth + gap),
            y: row * (itemHeight + gap)
          });
        }
      }
    }
    return result;
  }, [items, visibleRowStart, visibleRowEnd, columnsCount, itemWidth, itemHeight, gap]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  };

  return (
    <div
      className={cn('overflow-auto', className)}
      style={{ height: containerHeight }}
      onScroll={handleScroll}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        {visibleItems.map(({ item, index, x, y }) => (
          <motion.div
            key={index}
            initial={shouldAnimate ? { opacity: 0, scale: 0.8 } : {}}
            animate={shouldAnimate ? { opacity: 1, scale: 1 } : {}}
            transition={{ duration: 0.2 }}
            style={{
              position: 'absolute',
              left: x,
              top: y,
              width: itemWidth,
              height: itemHeight
            }}
          >
            {renderItem(item, index)}
          </motion.div>
        ))}
      </div>
    </div>
  );
};

// Composant pour les listes infinies
export const InfiniteList: React.FC<{
  items: any[];
  loadMore: () => Promise<void>;
  hasMore: boolean;
  isLoading: boolean;
  itemHeight: number;
  containerHeight: number;
  renderItem: (item: any, index: number) => React.ReactNode;
  loadingComponent?: React.ReactNode;
  threshold?: number;
  className?: string;
}> = ({
  items,
  loadMore,
  hasMore,
  isLoading,
  itemHeight,
  containerHeight,
  renderItem,
  loadingComponent,
  threshold = 200,
  className
}) => {
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleScroll = useCallback(async (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    setScrollTop(scrollTop);

    // Charger plus d'éléments quand on approche du bas
    if (
      hasMore &&
      !isLoading &&
      scrollHeight - scrollTop - clientHeight < threshold
    ) {
      await loadMore();
    }
  }, [hasMore, isLoading, loadMore, threshold]);

  return (
    <div className={className}>
      <VirtualList
        items={items}
        itemHeight={itemHeight}
        containerHeight={containerHeight}
        renderItem={renderItem}
        onScroll={setScrollTop}
      />
      
      {/* Loading indicator */}
      {isLoading && (
        <div className="flex justify-center py-4">
          {loadingComponent || (
            <div className="flex items-center gap-2 text-slate-400">
              <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              Chargement...
            </div>
          )}
        </div>
      )}
      
      {/* End indicator */}
      {!hasMore && items.length > 0 && (
        <div className="text-center py-4 text-slate-400 text-sm">
          Tous les éléments ont été chargés
        </div>
      )}
    </div>
  );
};

export default VirtualList;