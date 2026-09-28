import {
  EngineError,
  EngineErrorCode,
  sliceTextByChars,
  type PageAccessibilitySnapshot,
  type PageObjectNumber,
  type PageStructureContent,
  type PageStructureElement,
  type PageStructureFont,
  type PageStructureTextRun,
  type PageTextSnapshot,
  type PdfRect,
} from '@embedpdf/engine-core/runtime';
import { NULL_PTR, type PdfRuntimeModule, type Ptr } from '@embedpdf/engine-runtime';

import type { DocumentSession } from '../../document-session/DocumentSession';
import { readUtf16String } from '../../runtime/memory/strings';
import { readF32, readRectF, RECTF_BYTES } from '../../runtime/memory/structs';
import { throwIfAborted } from '../../shared/abort';
import { PageTextReader } from '../text/PageTextReader';

const EMPTY_RECT: PdfRect = { left: 0, bottom: 0, right: 0, top: 0 };
const FPDF_PAGEOBJ_TEXT = 1;

function unionRects(rects: PdfRect[]): PdfRect {
  if (!rects.length) return { ...EMPTY_RECT };
  return {
    left: Math.min(...rects.map((rect) => rect.left)),
    bottom: Math.min(...rects.map((rect) => rect.bottom)),
    right: Math.max(...rects.map((rect) => rect.right)),
    top: Math.max(...rects.map((rect) => rect.top)),
  };
}

export class PageAccessibilityReader {
  constructor(
    private readonly runtime: PdfRuntimeModule,
    private readonly session: DocumentSession,
  ) {}

  read(pageObjectNumber: PageObjectNumber, signal: AbortSignal): PageAccessibilitySnapshot {
    throwIfAborted(signal);
    const { fn } = this.runtime;
    // Generated signatures alone do not prove that a deployed PDFium binary
    // exports the functions. Refuse to report an empty/untagged page when the
    // runtime simply lacks structure extraction.
    const required = [
      'FPDF_StructTree_GetForPage',
      'FPDF_StructTree_Close',
      'FPDF_StructTree_CountChildren',
      'FPDF_StructTree_GetChildAtIndex',
      'FPDF_StructElement_GetType',
      'FPDF_StructElement_GetActualText',
      'FPDF_StructElement_GetAltText',
      'FPDF_StructElement_GetTitle',
      'FPDF_StructElement_GetLang',
      'FPDF_StructElement_GetMarkedContentIdCount',
      'FPDF_StructElement_GetMarkedContentIdAtIndex',
      'FPDF_StructElement_GetMarkedContentID',
      'FPDF_StructElement_CountChildren',
      'FPDF_StructElement_GetChildAtIndex',
      'FPDF_StructElement_GetChildMarkedContentID',
      'FPDFText_GetTextObject',
      'FPDFPageObj_GetMarkedContentID',
      'FPDFPage_CountObjects',
      'FPDFPage_GetObject',
      'FPDFPageObj_GetType',
      'FPDFText_GetLooseCharBox',
      'FPDFText_GetMatrix',
      'FPDFText_GetFontSize',
      'FPDFText_GetFontWeight',
      'FPDFTextObj_GetFont',
      'FPDFFont_GetFamilyName',
      'FPDFFont_GetFlags',
    ] as const;
    for (const name of required) {
      if (typeof fn[name] !== 'function') {
        throw new EngineError(EngineErrorCode.RuntimeUnavailable, `PDFium does not export ${name}`);
      }
    }
    const pool = this.session.pagePool();
    const pagePtr = pool.acquire(pageObjectNumber);
    try {
      const treePtr = fn.FPDF_StructTree_GetForPage(pagePtr);
      if (!treePtr) return { elements: [] };
      try {
        const textPagePtr = fn.FPDFText_LoadPage(pagePtr);
        if (!textPagePtr) {
          throw new EngineError(
            EngineErrorCode.RuntimeUnavailable,
            `FPDFText_LoadPage returned null for page object ${pageObjectNumber}`,
          );
        }
        try {
          // Use the shared UTF-16 extraction and char map rather than PDFium's
          // UCS-2 GetText, which drops supplementary-plane characters.
          const pageText = new PageTextReader(this.runtime, this.session).read(
            pageObjectNumber,
            signal,
          );
          const counts = new Map<number, number>();
          const count = fn.FPDF_StructTree_CountChildren(treePtr);
          for (let i = 0; i < count; i++) {
            const child = fn.FPDF_StructTree_GetChildAtIndex(treePtr, i);
            if (child) this.countMcidReferences(child, counts, signal, 0);
          }
          const ambiguous = new Set(
            [...counts].filter(([, references]) => references > 1).map(([mcid]) => mcid),
          );
          const pageObjects = new Set<Ptr>();
          for (let i = 0; i < fn.FPDFPage_CountObjects(pagePtr); i++) {
            const object = fn.FPDFPage_GetObject(pagePtr, i);
            if (object && fn.FPDFPageObj_GetType(object) === FPDF_PAGEOBJ_TEXT) {
              pageObjects.add(object);
            }
          }
          const runsByMcid = this.readRuns(textPagePtr, pageText, pageObjects, ambiguous, signal);
          const elements: PageStructureElement[] = [];
          for (let i = 0; i < count; i++) {
            throwIfAborted(signal);
            const child = fn.FPDF_StructTree_GetChildAtIndex(treePtr, i);
            if (child) elements.push(this.readElement(child, runsByMcid, signal, 0));
          }
          return { elements };
        } finally {
          fn.FPDFText_ClosePage(textPagePtr);
        }
      } finally {
        fn.FPDF_StructTree_Close(treePtr);
      }
    } finally {
      pool.release(pageObjectNumber);
    }
  }

