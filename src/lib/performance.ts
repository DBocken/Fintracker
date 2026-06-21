/**
 * Performance optimization utilities
 */

// ============================================
// Debounce
// ============================================

/**
 * Debounce function execution
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout | null = null;

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeoutId = null;
      func(...args);
    };

    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(later, wait);
  };
}

// ============================================
// Throttle
// ============================================

/**
 * Throttle function execution
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  
  return function executedFunction(...args: Parameters<T>) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

// ============================================
// Request Animation Frame
// ============================================

/**
 * Debounce using requestAnimationFrame
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function rafDebounce<T extends (...args: any[]) => any>(
  func: T
): (...args: Parameters<T>) => void {
  let rafId: number | null = null;

  return function executedFunction(...args: Parameters<T>) {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
    }
    rafId = requestAnimationFrame(() => {
      func(...args);
      rafId = null;
    });
  };
}

// ============================================
// Batch Updates
// ============================================

/**
 * Batch multiple updates into a single render cycle
 */
export function batchUpdates(updates: Array<() => void>): void {
  // React 18+ automatically batches updates
  updates.forEach(update => update());
}

// ============================================
// Memoization
// ============================================

/**
 * Simple memoization with size limit
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function memoize<T extends (...args: any[]) => any>(
  func: T,
  maxSize: number = 100
): T {
  const cache = new Map<string, ReturnType<T>>();

  return ((...args: Parameters<T>) => {
    const key = JSON.stringify(args);
    
    if (cache.has(key)) {
      return cache.get(key);
    }
    
    const result = func(...args);
    cache.set(key, result);
    
    // Remove oldest entries if cache is too large
    if (cache.size > maxSize) {
      const firstKey = cache.keys().next().value;
      if (firstKey) {
        cache.delete(firstKey);
      }
    }
    
    return result;
  }) as T;
}

// ============================================
// Virtual Scroll Helpers
// ============================================

export interface VirtualScrollState {
  scrollTop: number;
  viewportHeight: number;
  itemHeight: number;
  totalItems: number;
  overscan?: number;
}

export interface VisibleRange {
  startIndex: number;
  endIndex: number;
  offsetY: number;
}

export const VIRTUAL_SCROLL_ITEM_HEIGHT = 60; // pixels
export const VIRTUAL_SCROLL_OVERSCAN = 5; // items to render outside viewport

/**
 * Calculate visible range for virtual scrolling
 */
export function calculateVisibleRange({
  scrollTop,
  viewportHeight,
  itemHeight,
  totalItems,
  overscan = VIRTUAL_SCROLL_OVERSCAN,
}: VirtualScrollState): VisibleRange {
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const endIndex = Math.min(
    totalItems - 1,
    Math.ceil((scrollTop + viewportHeight) / itemHeight) + overscan
  );
  
  return {
    startIndex,
    endIndex,
    offsetY: startIndex * itemHeight,
  };
}

/**
 * Get total height for virtual scroll container
 */
export function getTotalHeight(itemHeight: number, totalItems: number): number {
  return itemHeight * totalItems;
}

// ============================================
// Performance Monitoring
// ============================================

export interface PerformanceMetric {
  name: string;
  duration: number;
  timestamp: number;
}

class PerformanceMonitorClass {
  private metrics: PerformanceMetric[] = [];
  private maxMetrics: number = 100;

  start(_name: string): number {
    return performance.now();
  }

  end(name: string, startTime: number): void {
    const duration = performance.now() - startTime;
    const metric: PerformanceMetric = {
      name,
      duration,
      timestamp: Date.now(),
    };

    this.metrics.push(metric);

    // Keep only recent metrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics.shift();
    }

    // Warn if slow
    if (duration > 100) {
      console.warn(`[Performance] Slow operation: ${name} took ${duration.toFixed(2)}ms`);
    }
  }

  getMetrics(): PerformanceMetric[] {
    return [...this.metrics];
  }

  getAverageDuration(name: string): number {
    const relevant = this.metrics.filter(m => m.name === name);
    if (relevant.length === 0) return 0;
    
    const sum = relevant.reduce((acc, m) => acc + m.duration, 0);
    return sum / relevant.length;
  }

  clear(): void {
    this.metrics = [];
  }
}

export const performanceMonitor = new PerformanceMonitorClass();

// ============================================
// Utility Functions
// ============================================

/**
 * Measure function execution time
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function measurePerformance<T extends (...args: any[]) => any>(
  name: string,
  func: T
): T {
  return ((...args: Parameters<T>) => {
    const start = performanceMonitor.start(name);
    try {
      const result = func(...args);
      
      // Handle promises
      if (result instanceof Promise) {
        return result.finally(() => {
          performanceMonitor.end(name, start);
        });
      }
      
      performanceMonitor.end(name, start);
      return result;
    } catch (error) {
      performanceMonitor.end(name, start);
      throw error;
    }
  }) as T;
}

/**
 * Format duration in human-readable format
 */
export function formatDuration(ms: number): string {
  if (ms < 1) return `${(ms * 1000).toFixed(2)}μs`;
  if (ms < 1000) return `${ms.toFixed(2)}ms`;
  
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(2)}s`;
  
  const minutes = seconds / 60;
  if (minutes < 60) return `${minutes.toFixed(2)}m`;
  
  const hours = minutes / 60;
  return `${hours.toFixed(2)}h`;
}

/**
 * Check if performance API is available
 */
export function isPerformanceAPIAvailable(): boolean {
  return typeof performance !== 'undefined' && 
         typeof performance.now === 'function';
}

/**
 * Get memory usage (if available)
 */
export function getMemoryUsage(): {
  usedJSHeapSize?: number;
  totalJSHeapSize?: number;
  jsHeapSizeLimit?: number;
} | null {
  const perfWithMemory = performance as Performance & { memory?: { usedJSHeapSize: number; totalJSHeapSize: number; jsHeapSizeLimit: number } };
  if (typeof perfWithMemory.memory === 'undefined') {
    return null;
  }

  const memory = perfWithMemory.memory;
  return {
    usedJSHeapSize: memory.usedJSHeapSize,
    totalJSHeapSize: memory.totalJSHeapSize,
    jsHeapSizeLimit: memory.jsHeapSizeLimit,
  };
}
