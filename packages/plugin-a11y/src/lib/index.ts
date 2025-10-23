import { PluginPackage } from '@embedpdf/core';

import { A11yPlugin } from './a11y-plugin';
import { manifest, A11Y_PLUGIN_ID } from './manifest';
import { initialState, a11yReducer } from './reducer';
import { A11yAction, A11yPluginConfig, A11yState } from './types';

export const A11yPluginPackage: PluginPackage<A11yPlugin, A11yPluginConfig, A11yState, A11yAction> =
  {
    manifest,
    create: (registry) => new A11yPlugin(A11Y_PLUGIN_ID, registry),
    reducer: a11yReducer,
    initialState,
  };

export * from './a11y-plugin';
export * from './types';
export * from './manifest';
