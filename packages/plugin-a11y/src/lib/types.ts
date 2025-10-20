import { Rect } from '@embedpdf/models';

export interface StructElementFont {
  family?: string;
  size?: number;
}

export interface StructElementTextRun {
  text: string;
  rect: Rect;
  font?: StructElementFont;
}

export interface StructElementGlyph {
  char: string;
  rect: Rect;
  font?: StructElementFont;
}

export interface StructElement {
  tag: string;
  htmlTag: string;
  text: string;
  rect: Rect;
  language?: string;
  attributes?: Record<string, string>;
  font?: StructElementFont;
  textRuns: StructElementTextRun[];
  glyphs?: StructElementGlyph[];
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
