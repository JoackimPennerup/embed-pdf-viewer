import { PluginManifest } from '@embedpdf/core';

import { A11yPluginConfig } from './types';

export const A11Y_PLUGIN_ID = 'a11y';

export const manifest: PluginManifest<A11yPluginConfig> = {
  id: A11Y_PLUGIN_ID,
  name: 'A11y Plugin',
  version: '1.0.0',
  provides: ['structure'],
  requires: [],
  optional: [],
  defaultConfig: {
    debug: false,
  },
};
