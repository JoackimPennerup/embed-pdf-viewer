import { useCapability, usePlugin } from '@embedpdf/core/vue';
import { A11yPlugin } from '@embedpdf/plugin-a11y';

export const useA11yCapability = () => useCapability<A11yPlugin>(A11yPlugin.id);
export const useA11yPlugin = () => usePlugin<A11yPlugin>(A11yPlugin.id);
