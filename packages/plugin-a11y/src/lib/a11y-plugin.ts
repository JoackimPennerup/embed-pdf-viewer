import { BasePlugin, PluginRegistry } from '@embedpdf/core';

import {
  A11yCapability,
  A11yPluginConfig,
  StructElement,
  StructElementFont,
  StructElementGlyph,
  StructElementTextRun,
} from './types';
import { mapPdfTagToHtml } from './utils';

export class A11yPlugin extends BasePlugin<A11yPluginConfig, A11yCapability> {
  static readonly id = 'a11y' as const;

  private config: A11yPluginConfig = { debug: false };

  constructor(id: string, registry: PluginRegistry) {
    super(id, registry);
  }

  async initialize(config: A11yPluginConfig): Promise<void> {
    this.config = { ...this.config, ...config };
  }

  protected buildCapability(): A11yCapability {
    return {
      getStructElements: this.getStructElements.bind(this),
    };
  }

  private async getStructElements(pageIndex: number): Promise<StructElement[]> {
    const coreState = this.coreState.core;
    if (!coreState.document) {
      throw new Error('document does not open');
    }
    const page = coreState.document.pages.find((p) => p.index === pageIndex);
    if (!page) {
      throw new Error('page does not exist');
    }
    const engine: any = this.engine as any;
    if (typeof engine.getStructTree !== 'function') {
      return [];
    }
    const raw: any[] = await engine.getStructTree(coreState.document, page).toPromise();

    const cloneRect = (rect: any) => ({
      origin: {
        x: rect?.origin?.x ?? 0,
        y: rect?.origin?.y ?? 0,
      },
      size: {
        width: rect?.size?.width ?? 0,
        height: rect?.size?.height ?? 0,
      },
    });

    const mapFont = (font: any): StructElementFont | undefined => {
      if (!font) return undefined;
      const mapped: StructElementFont = {};
      if (typeof font.family === 'string' && font.family.length) {
        mapped.family = font.family;
      }
      if (typeof font.size === 'number' && !Number.isNaN(font.size)) {
        mapped.size = font.size;
      }
      return Object.keys(mapped).length ? mapped : undefined;
    };

    const mapElement = (el: any): StructElement => {
      const textRuns: StructElementTextRun[] = Array.isArray(el.textRuns)
        ? el.textRuns.map((run: any) => ({
            text: typeof run?.text === 'string' ? run.text : '',
            rect: cloneRect(run?.rect),
            font: mapFont(run?.font),
          }))
        : [];

      const glyphs: StructElementGlyph[] | undefined = Array.isArray(el.glyphs)
        ? el.glyphs.map((glyph: any) => ({
            char: typeof glyph?.char === 'string' ? glyph.char : '',
            rect: cloneRect(glyph?.rect),
            font: mapFont(glyph?.font),
          }))
        : undefined;

      return {
        tag: el.tag,
        htmlTag: mapPdfTagToHtml(el.tag),
        text: typeof el.text === 'string' ? el.text : '',
        rect: cloneRect(el.rect),
        language: el.lang,
        attributes: el.attributes || {},
        font: mapFont(el.font),
        textRuns,
        ...(glyphs ? { glyphs } : {}),
        mcids: Array.isArray(el.mcids) ? el.mcids : [],
        children: Array.isArray(el.children) ? el.children.map(mapElement) : [],
      };
    };
    return raw.map(mapElement);
  }
}
