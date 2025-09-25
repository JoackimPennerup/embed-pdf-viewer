import { Rect } from '@embedpdf/models';

export interface StructElement {
  tag: string;
  htmlTag: string;
  text: string;
  language?: string;
  rect: Rect;
  language?: string;
  attributes?: Record<string, string>;
  mcids: number[];
  children: StructElement[];
}

export interface A11yPluginConfig {
  debug?: boolean;
}

export interface A11yCapability {
  getStructElements: (pageIndex: number) => Promise<StructElement[]>;
}

export interface A11yState {}

export type A11yAction = { type: 'a11y/noop' };