  private readRuns(
    textPagePtr: Ptr,
    pageText: PageTextSnapshot,
    pageObjects: Set<Ptr>,
    ambiguous: Set<number>,
    signal: AbortSignal,
  ): Map<number, PageStructureTextRun[]> {
    const { fn, mem } = this.runtime;
    const byMcid = new Map<number, PageStructureTextRun[]>();
    const rectPtr = mem.alloc(RECTF_BYTES);
    const matrixPtr = mem.alloc(24); // FS_MATRIX: six float32 values.
    let current: {
      mcid: number;
      object: Ptr;
      font: PageStructureFont;
      rotation?: number;
      start: number;
      rects: PdfRect[];
    } | null = null;
    const flush = (end: number) => {
      if (!current) return;
      const text = sliceTextByChars(pageText, current.start, end);
      if (!text) return;
      const run: PageStructureTextRun = {
        text,
        rect: unionRects(current.rects),
        mcid: current.mcid,
        font: current.font,
        ...(current.rotation !== undefined ? { rotation: current.rotation } : {}),
      };
      const runs = byMcid.get(current.mcid) ?? [];
      runs.push(run);
      byMcid.set(current.mcid, runs);
    };
    try {
      for (let i = 0; i < pageText.charCount; i++) {
        throwIfAborted(signal);
        const object = fn.FPDFText_GetTextObject(textPagePtr, i);
        // MCIDs are local to a content stream. PDFium's text-object accessor
        // has no stream ID; only match objects known to belong to the PAGE
        // stream. In particular, never match a Form XObject's own MCID to a
        // page /K entry with the same integer.
        const mcid =
          object && pageObjects.has(object) ? fn.FPDFPageObj_GetMarkedContentID(object) : -1;
        if (mcid < 0 || ambiguous.has(mcid)) {
          flush(i);
          current = null;
          continue;
        }
        const size = fn.FPDFText_GetFontSize(textPagePtr, i);
        const rotation = fn.FPDFText_GetMatrix(textPagePtr, i, matrixPtr)
          ? (Math.atan2(readF32(mem, matrixPtr, 4), readF32(mem, matrixPtr)) * 180) / Math.PI
          : undefined;
        if (
          !current ||
          current.object !== object ||
          current.mcid !== mcid ||
          current.font.size !== size ||
          current.rotation !== rotation
        ) {
          flush(i);
          current = {
            mcid,
            object,
            rotation,
            start: i,
            rects: [],
            font: {
              size,
              weight: fn.FPDFText_GetFontWeight(textPagePtr, i),
            },
          };
          const font = fn.FPDFTextObj_GetFont(object);
          if (font) {
            const nameLength = fn.FPDFFont_GetFamilyName(font, NULL_PTR, 0);
            if (nameLength > 1) {
              const namePtr = mem.alloc(nameLength);
              try {
                fn.FPDFFont_GetFamilyName(font, namePtr, nameLength);
                current.font.family = mem.readU8String(namePtr);
              } finally {
                mem.free(namePtr);
              }
            }
            current.font.italic = Boolean(fn.FPDFFont_GetFlags(font) & (1 << 6));
          }
        }
        if (fn.FPDFText_GetLooseCharBox(textPagePtr, i, rectPtr)) {
          const rect = readRectF(mem, rectPtr);
          if (Number.isFinite(rect.left + rect.right + rect.top + rect.bottom)) {
            current.rects.push({
              left: Math.min(rect.left, rect.right),
              bottom: Math.min(rect.bottom, rect.top),
              right: Math.max(rect.left, rect.right),
              top: Math.max(rect.bottom, rect.top),
            });
          }
        }
      }
      flush(pageText.charCount);
    } finally {
      mem.free(rectPtr);
      mem.free(matrixPtr);
    }
    return byMcid;
  }

