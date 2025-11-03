import { Rect, PdfTextMatrix } from '@embedpdf/models';

export interface StructElementFont {
  family?: string;
  size?: number;
  weight?: number;
  flags?: number;
  italic?: boolean;
}

export interface StructElementTextRun {
  text: string;
  rect: Rect;
  font?: StructElementFont;
  matrix?: PdfTextMatrix;
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
  mcids: number[];
  children: StructElement[];
}

export interface A11yPluginConfig {
  debug?: boolean;
}

export interface A11yCapability {
  getStructElements: (pageIndex: number) => Promise<StructElement[]>;
  getClassNames: () => string;
  getDebugState: () => boolean;
}

export interface A11yState {}

export type A11yAction = { type: 'a11y/noop' };
