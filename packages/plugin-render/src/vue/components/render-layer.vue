<script setup lang="ts">
import { ref, onBeforeUnmount, computed, watchEffect } from 'vue';
import { ignore, PdfErrorCode } from '@embedpdf/models';

import { useRenderCapability, useRenderPlugin } from '../hooks';

interface Props {
  pageIndex: number;
  /**
   * The scale factor for rendering the page.
   */
  scale?: number;
  /**
   * @deprecated Use `scale` instead. Will be removed in the next major release.
   */
  scaleFactor?: number;
  dpr?: number;
}

const props = defineProps<Props>();

// Handle deprecation: prefer scale over scaleFactor, but fall back to scaleFactor if scale is not provided
const actualScale = computed(() => props.scale ?? props.scaleFactor ?? 1);
const actualDpr = computed(() => props.dpr ?? window.devicePixelRatio);

const { provides: renderProvides } = useRenderCapability();
const { plugin: renderPlugin } = useRenderPlugin();

const imageUrl = ref<string | null>(null);
const refreshTick = ref(0);

let urlRef: string | null = null;
let hasLoaded = false;

// Listen for external page refresh events
watchEffect((onCleanup) => {
  if (!renderPlugin.value) return;

  const unsubscribe = renderPlugin.value.onRefreshPages((pages: number[]) => {
    if (pages.includes(props.pageIndex)) {
      refreshTick.value++;
    }
  });

  onCleanup(unsubscribe);
});

// Render page when dependencies change
watchEffect((onCleanup) => {
  // Capture reactive dependencies
  const pageIndex = props.pageIndex;
  const scale = actualScale.value;
  const dpr = actualDpr.value;
  const tick = refreshTick.value;
  const capability = renderProvides.value;

  if (!capability) return;

  // Revoke old URL before creating new one (if it's been loaded)
  if (urlRef && hasLoaded) {
    URL.revokeObjectURL(urlRef);
    urlRef = null;
    hasLoaded = false;
  }

  const task = capability.renderPage({
    pageIndex,
    options: {
      scaleFactor: scale,
      dpr,
    },
  });

  task.wait((blob) => {
    const objectUrl = URL.createObjectURL(blob);
    urlRef = objectUrl;
    imageUrl.value = objectUrl;
    hasLoaded = false;
  }, ignore);

  onCleanup(() => {
    if (urlRef) {
      // Only revoke if image has loaded
      if (hasLoaded) {
        URL.revokeObjectURL(urlRef);
        urlRef = null;
        hasLoaded = false;
      }
    } else {
      // Task still in progress, abort it
      task.abort({
        code: PdfErrorCode.Cancelled,
        message: 'canceled render task',
      });
    }
  });
});

onBeforeUnmount(() => {
  if (urlRef) {
    URL.revokeObjectURL(urlRef);
    urlRef = null;
  }
});

function handleImageLoad() {
  hasLoaded = true;
}
</script>

<template>
  <img
    v-if="imageUrl"
    :src="imageUrl"
    :style="{ width: '100%', height: '100%' }"
    @load="handleImageLoad"
  />
</template>
