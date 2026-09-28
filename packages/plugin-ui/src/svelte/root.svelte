<script lang="ts">
  import { UI_ATTRIBUTES } from '@embedpdf/plugin-ui';
  import { createStyleSheetOwner, getStyleSheetRegistry } from '@embedpdf/utils';
  import { useUIPlugin, useUICapability } from './hooks/use-ui.svelte';
  import { setUIContainerContext } from './hooks/use-ui-container.svelte';
  import type { Snippet } from 'svelte';
  import type { HTMLAttributes } from 'svelte/elements';

  type Props = HTMLAttributes<HTMLDivElement> & {
    children?: Snippet;
  };

  let { children, class: className, ...restProps }: Props = $props();

  const { plugin } = useUIPlugin();
  const { provides } = useUICapability();

  let disabledCategories = $state<string[]>([]);
  let hiddenItems = $state<string[]>([]);
  let rootElement: HTMLDivElement | null = $state(null);
  const styleOwner = createStyleSheetOwner('@embedpdf/plugin-ui/svelte');

  // Provide container context for child components
  setUIContainerContext({
    getContainer: () => rootElement,
  });

  function getStyleRoot(element: HTMLElement): Document | ShadowRoot {
    const root = element.getRootNode();
    if (root.nodeType === 11 && 'host' in root) {
      return root as ShadowRoot;
    }
    return element.ownerDocument;
  }

  $effect(() => {
    if (!rootElement || !plugin) {
      return;
    }

    const currentPlugin = plugin;
    const lease = getStyleSheetRegistry(getStyleRoot(rootElement)).register({
      owner: styleOwner,
      slot: 'generated-ui',
      order: 100,
      css: currentPlugin.getStylesheet(),
    });
    const unsubscribe = currentPlugin.onStylesheetInvalidated(() => {
      lease.update(currentPlugin.getStylesheet());
    });

    return () => {
      unsubscribe();
      lease.dispose();
    };
  });

  $effect(() => {
    if (!provides) return;

    disabledCategories = provides.getDisabledCategories();
    hiddenItems = provides.getHiddenItems();

    return provides.onCategoryChanged((event) => {
      disabledCategories = event.disabledCategories;
      hiddenItems = event.hiddenItems;
    });
  });

  const disabledCategoriesAttr = $derived(
    disabledCategories.length > 0 ? disabledCategories.join(' ') : undefined,
  );

  const hiddenItemsAttr = $derived(hiddenItems.length > 0 ? hiddenItems.join(' ') : undefined);
</script>

<div
  bind:this={rootElement}
  {...restProps}
  {...{ [UI_ATTRIBUTES.ROOT]: '' }}
  {...disabledCategoriesAttr ? { [UI_ATTRIBUTES.DISABLED_CATEGORIES]: disabledCategoriesAttr } : {}}
  {...hiddenItemsAttr ? { [UI_ATTRIBUTES.HIDDEN_ITEMS]: hiddenItemsAttr } : {}}
  class={className}
  style:container-type="inline-size"
>
  {#if children}
    {@render children()}
  {/if}
</div>
