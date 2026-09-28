import { UI_ATTRIBUTES } from '@embedpdf/plugin-ui';
import {
  createStyleSheetOwner,
  getStyleSheetRegistry,
  type StyleSheetLease,
} from '@embedpdf/utils';
import {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
  ReactNode,
  HTMLAttributes,
} from '@framework';

import { useUICapability, useUIPlugin } from './hooks/use-ui';
import { UIContainerContext, UIContainerContextValue } from './hooks/use-ui-container';

function getStyleRoot(element: HTMLElement): Document | ShadowRoot {
  const root = element.getRootNode();
  if (root.nodeType === 11 && 'host' in root) {
    return root as ShadowRoot;
  }
  return element.ownerDocument;
}

interface UIRootProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

/**
 * Internal component that handles:
 * 1. Injecting the generated stylesheet (into shadow root or document.head)
 * 2. Managing the data-disabled-categories attribute
 * 3. Updating styles on locale changes
 */
export function UIRoot({ children, style, ...restProps }: UIRootProps) {
  const { plugin } = useUIPlugin();
  const { provides } = useUICapability();
  const [disabledCategories, setDisabledCategories] = useState<string[]>([]);
  const [hiddenItems, setHiddenItems] = useState<string[]>([]);
  const styleLeaseRef = useRef<StyleSheetLease | null>(null);
  const styleOwnerRef = useRef<string | null>(null);
  let styleOwner = styleOwnerRef.current;
  if (!styleOwner) {
    styleOwner = createStyleSheetOwner('@embedpdf/plugin-ui/react');
    styleOwnerRef.current = styleOwner;
  }
  const containerRef = useRef<HTMLDivElement>(null);

  // Create container context value (memoized to prevent unnecessary re-renders)
  const containerContextValue = useMemo<UIContainerContextValue>(
    () => ({
      containerRef,
      getContainer: () => containerRef.current,
    }),
    [],
  );

  const rootRefCallback = useCallback(
    (element: HTMLDivElement | null) => {
      (containerRef as any).current = element;
      styleLeaseRef.current?.dispose();
      styleLeaseRef.current = null;

      if (!element || !plugin) {
        return;
      }

      styleLeaseRef.current = getStyleSheetRegistry(getStyleRoot(element)).register({
        owner: styleOwner,
        slot: 'generated-ui',
        order: 100,
        css: plugin.getStylesheet(),
      });
    },
    [plugin, styleOwner],
  );

  // Subscribe to stylesheet invalidation (locale changes, schema merges)
  useEffect(() => {
    if (!plugin) return;

    return plugin.onStylesheetInvalidated(() => {
      styleLeaseRef.current?.update(plugin.getStylesheet());
    });
  }, [plugin]);

  // Subscribe to category and hidden items changes
  useEffect(() => {
    if (!provides) return;

    setDisabledCategories(provides.getDisabledCategories());
    setHiddenItems(provides.getHiddenItems());

    return provides.onCategoryChanged(({ disabledCategories, hiddenItems }) => {
      setDisabledCategories(disabledCategories);
      setHiddenItems(hiddenItems);
    });
  }, [provides]);

  // Build the disabled categories attribute value
  const disabledCategoriesAttr = useMemo(
    () => (disabledCategories.length > 0 ? disabledCategories.join(' ') : undefined),
    [disabledCategories],
  );

  // Build the hidden items attribute value
  const hiddenItemsAttr = useMemo(
    () => (hiddenItems.length > 0 ? hiddenItems.join(' ') : undefined),
    [hiddenItems],
  );

  const combinedStyle = useMemo(() => {
    const base = { containerType: 'inline-size' as const };
    if (style && typeof style === 'object') {
      return { ...base, ...style };
    }
    return base;
  }, [style]);

  const rootProps = {
    [UI_ATTRIBUTES.ROOT]: '',
    [UI_ATTRIBUTES.DISABLED_CATEGORIES]: disabledCategoriesAttr,
    [UI_ATTRIBUTES.HIDDEN_ITEMS]: hiddenItemsAttr,
  };

  return (
    <UIContainerContext.Provider value={containerContextValue}>
      <div ref={rootRefCallback} {...rootProps} {...restProps} style={combinedStyle}>
        {children}
      </div>
    </UIContainerContext.Provider>
  );
}
