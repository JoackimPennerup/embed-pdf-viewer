import { describe, expect, it } from 'vitest';
import type {
  PageGeometrySnapshot,
  PageTextSnapshot,
  PdfRect,
} from '@embedpdf/engine-core/runtime';
import type { StructElement } from '../src/contract';
import {
  buildFallbackNodes,
  buildHtmlNodesFromStructElements,
  mergeStructTextRuns,
  rectToContent,
} from '../src/model';
import { semanticHtmlForNode } from '../src/semantics';
import { buildFontFamilyStack, collectFontClasses } from '../src/styles';

const crop: PdfRect = { left: 20, bottom: 40, right: 220, top: 340 };
const rect = { origin: { x: 0, y: 0 }, size: { width: 40, height: 10 } };
const element = (tag: string, text: string, children: StructElement[] = []): StructElement => ({
  tag,
  text,
  children,
  rect,
  mcids: [],
  textRuns: text ? [{ text, rect, font: { family: 'ABCDEF+OpenSans', size: 10 } }] : [],
});

describe('accessibility model', () => {
  it('maps PDF coordinates with the crop origin retained', () => {
    expect(rectToContent({ left: 30, bottom: 230, right: 80, top: 250 }, crop)).toEqual({
      origin: { x: 10, y: 90 },
      size: { width: 50, height: 20 },
    });
  });

  it('preserves tagged child order and unwraps Document', () => {
    const nodes = buildHtmlNodesFromStructElements([
      element('Document', '', [
        element('H2', 'Second', [element('Span', 'inline')]),
        element('P', 'First'),
      ]),
    ]);
    expect(nodes.map((node) => node.text)).toEqual(['Second', 'First']);
    expect(nodes.map((node) => node.markedContentId)).toEqual(['mc-0', 'mc-1']);
    expect(semanticHtmlForNode(nodes[0])).toMatchObject({ tagName: 'h2' });
    expect(nodes[0].textLines[0].text).toBe('Second');
    expect(collectFontClasses(nodes).size).toBe(1);
  });

  it('maps figure alternative text and downgrades invalid block headings', () => {
    const [heading, figure] = buildHtmlNodesFromStructElements([
      element('H1', '', [element('P', 'paragraph')]),
      { ...element('Figure', ''), altText: 'Chart of revenue' },
    ]);
    expect(semanticHtmlForNode(heading)).toMatchObject({
      tagName: 'div',
      role: 'heading',
      ariaLevel: 1,
    });
    expect(semanticHtmlForNode(figure)).toMatchObject({
      tagName: 'figure',
      ariaLabel: 'Chart of revenue',
    });
    expect(buildFontFamilyStack('Open Sans Light')).toContain('"Open Sans"');
    expect(buildFontFamilyStack('Source Sans Pro Bold')).toContain('"Source Sans 3"');
    expect(buildFontFamilyStack('Palatino')).toContain('"Book Antiqua"');
    expect(buildFontFamilyStack('JetBrains Mono')).toContain('"Courier New"');
    expect(buildFontFamilyStack('Libre Baskerville Italic')).toContain('serif');
  });

  it('keeps explicit list roles when CSS removes native list markers', () => {
    const [list] = buildHtmlNodesFromStructElements([
      element('L', '', [element('LI', 'one'), element('LI', 'two')]),
    ]);
    expect(semanticHtmlForNode(list)).toMatchObject({ tagName: 'ul', role: 'list' });
    expect(list.children.map((child) => semanticHtmlForNode(child).role)).toEqual([
      'listitem',
      'listitem',
    ]);
  });

  it('uses character order, not x positions, for untagged text', () => {
    const text: PageTextSnapshot = { text: 'B\nA', charCount: 3 };
    const geometry: PageGeometrySnapshot = {
      runs: [
        {
          charStart: 2,
          rect: { left: 20, bottom: 100, right: 30, top: 110 },
          glyphs: [{ looseBox: { left: 20, bottom: 100, right: 30, top: 110 }, flags: 0 }],
        },
        {
          charStart: 0,
          rect: { left: 90, bottom: 200, right: 100, top: 210 },
          glyphs: [
            { looseBox: { left: 90, bottom: 200, right: 100, top: 210 }, flags: 0 },
            { looseBox: { left: 100, bottom: 200, right: 100, top: 210 }, flags: 1 },
          ],
        },
      ],
    };
    const nodes = buildFallbackNodes(text, geometry, crop);
    expect(nodes.map((node) => node.text)).toEqual(['B\n', 'A']);
    expect(nodes.map((node) => node.rect.origin.y)).toEqual([130, 230]);
  });

  it('does not invent word boundaries from gaps or separate text objects', () => {
    const merged = mergeStructTextRuns([
      { text: 'Hello', rect },
      { text: 'world', rect: { origin: { x: 40.5, y: 0 }, size: { width: 30, height: 10 } } },
    ]);
    expect(merged.map((run) => run.text)).toEqual(['Helloworld']);
    const [node] = buildHtmlNodesFromStructElements([
      {
        ...element('P', ''),
        textRuns: [
          { text: 'inter', rect },
          { text: 'national', rect: { origin: { x: 70, y: 0 }, size: { width: 40, height: 10 } } },
        ],
      },
    ]);
    expect(node.text).toBe('international');
    expect(node.textLines[0].text).toBe('international');
    expect(node.textRuns.map((run) => run.text).join('')).toBe('international');
    expect(
      mergeStructTextRuns([
        { text: 'Hello ', rect },
        { text: 'world', rect: { origin: { x: 40, y: 0 }, size: { width: 30, height: 10 } } },
      ])[0].text,
    ).toBe('Hello world');
  });

  it('inherits Document language while retaining descendant language overrides', () => {
    const nodes = buildHtmlNodesFromStructElements([
      {
        ...element('Document', '', [
          element('P', 'Hallo', [
            element('Span', 'aus'),
            { ...element('Span', 'Paris'), language: 'fr-FR' },
          ]),
        ]),
        language: 'de-DE',
      },
    ]);
    expect(nodes[0].language).toBe('de-DE');
    expect(nodes[0].children.map((child) => child.language)).toEqual(['de-DE', 'fr-FR']);
  });

  it('keeps parent text around a nested child in PDF /K order', () => {
    const [node] = buildHtmlNodesFromStructElements([
      {
        ...element('P', '', [element('Span', 'child')]),
        textRuns: [
          { text: 'pre', rect },
          { text: 'post', rect: { origin: { x: 70, y: 0 }, size: { width: 40, height: 10 } } },
        ],
        content: [
          { kind: 'text', runIndex: 0 },
          { kind: 'child', childIndex: 0 },
          { kind: 'text', runIndex: 1 },
        ],
      },
    ]);
    expect(node.content).toEqual([
      { kind: 'text', runIndex: 0 },
      { kind: 'child', childIndex: 0 },
      { kind: 'text', runIndex: 1 },
    ]);
    expect(node.text).toBe('prechildpost');
    expect(node.textRuns.map((run) => run.text)).toEqual(['pre', 'post']);
    expect(node.textLines).toEqual([]);
  });

  it('unwraps Document without dropping own text around its children', () => {
    const nodes = buildHtmlNodesFromStructElements([
      {
        ...element('Document', '', [element('P', 'middle')]),
        language: 'de',
        textRuns: [
          { text: 'vor ', rect },
          { text: ' nach', rect },
        ],
        content: [
          { kind: 'text', runIndex: 0 },
          { kind: 'child', childIndex: 0 },
          { kind: 'text', runIndex: 1 },
        ],
      },
    ]);
    expect(nodes.map((node) => node.text)).toEqual(['vor ', 'middle', ' nach']);
    expect(nodes.map((node) => node.language)).toEqual(['de', 'de', 'de']);
    expect(nodes.map((node) => node.textRuns[0].text)).toEqual(['vor ', 'middle', ' nach']);
  });

  it('keeps explicit whitespace across ordered parent and child boundaries', () => {
    const [node] = buildHtmlNodesFromStructElements([
      {
        ...element('P', '', [{ ...element('Span', ''), textRuns: [{ text: ' middle ', rect }] }]),
        textRuns: [
          { text: 'pre', rect },
          { text: 'post', rect },
        ],
        content: [
          { kind: 'text', runIndex: 0 },
          { kind: 'child', childIndex: 0 },
          { kind: 'text', runIndex: 1 },
        ],
      },
    ]);
    expect(node.text).toBe('pre middle post');
    expect(node.children[0].text).toBe(' middle ');
  });

  it('positions rotated text from an oriented frame rather than its axis-aligned bounds', () => {
    const vertical = { origin: { x: 10, y: 20 }, size: { width: 10, height: 100 } };
    const [up, down] = buildHtmlNodesFromStructElements([
      {
        ...element('P', ''),
        textRuns: [{ text: 'vertical', rect: vertical, rotation: -90, font: { size: 10 } }],
      },
      {
        ...element('P', ''),
        textRuns: [{ text: 'vertical', rect: vertical, rotation: 90, font: { size: 10 } }],
      },
    ]);
    expect(up.textRuns[0].left).toBeCloseTo(10);
    expect(up.textRuns[0].top).toBeCloseTo(120);
    expect(up.textRuns[0].width).toBeCloseTo(100);
    expect(up.textRuns[0].fontHeight).toBeCloseTo(10);
    expect(down.textRuns[0].left).toBeCloseTo(20);
    expect(down.textRuns[0].top).toBeCloseTo(20);
    expect(down.textRuns[0].width).toBeCloseTo(100);
    expect(down.textRuns[0].fontHeight).toBeCloseTo(10);

    const angle = Math.PI / 6;
    const diagonal = {
      origin: { x: 10, y: 20 },
      size: {
        width: 100 * Math.cos(angle) + 10 * Math.sin(angle),
        height: 100 * Math.sin(angle) + 10 * Math.cos(angle),
      },
    };
    const [slanted] = buildHtmlNodesFromStructElements([
      {
        ...element('P', ''),
        textRuns: [{ text: 'diagonal', rect: diagonal, rotation: 30, font: { size: 10 } }],
      },
    ]);
    expect(slanted.textRuns[0].left).toBeCloseTo(15);
    expect(slanted.textRuns[0].top).toBeCloseTo(20);
    expect(slanted.textRuns[0].width).toBeCloseTo(100);
    expect(slanted.textRuns[0].fontHeight).toBeCloseTo(10);
  });

  it('slices fallback runs through the engine character map', () => {
    const text: PageTextSnapshot = {
      text: 'A\uD83D\uDE00',
      charCount: 3,
      charMap: [
        [2, 1],
        [3, 3],
      ],
    };
    const box = { left: 20, bottom: 100, right: 30, top: 110 };
    const geometry: PageGeometrySnapshot = {
      runs: [
        {
          charStart: 0,
          rect: box,
          glyphs: [
            { looseBox: box, flags: 0 },
            { looseBox: box, flags: 2 },
          ],
        },
        {
          charStart: 2,
          rect: { ...box, bottom: 80, top: 90 },
          glyphs: [{ looseBox: box, flags: 0 }],
        },
      ],
    };
    expect(buildFallbackNodes(text, geometry, crop).map((node) => node.text)).toEqual([
      'A',
      '\uD83D\uDE00',
    ]);
  });
});
