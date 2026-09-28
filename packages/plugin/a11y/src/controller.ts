import {
  PluginError,
  type ControllerContext,
  type OperationOptions,
  type PageRef,
} from '@embedpdf/core';
import type {
  PageStructureElement,
  PageStructureTextRun,
  PdfRect,
} from '@embedpdf/engine-core/runtime';

import type { A11yCapability, A11yConfig, StructElement, StructElementTextRun } from './contract';
import {
  buildFallbackNodes,
  buildHtmlNodesFromStructElements,
  buildTextOnlyNodes,
  rectToContent,
} from './model';

export const A11yLayerClassName = 'embedpdf-a11y-layer';

export function createA11yController(
  ctx: ControllerContext<null, { type: 'noop' }>,
  config: A11yConfig,
): A11yCapability {
  const canRead = () => ctx.doc.security.allows('doc.text.copy');
  const canReadStructure = () => canRead() && ctx.doc.security.allows('doc.text.select');

  const pageHandle = (page: PageRef) => {
    ctx.assertPageRef(page);
    const layout = ctx.getPage(page)!;
    return { layout, handle: ctx.doc.page(page) };
  };

  function checkRead(): void {
    if (!canRead()) {
      throw new PluginError(
        'permission-denied',
        'a11y',
        'Accessibility text requires doc.text.copy',
        {
          details: { required: 'doc.text.copy' },
        },
      );
    }
  }

  function checkStructureRead(): void {
    checkRead();
    if (!canReadStructure()) {
      throw new PluginError(
        'permission-denied',
        'a11y',
        'Tagged structure requires doc.text.select',
        { details: { required: 'doc.text.select' } },
      );
    }
  }

  async function read<T>(
    task: { then: Promise<T>['then']; abort(reason?: unknown): void },
    options?: OperationOptions,
  ): Promise<T> {
    const signal = options?.signal;
    if (signal?.aborted) task.abort(signal.reason);
    const abort = () => task.abort(signal?.reason);
    signal?.addEventListener('abort', abort, { once: true });
    try {
      return await task;
    } finally {
      signal?.removeEventListener('abort', abort);
    }
  }

  function mapElement(raw: PageStructureElement, crop: PdfRect): StructElement {
    const mapRun = (run: PageStructureTextRun): StructElementTextRun => ({
      text: run.text,
      rect: rectToContent(run.rect, crop),
      font: run.font,
      mcid: run.mcid,
      rotation: run.rotation === undefined ? undefined : -run.rotation,
    });
    return {
      tag: raw.tag || 'Span',
      text: raw.text,
      rect: rectToContent(raw.rect, crop),
      textRuns: raw.textRuns.map(mapRun),
      content: raw.content?.map((item) => ({ ...item })),
      children: raw.children.map((child) => mapElement(child, crop)),
      mcids: raw.mcids,
      altText: raw.altText,
      actualText: raw.actualText,
      language: raw.lang,
      font: raw.font,
    };
  }

  async function tagged(page: PageRef, options?: OperationOptions): Promise<StructElement[]> {
    checkStructureRead();
    const { layout, handle } = pageHandle(page);
    if (!handle.accessibility) return [];
    const { elements } = await read(handle.accessibility.read(), options);
    return elements.map((element) => mapElement(element, layout.boxes.crop));
  }

  return {
    canRead,
    canReadStructure,
    getStructElements: tagged,
    async getPageData(page, options) {
      checkRead();
      if (!canReadStructure()) {
        const { layout, handle } = pageHandle(page);
        const text = await read(handle.text.read(), options);
        const plain = buildTextOnlyNodes(
          text.text,
          layout.boxes.crop.right - layout.boxes.crop.left,
        );
        return { page, mode: plain.length ? 'text-only' : 'empty', elements: plain };
      }
      const elements = await tagged(page, options);
      if (elements.length) {
        return {
          page,
          mode: 'tagged',
          elements: buildHtmlNodesFromStructElements(elements, config),
        };
      }
      const { layout, handle } = pageHandle(page);
      // Untagged PDFs use the actual character map and its matching geometry.
      // Never substitute spatial sorting for PDFium's character/read order.
      const [text, geometry] = await Promise.all([
        read(handle.text.read(), options),
        read(handle.geometry.read(), options),
      ]);
      const fallback = buildFallbackNodes(text, geometry, layout.boxes.crop, config);
      return { page, mode: fallback.length ? 'fallback' : 'empty', elements: fallback };
    },
    getClassNames: () => (config.debug ? `${A11yLayerClassName} debug` : A11yLayerClassName),
    getDebugState: () => Boolean(config.debug),
  };
}
