import { PluginManifest } from '@embedpdf/core';

import { MeasurementPluginConfig } from './types';

export const MEASUREMENT_PLUGIN_ID = 'measurement' as const;

export const manifest: PluginManifest<MeasurementPluginConfig> = {
  id: MEASUREMENT_PLUGIN_ID,
  name: 'Measurement Plugin',
  version: '1.0.0',
  provides: ['measurement'],
  requires: ['annotation'],
  optional: [],
  defaultConfig: {
    enabled: true,
    unit: 'in',
    precision: 2,
    pointsPerUnit: 72,
  },
};
