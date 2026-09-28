import { describe, expect, it } from 'vitest';
import { getStyleSheetRegistry } from '../src/lib/stylesheet-manager';

class FakeStyleSheet {
  css = '';
  replacements = 0;

  replaceSync(css: string): void {
    this.css = css;
    this.replacements += 1;
  }
}

interface FakeRoot {
  nodeType: number;
  defaultView: { CSSStyleSheet: typeof FakeStyleSheet };
  adoptedStyleSheets: FakeStyleSheet[];
}

function createRoot(): Document {
  const root: FakeRoot = {
    nodeType: 9,
    defaultView: { CSSStyleSheet: FakeStyleSheet },
    adoptedStyleSheets: [],
  };
  return root as unknown as Document;
}

function register(root: Document, owner: string, slot: string, order: number, css: string) {
  return getStyleSheetRegistry(root).register({ owner, slot, order, css });
}

describe('getStyleSheetRegistry', () => {
  it('orders owned sheets while preserving foreign sheets', () => {
    const root = createRoot();
    const foreign = new FakeStyleSheet();
    root.adoptedStyleSheets = [foreign as unknown as CSSStyleSheet];

    const late = register(root, 'viewer', 'theme', 300, ':host { color: blue; }');
    const early = register(root, 'viewer', 'base', 200, ':host { display: flex; }');

    expect(root.adoptedStyleSheets).toHaveLength(3);
    expect(root.adoptedStyleSheets[0]).toBe(foreign);
    expect((root.adoptedStyleSheets[1] as unknown as FakeStyleSheet).css).toContain('display');
    expect((root.adoptedStyleSheets[2] as unknown as FakeStyleSheet).css).toContain('color');

    early.dispose();
    late.dispose();
    expect(root.adoptedStyleSheets).toEqual([foreign]);
  });

  it('reference counts identical registrations and disposes idempotently', () => {
    const root = createRoot();
    const first = register(root, 'viewer', 'base', 100, '.viewer {}');
    const second = register(root, 'viewer', 'base', 100, '.viewer {}');

    expect(root.adoptedStyleSheets).toHaveLength(1);
    first.dispose();
    first.dispose();
    expect(root.adoptedStyleSheets).toHaveLength(1);
    second.dispose();
    expect(root.adoptedStyleSheets).toHaveLength(0);
  });

  it('rejects conflicting registrations and updates to shared entries', () => {
    const root = createRoot();
    const first = register(root, 'viewer', 'base', 100, '.viewer {}');
    const second = register(root, 'viewer', 'base', 100, '.viewer {}');

    expect(() => register(root, 'viewer', 'base', 100, '.other {}')).toThrow(/Conflicting/);
    expect(() => first.update('.viewer { display: flex; }')).toThrow(/shared/);

    second.dispose();
    first.update('.viewer { display: flex; }');
    expect((root.adoptedStyleSheets[0] as unknown as FakeStyleSheet).css).toContain('flex');
  });

  it('keeps registrations isolated between document realms', () => {
    const firstRoot = createRoot();
    const secondRoot = createRoot();

    register(firstRoot, 'viewer', 'base', 100, '.first {}');
    register(secondRoot, 'viewer', 'base', 100, '.second {}');

    expect(firstRoot.adoptedStyleSheets[0]).not.toBe(secondRoot.adoptedStyleSheets[0]);
  });

  it('uses the owning document constructor for shadow roots', () => {
    const ownerDocument = createRoot();
    const shadowRoot = {
      nodeType: 11,
      host: {},
      ownerDocument,
      adoptedStyleSheets: [],
    } as unknown as ShadowRoot;

    getStyleSheetRegistry(shadowRoot).register({
      owner: 'viewer',
      slot: 'base',
      order: 100,
      css: ':host {}',
    });

    expect(shadowRoot.adoptedStyleSheets[0]).toBeInstanceOf(FakeStyleSheet);
  });

  it('supports StrictMode-style dispose and reacquire cycles', () => {
    const root = createRoot();
    const first = register(root, 'viewer', 'base', 100, '.viewer {}');
    const firstSheet = root.adoptedStyleSheets[0];

    first.dispose();
    const second = register(root, 'viewer', 'base', 100, '.viewer {}');

    expect(root.adoptedStyleSheets).toHaveLength(1);
    expect(root.adoptedStyleSheets[0]).not.toBe(firstSheet);
    second.dispose();
  });

  it('supports scoped dynamic rules without changing sheet identity', () => {
    const root = createRoot();
    const lease = register(
      root,
      'a11y',
      'fonts',
      400,
      '[data-viewer="one"] [data-page="0"] .epdf-f1 { font-family: Arial; }',
    );
    const sheet = root.adoptedStyleSheets[0] as unknown as FakeStyleSheet;

    lease.update(
      '[data-viewer="one"] [data-page="0"] .epdf-f1 { font-family: Arial; }\n' +
        '[data-viewer="one"] [data-page="1"] .epdf-f2 { font-family: serif; }',
    );

    expect(root.adoptedStyleSheets[0]).toBe(sheet);
    expect(sheet.replacements).toBe(2);
    expect(sheet.css).toContain('[data-page="1"]');
  });

  it('rejects imports but permits import text in strings and comments', () => {
    const root = createRoot();

    expect(() => register(root, 'viewer', 'bad', 100, '@import url("theme.css");')).toThrow(
      /@import/,
    );
    expect(() =>
      register(
        root,
        'viewer',
        'safe',
        100,
        '/* @import ignored */ .x::after { content: "@import"; }',
      ),
    ).not.toThrow();
  });

  it('fails clearly when constructed stylesheets are unavailable', () => {
    const root = {
      nodeType: 9,
      defaultView: {},
      adoptedStyleSheets: [],
    } as unknown as Document;

    expect(() => getStyleSheetRegistry(root)).toThrow(/Constructed stylesheets are required/);
  });
});
