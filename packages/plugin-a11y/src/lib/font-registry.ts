import { PdfDocumentEmbeddedFont } from '@embedpdf/models';

import { a11yStyleSheet } from './stylesheet';

const pdfFontNameToCss = new Map<string, string | null>();
let fontCounter = 0;

const SUPPORTED_FORMATS: Record<string, { mime: string; cssFormat: string }> = {
  woff2: { mime: 'font/woff2', cssFormat: 'woff2' },
  woff: { mime: 'font/woff', cssFormat: 'woff' },
  truetype: { mime: 'font/ttf', cssFormat: 'truetype' },
  opentype: { mime: 'font/otf', cssFormat: 'opentype' },
};

type SupportedFormatKey = keyof typeof SUPPORTED_FORMATS;

type DetectedFormat = {
  key: SupportedFormatKey;
  mime: string;
  cssFormat: string;
};

function detectFontFormat(data: Uint8Array): DetectedFormat | null {
  if (data.length < 4) return null;

  const signature = String.fromCharCode(data[0], data[1], data[2], data[3]);
  if (signature === 'wOF2') {
    return { key: 'woff2', ...SUPPORTED_FORMATS.woff2 };
  }
  if (signature === 'wOFF') {
    return { key: 'woff', ...SUPPORTED_FORMATS.woff };
  }
  if (signature === 'OTTO') {
    return { key: 'opentype', ...SUPPORTED_FORMATS.opentype };
  }
  if (signature === 'true') {
    return { key: 'truetype', ...SUPPORTED_FORMATS.truetype };
  }
  if (signature === '\u0000\u0001\u0000\u0000') {
    return { key: 'truetype', ...SUPPORTED_FORMATS.truetype };
  }

  // TrueType collections start with 'ttcf'. They are not directly usable as webfonts.
  if (signature === 'ttcf') {
    return null;
  }

  // Bare CFF fonts start with 0x01 0x00 0x04 0x00; treat as unsupported for now.
  if (data[0] === 0x01 && data[1] === 0x00 && data[2] === 0x04 && data[3] === 0x00) {
    return null;
  }

  // PDF can embed Type1 ("%!PS") or other formats which are not usable directly.
  if (signature === '%!PS') {
    return null;
  }

  return null;
}

function toBase64(data: Uint8Array): string {
  const maybeBuffer = (
    globalThis as { Buffer?: { from(data: Uint8Array): { toString(encoding: string): string } } }
  ).Buffer;
  if (maybeBuffer && typeof maybeBuffer.from === 'function') {
    return maybeBuffer.from(data).toString('base64');
  }

  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < data.length; i += chunkSize) {
    const chunk = data.subarray(i, Math.min(data.length, i + chunkSize));
    binary += String.fromCharCode(...chunk);
  }
  const base64Encoder = (globalThis as { btoa?: (data: string) => string }).btoa;
  if (typeof base64Encoder === 'function') {
    return base64Encoder(binary);
  }
  throw new Error('Base64 encoding is not supported in this environment.');
}

function normaliseName(name: string): string {
  return name.trim();
}

function setNameMapping(name: string, cssFamily: string | null) {
  const trimmed = normaliseName(name);
  if (!trimmed.length) {
    return;
  }
  pdfFontNameToCss.set(trimmed, cssFamily);
  pdfFontNameToCss.set(trimmed.toLowerCase(), cssFamily);
}

function registerFontFace(font: PdfDocumentEmbeddedFont): string | undefined {
  if (!font.data || !font.data.length) {
    return undefined;
  }

  const detected = detectFontFormat(font.data);
  if (!detected) {
    return undefined;
  }

  fontCounter += 1;
  const cssFamily = `embedpdf-font-${fontCounter}`;

  const base64 = toBase64(font.data);
  const descriptors: string[] = [];
  descriptors.push(`font-family: "${cssFamily}"`);
  descriptors.push(
    `src: url("data:${detected.mime};base64,${base64}") format('${detected.cssFormat}')`,
  );
  descriptors.push('font-display: swap');

  if (typeof font.weight === 'number' && Number.isFinite(font.weight) && font.weight > 0) {
    descriptors.push(`font-weight: ${Math.round(font.weight)}`);
  }

  const isItalic =
    font.italic === true || (typeof font.italicAngle === 'number' && font.italicAngle !== 0);
  if (isItalic) {
    descriptors.push('font-style: italic');
  }

  const rule = `@font-face { ${descriptors.join('; ')}; }`;

  try {
    a11yStyleSheet.insertRule(rule, a11yStyleSheet.cssRules.length);
    return cssFamily;
  } catch (error) {
    const logger = (globalThis as { console?: { warn?: (...args: unknown[]) => void } }).console;
    logger?.warn?.('[A11yPlugin] Failed to register font face', font.baseName ?? font.id, error);
    return undefined;
  }
}

function collectFontNames(font: PdfDocumentEmbeddedFont): string[] {
  const names = new Set<string>();
  if (font.baseName) {
    names.add(font.baseName);
  }
  if (font.postScriptName) {
    names.add(font.postScriptName);
  }
  if (font.subsetTag && font.postScriptName) {
    names.add(`${font.subsetTag}+${font.postScriptName}`);
  }
  if (font.family) {
    names.add(font.family);
  }
  return Array.from(names);
}

export function resetFontRegistry(): void {
  pdfFontNameToCss.clear();
  fontCounter = 0;
}

export function registerDocumentFonts(_docId: string, fonts: PdfDocumentEmbeddedFont[]): void {
  const seen = new Set<string>();
  for (const font of fonts) {
    if (seen.has(font.id)) {
      continue;
    }
    seen.add(font.id);

    const cssFamily = registerFontFace(font);
    const names = collectFontNames(font);
    if (names.length === 0 && cssFamily) {
      // Still allow lookup via generated family if no names available.
      setNameMapping(font.id, cssFamily);
    }

    for (const name of names) {
      setNameMapping(name, cssFamily ?? null);
    }
  }
}

export function resolveFontFamily(pdfFontName: string | undefined): string | undefined {
  if (!pdfFontName) return undefined;
  const direct = pdfFontNameToCss.get(pdfFontName);
  if (direct) {
    return direct;
  }
  if (direct === null) {
    return undefined;
  }
  const lower = pdfFontNameToCss.get(pdfFontName.toLowerCase());
  return lower ?? undefined;
}
