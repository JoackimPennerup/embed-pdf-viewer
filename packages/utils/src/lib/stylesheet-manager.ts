export interface StyleSheetRegistration {
  owner: string;
  slot: string;
  order: number;
  css: string;
}

export interface StyleSheetLease {
  // eslint-disable-next-line no-unused-vars
  update(css: string): void;
  dispose(): void;
}

export interface StyleSheetRegistry {
  // eslint-disable-next-line no-unused-vars
  register(registration: StyleSheetRegistration): StyleSheetLease;
}

interface StyleSheetEntry extends StyleSheetRegistration {
  key: string;
  sheet: CSSStyleSheet;
  references: number;
}

const registries = new WeakMap<Document | ShadowRoot, StyleSheetRegistryImpl>();
let nextOwnerId = 0;

export function createStyleSheetOwner(prefix: string): string {
  nextOwnerId += 1;
  return `${prefix}-${nextOwnerId}`;
}

function getOwnerDocument(root: Document | ShadowRoot): Document {
  if (root.nodeType === 9) {
    return root as Document;
  }

  if (root.nodeType === 11 && 'host' in root && root.ownerDocument) {
    return root.ownerDocument;
  }

  throw new TypeError('A stylesheet registry requires a Document or ShadowRoot');
}

function containsImportRule(css: string): boolean {
  let quote: string | null = null;
  let inComment = false;

  for (let index = 0; index < css.length; index += 1) {
    const character = css[index];
    const next = css[index + 1];

    if (inComment) {
      if (character === '*' && next === '/') {
        inComment = false;
        index += 1;
      }
      continue;
    }

    if (quote) {
      if (character === '\\') {
        index += 1;
      } else if (character === quote) {
        quote = null;
      }
      continue;
    }

    if (character === '/' && next === '*') {
      inComment = true;
      index += 1;
      continue;
    }

    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }

    if (character !== '@' || css.slice(index + 1, index + 7).toLowerCase() !== 'import') {
      continue;
    }

    const boundary = css[index + 7];
    if (!boundary || !/[\w-]/.test(boundary)) {
      return true;
    }
  }

  return false;
}

function assertSupportedCss(css: string): void {
  if (containsImportRule(css)) {
    throw new Error('@import is not supported in constructed stylesheets');
  }
}

class StyleSheetRegistryImpl implements StyleSheetRegistry {
  private readonly entries = new Map<string, StyleSheetEntry>();
  private readonly ownedSheets = new Set<CSSStyleSheet>();
  private readonly StyleSheetConstructor: typeof CSSStyleSheet;

  constructor(private readonly root: Document | ShadowRoot) {
    const ownerDocument = getOwnerDocument(root);
    const StyleSheetConstructor = ownerDocument.defaultView?.CSSStyleSheet;

    if (
      !StyleSheetConstructor ||
      !StyleSheetConstructor.prototype.replaceSync ||
      !('adoptedStyleSheets' in root)
    ) {
      throw new Error(
        'Constructed stylesheets are required: CSSStyleSheet.replaceSync and adoptedStyleSheets must be supported',
      );
    }

    this.StyleSheetConstructor = StyleSheetConstructor;
  }

  register(registration: StyleSheetRegistration): StyleSheetLease {
    const { owner, slot, order, css } = registration;
    if (!owner || !slot) {
      throw new Error('Stylesheet registrations require non-empty owner and slot values');
    }
    if (!Number.isFinite(order)) {
      throw new Error('Stylesheet registration order must be a finite number');
    }
    assertSupportedCss(css);

    const key = `${owner}\0${slot}`;
    const current = this.entries.get(key);
    if (current) {
      if (current.order !== order || current.css !== css) {
        throw new Error(`Conflicting stylesheet registration for ${owner}/${slot}`);
      }

      current.references += 1;
      return this.createLease(current);
    }

    const sheet = new this.StyleSheetConstructor();
    sheet.replaceSync(css);

    const entry: StyleSheetEntry = {
      key,
      owner,
      slot,
      order,
      css,
      sheet,
      references: 1,
    };
    this.entries.set(key, entry);
    this.ownedSheets.add(sheet);

    try {
      this.syncAdoptedSheets();
    } catch (error) {
      this.entries.delete(key);
      this.ownedSheets.delete(sheet);
      throw error;
    }

    return this.createLease(entry);
  }

  private createLease(entry: StyleSheetEntry): StyleSheetLease {
    let disposed = false;

    return {
      update: (css: string): void => {
        if (disposed) {
          throw new Error(`Cannot update disposed stylesheet lease ${entry.owner}/${entry.slot}`);
        }
        if (css === entry.css) {
          return;
        }
        if (entry.references > 1) {
          throw new Error(
            `Cannot update shared stylesheet registration ${entry.owner}/${entry.slot}`,
          );
        }

        assertSupportedCss(css);
        entry.sheet.replaceSync(css);
        entry.css = css;
      },
      dispose: (): void => {
        if (disposed) {
          return;
        }
        disposed = true;
        entry.references -= 1;

        if (entry.references > 0) {
          return;
        }

        this.entries.delete(entry.key);
        this.ownedSheets.delete(entry.sheet);
        this.root.adoptedStyleSheets = this.root.adoptedStyleSheets.filter(
          (sheet) => sheet !== entry.sheet,
        );
      },
    };
  }

  private syncAdoptedSheets(): void {
    const foreignSheets = this.root.adoptedStyleSheets.filter(
      (sheet) => !this.ownedSheets.has(sheet),
    );
    const ownedSheets = [...this.entries.values()]
      .sort((left, right) => left.order - right.order || left.key.localeCompare(right.key))
      .map((entry) => entry.sheet);

    this.root.adoptedStyleSheets = [...foreignSheets, ...ownedSheets];
  }
}

export function getStyleSheetRegistry(root: Document | ShadowRoot): StyleSheetRegistry {
  const existing = registries.get(root);
  if (existing) {
    return existing;
  }

  const registry = new StyleSheetRegistryImpl(root);
  registries.set(root, registry);
  return registry;
}
