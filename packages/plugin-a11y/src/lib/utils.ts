import { A11yLayerClassName } from './constants';
import { resolveFontFamily } from './font-registry';
import { a11yStyleSheet, resetA11yStyleSheet } from './stylesheet';

const TAG_MAP: Record<string, string> = {
  Document: 'section',
  Part: 'section',
  Sect: 'section',
  Div: 'div',
  P: 'p',
  Span: 'span',
  H: 'h1',
  H1: 'h1',
  H2: 'h2',
  H3: 'h3',
  H4: 'h4',
  H5: 'h5',
  H6: 'h6',
  L: 'ul',
  LI: 'li',
  LBody: 'ul',
  Table: 'table',
  TR: 'tr',
  TH: 'th',
  TD: 'td',
  Figure: 'figure',
  Caption: 'figcaption',
};

export function mapPdfTagToHtml(tag: string): string {
  return TAG_MAP[tag] ?? 'span';
}

export { A11yLayerClassName } from './constants';

export function translateFontFamily(fontFamily: string | undefined): string | undefined {
  if (!fontFamily) return undefined;
  if (fontFamily.includes('-')) {
    return `${fontFamily}, ${fontFamily.split('-')[0]}, sans-serif`;
  }
  if (fontFamily.includes('Helvetica')) return 'Helvetica, Arial, sans-serif';
  if (fontFamily.includes('Times')) return 'Times New Roman, serif';
  if (fontFamily.includes('Courier')) return 'Courier New, monospace';
  return fontFamily;
}

const fontClassNameMap: Map<string, string> = new Map();
export function getFontClassName(
  fontFamily: string | undefined,
  fontSize: number | undefined,
  fontWeight: number | undefined,
  italic: boolean | undefined,
): string | undefined {
  const sizeKey = fontSize !== undefined ? fontSize.toFixed(2) : '0';
  const weightKey = fontWeight !== undefined ? String(fontWeight) : '400';
  const italicKey = italic ? 'italic' : 'normal';
  const fontIdentifier = `${fontFamily || 'default'}-${sizeKey}-${weightKey}-${italicKey}`;

  const cached = fontClassNameMap.get(fontIdentifier);
  if (cached) {
    return cached;
  }

  const className = `ft-${fontClassNameMap.size + 1}`;
  const declarations: string[] = [];

  const resolvedFamily = resolveFontFamily(fontFamily);
  if (resolvedFamily) {
    const fallback = translateFontFamily(fontFamily);
    const families = [`"${resolvedFamily}"`];
    if (fallback && !fallback.toLowerCase().includes(resolvedFamily.toLowerCase())) {
      families.push(fallback);
    } else if (fallback && !fallback.startsWith('"')) {
      families.push(fallback);
    }
    declarations.push(`font-family: ${families.join(', ')};`);
  } else if (fontFamily) {
    const fallback = translateFontFamily(fontFamily);
    if (fallback) {
      declarations.push(`font-family: ${fallback};`);
    }
  }
  if (fontSize !== undefined) {
    declarations.push(`font-size: calc(var(--scale, 1) * ${fontSize.toFixed(2)}px);`);
  }
  if (fontWeight !== undefined) {
    declarations.push(`font-weight: ${fontWeight};`);
  }
  if (italic) {
    declarations.push('font-style: italic;');
  }

  a11yStyleSheet.insertRule(
    `.${A11yLayerClassName} .${className} { ${declarations.join(' ')} }`,
    a11yStyleSheet.cssRules.length,
  );
  fontClassNameMap.set(fontIdentifier, className);
  return className;
}

const lineHeightClassMap: Map<string, string> = new Map();
export function getLineHeightClass(lineHeightPx: number | undefined): string | undefined {
  if (!Number.isFinite(lineHeightPx) || lineHeightPx === undefined) {
    return undefined;
  }
  const key = lineHeightPx.toFixed(2);
  const cached = lineHeightClassMap.get(key);
  if (cached) return cached;

  const className = `lh-${lineHeightClassMap.size + 1}`;
  a11yStyleSheet.insertRule(
    `.${A11yLayerClassName} .${className} { line-height: ${lineHeightPx.toFixed(2)}px; }`,
    a11yStyleSheet.cssRules.length,
  );
  lineHeightClassMap.set(key, className);
  return className;
}

export function adoptA11yLayerStyleSheet(host: Document | ShadowRoot) {
  if (host.adoptedStyleSheets.includes(a11yStyleSheet)) {
    return;
  }
  host.adoptedStyleSheets = [...host.adoptedStyleSheets, a11yStyleSheet];
}

export function resetA11yStyles(): void {
  fontClassNameMap.clear();
  lineHeightClassMap.clear();
  resetA11yStyleSheet();
}