  private countMcidReferences(
    ptr: Ptr,
    counts: Map<number, number>,
    signal: AbortSignal,
    depth: number,
  ): void {
    throwIfAborted(signal);
    if (depth >= 128) return;
    const { fn } = this.runtime;
    const childCount = fn.FPDF_StructElement_CountChildren(ptr);
    if (childCount > 0) {
      for (let i = 0; i < childCount; i++) {
        const child = fn.FPDF_StructElement_GetChildAtIndex(ptr, i);
        if (child) {
          this.countMcidReferences(child, counts, signal, depth + 1);
        } else {
          const mcid = fn.FPDF_StructElement_GetChildMarkedContentID(ptr, i);
          if (mcid >= 0) counts.set(mcid, (counts.get(mcid) ?? 0) + 1);
        }
      }
    } else {
      const count = fn.FPDF_StructElement_GetMarkedContentIdCount(ptr);
      if (count > 0) {
        for (let i = 0; i < count; i++) {
          const mcid = fn.FPDF_StructElement_GetMarkedContentIdAtIndex(ptr, i);
          if (mcid >= 0) counts.set(mcid, (counts.get(mcid) ?? 0) + 1);
        }
      } else {
        const mcid = fn.FPDF_StructElement_GetMarkedContentID(ptr);
        if (mcid >= 0) counts.set(mcid, (counts.get(mcid) ?? 0) + 1);
      }
    }
  }

  private readElement(
    ptr: Ptr,
    runsByMcid: Map<number, PageStructureTextRun[]>,
    signal: AbortSignal,
    depth: number,
  ): PageStructureElement {
    throwIfAborted(signal);
    const { fn, mem } = this.runtime;
    const read = (get: (buffer: Ptr, capacity: number) => number) =>
      readUtf16String(mem, get) ?? '';
    const tag = read((buf, len) => fn.FPDF_StructElement_GetType(ptr, buf, len)) || 'Span';
    const actualText = read((buf, len) => fn.FPDF_StructElement_GetActualText(ptr, buf, len));
    const altText = read((buf, len) => fn.FPDF_StructElement_GetAltText(ptr, buf, len));
    const title = read((buf, len) => fn.FPDF_StructElement_GetTitle(ptr, buf, len));
    const lang = read((buf, len) => fn.FPDF_StructElement_GetLang(ptr, buf, len));
    const mcids: number[] = [];
    const children: PageStructureElement[] = [];
    const textRuns: PageStructureTextRun[] = [];
    const content: PageStructureContent[] = [];
    const appendMcid = (mcid: number) => {
      if (mcid < 0 || mcids.includes(mcid)) return;
      mcids.push(mcid);
      for (const run of runsByMcid.get(mcid) ?? []) {
        content.push({ kind: 'text', runIndex: textRuns.length });
        textRuns.push(run);
      }
    };
    if (depth < 128) {
      const childCount = fn.FPDF_StructElement_CountChildren(ptr);
      for (let i = 0; i < childCount; i++) {
        throwIfAborted(signal);
        const child = fn.FPDF_StructElement_GetChildAtIndex(ptr, i);
        if (child) {
          content.push({ kind: 'child', childIndex: children.length });
          children.push(this.readElement(child, runsByMcid, signal, depth + 1));
        } else {
          appendMcid(fn.FPDF_StructElement_GetChildMarkedContentID(ptr, i));
        }
      }
      // PDFium represents a bare integer /K as an element MCID on some
      // versions, without a child slot. Use its indexed getter only then.
      if (childCount <= 0) {
        const count = fn.FPDF_StructElement_GetMarkedContentIdCount(ptr);
        if (count > 0) {
          for (let i = 0; i < count; i++) {
            appendMcid(fn.FPDF_StructElement_GetMarkedContentIdAtIndex(ptr, i));
          }
        } else {
          appendMcid(fn.FPDF_StructElement_GetMarkedContentID(ptr));
        }
      }
    }
    const orderedText = content
      .map((item) =>
        item.kind === 'text' ? textRuns[item.runIndex]!.text : children[item.childIndex]!.text,
      )
      .join('');
    const text = actualText.trim() || altText.trim() || orderedText.trim() || title.trim();
    const rect = unionRects([
      ...textRuns
        .map((run) => run.rect)
        .filter((box) => box.right > box.left || box.top > box.bottom),
      ...children
        .map((child) => child.rect)
        .filter((box) => box.right > box.left || box.top > box.bottom),
    ]);
    return {
      tag,
      text,
      rect,
      children,
      mcids,
      textRuns,
      content,
      ...(textRuns[0]?.font ? { font: textRuns[0].font } : {}),
      ...(lang ? { lang } : {}),
      ...(actualText ? { actualText } : {}),
      ...(altText ? { altText } : {}),
      ...(title ? { title } : {}),
    };
  }
}
