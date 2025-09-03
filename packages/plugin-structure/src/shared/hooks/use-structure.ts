import { useCapability, usePlugin } from '@embedpdf/core/@framework';
import { StructurePlugin } from '@embedpdf/plugin-structure';

export const useStructureCapability = () => useCapability<StructurePlugin>(StructurePlugin.id);
export const useStructurePlugin = () => usePlugin<StructurePlugin>(StructurePlugin.id);
