// @vitest-environment happy-dom
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { A11yPageData } from '@embedpdf/plugin-a11y';

const mock = vi.hoisted(() => ({
  permission: true,
  page: {
    ref: { pageObjectNumber: 1 },
    transform: {
      contentWidth: 200,
      contentHeight: 300,
      toPixels: ({ x, y }: { x: number; y: number }) => ({ x: x * 2, y: y * 2 }),
    },
  },
  capability: {
    canRead: () => mock.permission,
    getPageData: vi.fn(),
    getClassNames: () => 'embedpdf-a11y-layer',
    getDebugState: () => false,
  },
}));

vi.mock('../src/runtime', () => ({
  usePage: () => mock.page,
  useCapability: () => mock.capability,
  useSelector: (_token: unknown, select: (capability: typeof mock.capability) => unknown) =>
    select(mock.capability),
}));

import { A11yLayer } from '../src/a11y';

afterEach(() => {
  cleanup();
  mock.capability.getPageData.mockReset();
  mock.permission = true;
});

describe('<A11yLayer>', () => {
  it('renders tagged text with semantic headings and without duplicate interactive links', async () => {
    const fragment = {
      text: 'Accessible heading',
      rect: { origin: { x: 10, y: 20 }, size: { width: 80, height: 12 } },
      left: 10,
      top: 20,
      width: 80,
      fontHeight: 12,
      dir: 'ltr' as const,
    };
    const page: A11yPageData = {
      page: { pageObjectNumber: 1 } as A11yPageData['page'],
      mode: 'tagged',
      elements: [
        {
          tag: 'H1',
          text: fragment.text,
          rect: fragment.rect,
          attributes: {},
          textLines: [fragment],
          textRuns: [],
          children: [
            {
              tag: 'Link',
              text: 'Link text',
              rect: fragment.rect,
              attributes: { href: 'https://example.com' },
              textLines: [],
              textRuns: [{ ...fragment, text: 'Link text' }],
              children: [],
            },
          ],
        },
      ],
    };
    mock.capability.getPageData.mockResolvedValue(page);

    const view = render(<A11yLayer />);
    expect(await screen.findByText('Accessible heading')).toBeTruthy();
    expect(view.container.querySelector('h1')).not.toBeNull();
    expect(view.container.querySelector('a[href]')).toBeNull();
    expect(view.container.querySelector('[data-mode="tagged"]')).not.toBeNull();
    const span = screen.getByText('Accessible heading') as HTMLElement;
    expect(span.style.left).toBe('20px');
    expect(span.style.top).toBe('40px');
    expect(span.style.color).toBe('transparent');

    mock.permission = false;
    view.rerender(<A11yLayer />);
    expect(view.container.querySelector('[data-mode]')).toBeNull();
  });

  it('preserves interleaved tagged text and child order', async () => {
    const rect = { origin: { x: 0, y: 0 }, size: { width: 20, height: 10 } };
    const run = (text: string) => ({
      text,
      rect,
      left: 0,
      top: 0,
      width: 20,
      fontHeight: 10,
      dir: 'ltr' as const,
    });
    mock.capability.getPageData.mockResolvedValue({
      page: { pageObjectNumber: 1 } as A11yPageData['page'],
      mode: 'tagged',
      elements: [
        {
          tag: 'P',
          text: 'beforemiddleafter',
          rect,
          attributes: {},
          textRuns: [run('before'), run('after')],
          textLines: [],
          content: [
            { kind: 'text', runIndex: 0 },
            { kind: 'child', childIndex: 0 },
            { kind: 'text', runIndex: 1 },
          ],
          children: [
            {
              tag: 'Span',
              text: 'middle',
              rect,
              attributes: {},
              textRuns: [run('middle')],
              textLines: [],
              children: [],
            },
          ],
        },
      ],
    } satisfies A11yPageData);

    const view = render(<A11yLayer />);
    expect(await screen.findByText('middle')).toBeTruthy();
    expect(view.container.querySelector('p')?.textContent).toBe('beforemiddleafter');
  });
});
