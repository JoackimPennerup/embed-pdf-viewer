<template>
  <div
    ref="rootRef"
    v-bind="{ ...attrs, ...(rootAttrs as any) }"
    :style="{ containerType: 'inline-size' }"
  >
    <slot />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, useAttrs, provide } from 'vue';
import { UI_ATTRIBUTES } from '@embedpdf/plugin-ui';
import {
  createStyleSheetOwner,
  getStyleSheetRegistry,
  type StyleSheetLease,
} from '@embedpdf/utils';
import { useUIPlugin, useUICapability } from './hooks/use-ui';
import { UI_CONTAINER_KEY, type UIContainerContextValue } from './hooks/use-ui-container';

// Disable automatic attribute inheritance since we handle it manually
defineOptions({
  inheritAttrs: false,
});

const attrs = useAttrs();

const { plugin } = useUIPlugin();
const { provides } = useUICapability();

const disabledCategories = ref<string[]>([]);
const hiddenItems = ref<string[]>([]);
const rootRef = ref<HTMLDivElement | null>(null);

// Provide container context for child components
const containerContext: UIContainerContextValue = {
  containerRef: rootRef,
  getContainer: () => rootRef.value,
};
provide(UI_CONTAINER_KEY, containerContext);

const styleOwner = createStyleSheetOwner('@embedpdf/plugin-ui/vue');
let styleLease: StyleSheetLease | null = null;
let stylesheetCleanup: (() => void) | null = null;

/**
 * Find the style injection target for an element.
 * Returns the shadow root if inside one, otherwise document.head.
 */
function getStyleRoot(element: HTMLElement): Document | ShadowRoot {
  const root = element.getRootNode();
  if (root.nodeType === 11 && 'host' in root) {
    return root as ShadowRoot;
  }
  return element.ownerDocument;
}

function setupStyles() {
  stylesheetCleanup?.();
  stylesheetCleanup = null;
  styleLease?.dispose();
  styleLease = null;

  if (!rootRef.value || !plugin.value) {
    return;
  }

  const currentPlugin = plugin.value;
  styleLease = getStyleSheetRegistry(getStyleRoot(rootRef.value)).register({
    owner: styleOwner,
    slot: 'generated-ui',
    order: 100,
    css: currentPlugin.getStylesheet(),
  });
  stylesheetCleanup = currentPlugin.onStylesheetInvalidated(() => {
    styleLease?.update(currentPlugin.getStylesheet());
  });
}

// Build root element attributes
const rootAttrs = computed(() => {
  const result: Record<string, string> = {
    [UI_ATTRIBUTES.ROOT]: '',
  };

  if (disabledCategories.value.length > 0) {
    result[UI_ATTRIBUTES.DISABLED_CATEGORIES] = disabledCategories.value.join(' ');
  }

  if (hiddenItems.value.length > 0) {
    result[UI_ATTRIBUTES.HIDDEN_ITEMS] = hiddenItems.value.join(' ');
  }

  return result;
});

// Category change cleanup
let categoryCleanup: (() => void) | null = null;

onMounted(() => {
  setupStyles();

  // Subscribe to category changes
  if (provides.value) {
    disabledCategories.value = provides.value.getDisabledCategories();
    hiddenItems.value = provides.value.getHiddenItems();

    categoryCleanup = provides.value.onCategoryChanged((event) => {
      disabledCategories.value = event.disabledCategories;
      hiddenItems.value = event.hiddenItems;
    });
  }
});

onUnmounted(() => {
  stylesheetCleanup?.();
  styleLease?.dispose();
  categoryCleanup?.();
});

watch(plugin, setupStyles);
</script>
