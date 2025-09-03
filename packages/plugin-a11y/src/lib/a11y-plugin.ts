import { BasePlugin, PluginRegistry } from '@embedpdf/core';

import { A11yCapability, A11yPluginConfig, StructElement } from './types';
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
