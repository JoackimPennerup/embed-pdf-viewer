import type { OperationOptions, PageRef } from '@embedpdf/core';

/** Page content coordinates: crop-relative, y-down, unscaled PDF points. */
export interface A11yRect {
  origin: { x: number; y: number };
  size: { width: number; height: number };
}

export interface StructElementFont {
  family?: string;
  size?: number;
  weight?: number;
  italic?: boolean;
}

export interface StructElementTextRun {
  text: string;
  rect: A11yRect;
  font?: StructElementFont;
  mcid?: number;
  rotation?: number;
}

/** Indices into sibling `textRuns`/`children`, in the PDF structure `/K` order. */
export type A11yContentItem =
  { kind: 'text'; runIndex: number } | { kind: 'child'; childIndex: number };

export interface StructElement {
  tag: string;
  text: string;
  rect: A11yRect;
  children: StructElement[];
  textRuns: StructElementTextRun[];
  content?: A11yContentItem[];
  mcids: number[];
  altText?: string;
  actualText?: string;
  language?: string;
  attributes?: Record<string, string>;
  font?: StructElementFont;
}

export interface A11yHtmlTextRun {
  text: string;
  rect: A11yRect;
  left: number;
  top: number;
  width: number;
  fontHeight: number;
  dir: 'ltr' | 'rtl' | 'auto';
  markedContentId?: string;
  font?: StructElementFont;
  rotation?: number;
}

export type A11yHtmlTextLine = A11yHtmlTextRun;

export interface A11yHtmlNode {
  markedContentId?: string;
  tag: string;
  semanticRole?: string;
  headingLevel?: number;
  text: string;
  altText?: string;
  actualText?: string;
  rect: A11yRect;
  language?: string;
  attributes: Record<string, string>;
  textLines: A11yHtmlTextLine[];
  textRuns: A11yHtmlTextRun[];
  /** Render this sequence instead of the legacy runs-then-children layout when present. */
  content?: A11yContentItem[];
  children: A11yHtmlNode[];
  presentation?: boolean;
}

export interface A11yPageData {
  page: PageRef;
  mode: 'tagged' | 'fallback' | 'text-only' | 'empty';
  elements: A11yHtmlNode[];
}

export interface A11yConfig {
  debug?: boolean;
  mergeGapTolerance?: number;
  lineTolerance?: number;
}

export interface A11yCapability {
  /** True when page text may be read (`doc.text.copy`). */
  canRead(): boolean;
  /** Tagged structure and untagged spatial fallback additionally need `doc.text.select`. */
  canReadStructure(): boolean;
  /** The source tagged tree in page content coordinates; [] for an untagged page.
   * Requires both `doc.text.copy` and `doc.text.select`. */
  getStructElements(page: PageRef, options?: OperationOptions): Promise<StructElement[]>;
  /** Tagged reading order, geometry/text fallback, or plain text without select access. */
  getPageData(page: PageRef, options?: OperationOptions): Promise<A11yPageData>;
  getClassNames(): string;
  getDebugState(): boolean;
}

export { A11yToken } from './token';
