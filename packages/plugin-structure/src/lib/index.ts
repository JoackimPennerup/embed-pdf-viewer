import { PluginPackage } from '@embedpdf/core';

import { manifest, STRUCTURE_PLUGIN_ID } from './manifest';
import { initialState, structureReducer } from './reducer';
import { StructurePlugin } from './structure-plugin';
import { StructureAction, StructurePluginConfig, StructureState } from './types';

export const StructurePluginPackage: PluginPackage<
  StructurePlugin,
  StructurePluginConfig,
  StructureState,
  StructureAction
> = {
  manifest,
  create: (registry) => new StructurePlugin(STRUCTURE_PLUGIN_ID, registry),
  reducer: structureReducer,
  initialState,
};

export * from './structure-plugin';
export * from './types';
export * from './manifest';
