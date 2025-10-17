import { ref, watchEffect, computed } from 'vue';
import { useCapability, usePlugin } from '@embedpdf/core/vue';
import { ScrollPlugin } from '@embedpdf/plugin-scroll';

export const useScrollPlugin = () => usePlugin<ScrollPlugin>(ScrollPlugin.id);
export const useScrollCapability = () => useCapability<ScrollPlugin>(ScrollPlugin.id);

export function useScroll() {
  const { provides } = useScrollCapability();

  const currentPage = ref(1);
  const totalPages = ref(1);

  watchEffect((onCleanup) => {
    if (!provides.value) return;

    const unsubscribe = provides.value.onPageChange(({ pageNumber, totalPages: tp }) => {
      currentPage.value = pageNumber;
      totalPages.value = tp;
    });
    onCleanup(unsubscribe);
  });

  // New format
  const state = computed(() => ({
    currentPage: currentPage.value,
    totalPages: totalPages.value,
  }));

  // Create deprecated properties with warnings
  const deprecatedCurrentPage = computed({
    get() {
      console.warn(
        `Accessing 'currentPage' directly on useScroll() is deprecated. Use useScroll().state.currentPage instead.`,
      );
      return currentPage.value;
    },
    set(value) {
      currentPage.value = value;
    },
  });

  const deprecatedTotalPages = computed({
    get() {
      console.warn(
        `Accessing 'totalPages' directly on useScroll() is deprecated. Use useScroll().state.totalPages instead.`,
      );
      return totalPages.value;
    },
    set(value) {
      totalPages.value = value;
    },
  });

  const deprecatedScroll = computed(() => {
    if (provides.value) {
      console.warn(
        `Accessing 'scroll' directly on useScroll() is deprecated. Use useScroll().provides instead.`,
      );
    }
    return provides.value;
  });

  return {
    // New format (preferred)
    provides,
    state,

    // Deprecated properties (for backward compatibility)
    currentPage: deprecatedCurrentPage,
    totalPages: deprecatedTotalPages,
    scroll: deprecatedScroll,
  };
}
