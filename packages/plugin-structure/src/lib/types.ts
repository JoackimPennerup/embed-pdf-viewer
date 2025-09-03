import { Rect } from '@embedpdf/models';

export interface StructElement {
  tag: string;
  htmlTag: string;
  text: string;
  rect: Rect;
  attributes?: Record<string, string>;
}

export interface StructurePluginConfig {
  debug?: boolean;
}

export interface StructureCapability {
  getStructElements: (pageIndex: number) => Promise<StructElement[]>;
}

export interface StructureState {}

export type StructureAction = { type: 'structure/noop' };
