import { BasePlugin, PluginRegistry } from '@embedpdf/core';

import {
  A11yCapability,
  A11yPluginConfig,
  StructElement,
  StructElementFont,
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
      getClassNames: this.getClassNames.bind(this),
    };
  }

  private getClassNames(): string {
    const classes = ['embedpdf-a11y-layer'];
    if (this.config.debug) {
      classes.push('embedpdf-a11y-debug');
    }
    return classes.join(' ');
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
      if (typeof font.weight === 'number' && !Number.isNaN(font.weight)) {
        mapped.weight = font.weight;
      }
      if (typeof font.flags === 'number' && Number.isFinite(font.flags)) {
        mapped.flags = font.flags;
      }
      if (typeof font.italic === 'boolean') {
        mapped.italic = font.italic;
      }
      return Object.keys(mapped).length ? mapped : undefined;
    };

    const mapElement = (el: any): StructElement => {
      const textRuns: StructElementTextRun[] = Array.isArray(el.textRuns)
        ? el.textRuns.map((run: any) => {
            const rawMatrix = run?.matrix;
            const hasMatrix =
              rawMatrix &&
              typeof rawMatrix === 'object' &&
              ['a', 'b', 'c', 'd', 'e', 'f'].every(
                (key) => typeof rawMatrix[key] === 'number' && Number.isFinite(rawMatrix[key]),
              );
            return {
              text: typeof run?.text === 'string' ? run.text : '',
              rect: cloneRect(run?.rect),
              font: mapFont(run?.font),
              matrix: hasMatrix
                ? {
                    a: Number(rawMatrix.a),
                    b: Number(rawMatrix.b),
                    c: Number(rawMatrix.c),
                    d: Number(rawMatrix.d),
                    e: Number(rawMatrix.e),
                    f: Number(rawMatrix.f),
                  }
                : undefined,
            };
          })
        : [];

      return {
        tag: el.tag,
        htmlTag: mapPdfTagToHtml(el.tag),
        text: typeof el.text === 'string' ? el.text : '',
        rect: cloneRect(el.rect),
        language: el.lang,
        attributes: el.attributes || {},
        font: mapFont(el.font),
        textRuns,
        mcids: Array.isArray(el.mcids) ? el.mcids : [],
        children: Array.isArray(el.children) ? el.children.map(mapElement) : [],
      };
    };
    return raw.map(mapElement);
  }
}
