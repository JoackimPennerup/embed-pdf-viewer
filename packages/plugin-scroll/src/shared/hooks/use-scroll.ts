import { useState, useEffect } from '@framework';
import { useCapability, usePlugin } from '@embedpdf/core/@framework';
import { ScrollCapability, ScrollPlugin } from '@embedpdf/plugin-scroll';

export const useScrollPlugin = () => usePlugin<ScrollPlugin>(ScrollPlugin.id);
export const useScrollCapability = () => useCapability<ScrollPlugin>(ScrollPlugin.id);

// Define the return type explicitly to maintain type safety
interface UseScrollReturn {
  provides: ScrollCapability | null;
  state: {
    currentPage: number;
    totalPages: number;
  };
  // Deprecated properties (for backward compatibility)
  readonly currentPage: number;
  readonly totalPages: number;
  readonly scrollToPage: ScrollCapability['scrollToPage'] | undefined;
  readonly scrollToNextPage: ScrollCapability['scrollToNextPage'] | undefined;
  readonly scrollToPreviousPage: ScrollCapability['scrollToPreviousPage'] | undefined;
  readonly getMetrics: ScrollCapability['getMetrics'] | undefined;
  readonly onPageChange: ScrollCapability['onPageChange'] | undefined;
  readonly onScroll: ScrollCapability['onScroll'] | undefined;
  readonly onLayoutChange: ScrollCapability['onLayoutChange'] | undefined;
  readonly getCurrentPage: ScrollCapability['getCurrentPage'] | undefined;
  readonly getTotalPages: ScrollCapability['getTotalPages'] | undefined;
}

export const useScroll = (): UseScrollReturn => {
  const { provides } = useScrollCapability();
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    if (!provides) return;
    return provides.onPageChange(({ pageNumber, totalPages }) => {
      setCurrentPage(pageNumber);
      setTotalPages(totalPages);
    });
  }, [provides]);

  return {
    // New format (preferred)
    provides,
    state: {
      currentPage,
      totalPages,
    },

    // Deprecated properties with getters that show warnings
    get currentPage() {
      console.warn(
        `Accessing 'currentPage' directly on useScroll() is deprecated. Use useScroll().state.currentPage instead.`,
      );
      return currentPage;
    },

    get totalPages() {
      console.warn(
        `Accessing 'totalPages' directly on useScroll() is deprecated. Use useScroll().state.totalPages instead.`,
      );
      return totalPages;
    },

    get scrollToPage() {
      if (provides?.scrollToPage) {
        console.warn(
          `Accessing 'scrollToPage' directly on useScroll() is deprecated. Use useScroll().provides.scrollToPage instead.`,
        );
      }
      return provides?.scrollToPage;
    },

    get scrollToNextPage() {
      if (provides?.scrollToNextPage) {
        console.warn(
          `Accessing 'scrollToNextPage' directly on useScroll() is deprecated. Use useScroll().provides.scrollToNextPage instead.`,
        );
      }
      return provides?.scrollToNextPage;
    },

    get scrollToPreviousPage() {
      if (provides?.scrollToPreviousPage) {
        console.warn(
          `Accessing 'scrollToPreviousPage' directly on useScroll() is deprecated. Use useScroll().provides.scrollToPreviousPage instead.`,
        );
      }
      return provides?.scrollToPreviousPage;
    },

    get getMetrics() {
      if (provides?.getMetrics) {
        console.warn(
          `Accessing 'getMetrics' directly on useScroll() is deprecated. Use useScroll().provides.getMetrics instead.`,
        );
      }
      return provides?.getMetrics;
    },

    get onPageChange() {
      if (provides?.onPageChange) {
        console.warn(
          `Accessing 'onPageChange' directly on useScroll() is deprecated. Use useScroll().provides.onPageChange instead.`,
        );
      }
      return provides?.onPageChange;
    },

    get onScroll() {
      if (provides?.onScroll) {
        console.warn(
          `Accessing 'onScroll' directly on useScroll() is deprecated. Use useScroll().provides.onScroll instead.`,
        );
      }
      return provides?.onScroll;
    },

    get onLayoutChange() {
      if (provides?.onLayoutChange) {
        console.warn(
          `Accessing 'onLayoutChange' directly on useScroll() is deprecated. Use useScroll().provides.onLayoutChange instead.`,
        );
      }
      return provides?.onLayoutChange;
    },

    get getCurrentPage() {
      if (provides?.getCurrentPage) {
        console.warn(
          `Accessing 'getCurrentPage' directly on useScroll() is deprecated. Use useScroll().provides.getCurrentPage instead.`,
        );
      }
      return provides?.getCurrentPage;
    },

    get getTotalPages() {
      if (provides?.getTotalPages) {
        console.warn(
          `Accessing 'getTotalPages' directly on useScroll() is deprecated. Use useScroll().provides.getTotalPages instead.`,
        );
      }
      return provides?.getTotalPages;
    },
  };
};
