import type { PdfRect } from '../geometry/primitives';

export interface PageStructureFont {
  family?: string;
  size?: number;
  weight?: number;
  italic?: boolean;
}

/** Geometry is PDF user space (y-up), including the original page-box origin. */
export interface PageStructureTextRun {
  text: string;
  rect: PdfRect;
  font?: PageStructureFont;
  mcid: number;
  /** Baseline rotation in PDF y-up, counterclockwise degrees. */
  rotation?: number;
}

/** Index into this element's textRuns or children, in PDF /K reading order. */
export type PageStructureContent =
  { kind: 'text'; runIndex: number } | { kind: 'child'; childIndex: number };

export interface PageStructureElement {
  tag: string;
  text: string;
  rect: PdfRect;
  children: PageStructureElement[];
  mcids: number[];
  textRuns: PageStructureTextRun[];
  /** Ordered /K content; absent only when the runtime cannot expose ordering. */
  content?: PageStructureContent[];
  lang?: string;
  actualText?: string;
  altText?: string;
  title?: string;
  font?: PageStructureFont;
}

/** An untagged page has no structure tree and returns `elements: []`. */
export interface PageAccessibilitySnapshot {
  elements: PageStructureElement[];
}
