export { 
  default as LazyLoader,
  withLazyLoading,
  useLazyLoading,
  IntersectionLazyLoader,
  LazyImage,
  LazyModule,
  usePreloader
} from './LazyLoader';

export { 
  default as VirtualList,
  useVirtualization,
  VirtualGrid,
  InfiniteList
} from './VirtualList';

export { 
  default as ErrorBoundaryWithRetry,
  useOptimisticUpdates,
  OptimisticIndicator,
  useRetryableAction
} from './OptimisticUpdates';

export type { 
  OptimisticAction,
  OptimisticState
} from './OptimisticUpdates';