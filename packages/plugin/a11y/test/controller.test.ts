import { describe, expect, it, vi } from 'vitest';
import { toPageRef, type ControllerContext } from '@embedpdf/core';
import { AbortablePromise } from '@embedpdf/engine-core/runtime';
import { createA11yController } from '../src/controller';

const page = toPageRef(9);
const crop = { left: 20, bottom: 40, right: 220, top: 340 };
const pdfRect = { left: 30, bottom: 230, right: 80, top: 250 };

function setup(elements: unknown[], select = true, accessibility = true) {
  const structure = vi.fn(() => AbortablePromise.resolveValue({ elements }));
  const text = vi.fn(() => AbortablePromise.resolveValue({ text: 'Content', charCount: 7 }));
  const geometry = vi.fn(() =>
    AbortablePromise.resolveValue({
      runs: [
        {
          charStart: 0,
          rect: pdfRect,
          glyphs: Array.from({ length: 7 }, () => ({ looseBox: pdfRect, flags: 0 })),
        },
      ],
    }),
  );
  const handle = {
    ...(accessibility ? { accessibility: { read: structure } } : {}),
    text: { read: text },
    geometry: { read: geometry },
  };
  const ctx = {
    assertPageRef: vi.fn(),
    getPage: () => ({ boxes: { crop } }),
    doc: {
      security: { allows: (scope: string) => scope !== 'doc.text.select' || select },
      page: () => handle,
    },
  } as unknown as ControllerContext<null, { type: 'noop' }>;
  return { api: createA11yController(ctx, {}), structure, text, geometry };
}

describe('a11y engine boundary', () => {
  it('reads nested tags without flattening the reading order or fetching fallback text', async () => {
    const { api, text, geometry } = setup([
      {
        tag: 'Document',
        text: '',
        rect: pdfRect,
        mcids: [],
        textRuns: [],
        children: [
          {
            tag: 'H1',
            text: 'Second',
            rect: pdfRect,
            mcids: [4],
            children: [],
            textRuns: [{ text: 'Second', mcid: 4, rect: pdfRect, font: { size: 12 } }],
          },
        ],
      },
    ]);
    const result = await api.getPageData(page);
    expect(result.mode).toBe('tagged');
    expect(result.elements[0].tag).toBe('H1');
    expect(result.elements[0].textRuns[0]).toMatchObject({
      left: 10,
      top: 90,
      width: 50,
      fontHeight: 20,
    });
    expect(text).not.toHaveBeenCalled();
    expect(geometry).not.toHaveBeenCalled();
  });

  it('projects engine /K indices onto individual content-space runs and children', async () => {
    const child = {
      tag: 'Span',
      text: 'child',
      rect: pdfRect,
      mcids: [7],
      children: [],
      textRuns: [{ text: 'child', mcid: 7, rect: pdfRect }],
    };
    const { api } = setup([
      {
        tag: 'P',
        text: 'prechildpost',
        rect: pdfRect,
        mcids: [4, 5],
        children: [child],
        textRuns: [
          { text: 'pre', mcid: 4, rect: pdfRect },
          { text: 'post', mcid: 5, rect: pdfRect, rotation: 90 },
        ],
        content: [
          { kind: 'text', runIndex: 0 },
          { kind: 'child', childIndex: 0 },
          { kind: 'text', runIndex: 1 },
        ],
      },
    ]);
    const result = await api.getPageData(page);
    expect(result.elements[0].content).toEqual([
      { kind: 'text', runIndex: 0 },
      { kind: 'child', childIndex: 0 },
      { kind: 'text', runIndex: 1 },
    ]);
    expect(result.elements[0].textRuns.map((run) => run.text)).toEqual(['pre', 'post']);
    expect(result.elements[0].textRuns.map((run) => run.rotation)).toEqual([0, -90]);
    expect(result.elements[0].children[0].text).toBe('child');
    expect(result.elements[0].textLines).toEqual([]);
  });

  it('falls back to the character map when untagged and handles engines without tagged service', async () => {
    const { api, text, geometry } = setup([], true, false);
    const result = await api.getPageData(page);
    expect(result.mode).toBe('fallback');
    expect(result.elements[0].text).toBe('Content');
    expect(text).toHaveBeenCalledOnce();
    expect(geometry).toHaveBeenCalledOnce();
  });

  it('returns text-only reading order without geometry when select is denied', async () => {
    const { api, geometry, text, structure } = setup([], false);
    expect(api.canRead()).toBe(true);
    expect(api.canReadStructure()).toBe(false);
    const result = await api.getPageData(page);
    expect(result.mode).toBe('text-only');
    expect(result.elements[0].text).toBe('Content');
    expect(text).toHaveBeenCalledOnce();
    expect(geometry).not.toHaveBeenCalled();
    expect(structure).not.toHaveBeenCalled();
    await expect(api.getStructElements(page)).rejects.toMatchObject({ code: 'permission-denied' });
    expect(structure).not.toHaveBeenCalled();
  });
});
