import { PluginPackage } from '@embedpdf/core';

import { manifest, MEASUREMENT_PLUGIN_ID } from './manifest';
import { MeasurementPlugin } from './measurement-plugin';
import { MeasurementCapability, MeasurementPluginConfig } from './types';

export const MeasurementPluginPackage: PluginPackage<
  MeasurementPlugin,
  MeasurementPluginConfig,
  MeasurementCapability
> = {
  manifest,
  create: (registry, config) => new MeasurementPlugin(MEASUREMENT_PLUGIN_ID, registry, config),
};

export * from './measurement-plugin';
export * from './types';
export * from './manifest';
