import { PluginManifest } from '@embedpdf/core';

import { StructurePluginConfig } from './types';

export const STRUCTURE_PLUGIN_ID = 'structure';

export const manifest: PluginManifest<StructurePluginConfig> = {
  id: STRUCTURE_PLUGIN_ID,
  name: 'Structure Plugin',
  version: '1.0.0',
  provides: ['structure'],
  requires: [],
  optional: [],
  defaultConfig: {
    debug: false,
  },
};
