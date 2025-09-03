import { BasePlugin, PluginRegistry } from '@embedpdf/core';

import { StructElement, StructureCapability, StructurePluginConfig } from './types';
import { mapPdfTagToHtml } from './utils';

export class StructurePlugin extends BasePlugin<StructurePluginConfig, StructureCapability> {
  static readonly id = 'structure' as const;

  private config: StructurePluginConfig = { debug: false };

  constructor(id: string, registry: PluginRegistry) {
    super(id, registry);
  }

  async initialize(config: StructurePluginConfig): Promise<void> {
    this.config = { ...this.config, ...config };
  }

  protected buildCapability(): StructureCapability {
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
    const raw: any[] = await engine.getStructTree(coreState.document, page);
    return raw.map((el) => ({
      tag: el.tag,
      htmlTag: mapPdfTagToHtml(el.tag),
      text: el.text ?? '',
      rect: el.rect,
      attributes: el.attributes || {},
    }));
  }
}
