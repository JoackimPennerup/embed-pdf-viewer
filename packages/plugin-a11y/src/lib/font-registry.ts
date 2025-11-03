import { PdfDocumentEmbeddedFont } from '@embedpdf/models';
import { blob } from 'stream/consumers';

const pdfFontNameToCss = new Map<string, string | null>();
let fontCounter = 0;
const registeredFontFaces: FontFace[] = [];

function warn(...args: unknown[]): void {
  (globalThis as { console?: { warn?: (...args: unknown[]) => void } }).console?.warn?.(...args);
}

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

function sliceToArrayBuffer(data: Uint8Array): ArrayBuffer {
  if (
    data.byteOffset === 0 &&
    data.byteLength === data.buffer.byteLength
  ) {
    return data.buffer;
  }
  return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
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

async function registerFontFace(font: PdfDocumentEmbeddedFont): Promise<string | undefined> {
  if (!font.data || !font.data.length) {
    return undefined;
  }

  const detected = detectFontFormat(font.data);
  if (!detected) {
    return undefined;
  }

  fontCounter += 1;
  const cssFamily = `embedpdf-font-${fontCounter}`;

  const finiteWeight =
    typeof font.weight === 'number' && Number.isFinite(font.weight) && font.weight > 0
      ? Math.round(font.weight)
      : undefined;
  const weightDescriptor = finiteWeight !== undefined ? String(finiteWeight) : undefined;
  const isItalic =
    font.italic === true || (typeof font.italicAngle === 'number' && font.italicAngle !== 0);
  const styleDescriptor = isItalic ? 'italic' : 'normal';

  const FontFaceCtor = (globalThis as { FontFace?: typeof FontFace }).FontFace;
  const doc = (globalThis as { document?: Document }).document;
  const fontSet = doc?.fonts;

  if (!FontFaceCtor || !fontSet) {
    warn(
      '[A11yPlugin] FontFace API unavailable; embedded font cannot be loaded',
      font.baseName ?? font.id,
    );
    return undefined;
  }

  try {
    const descriptors: FontFaceDescriptors = { style: styleDescriptor };
    if (weightDescriptor) {
      descriptors.weight = weightDescriptor;
    }

    const binary = sliceToArrayBuffer(font.data);
    console.log("TTF stream: ", URL.createObjectURL(new Blob([binary])));
    const fontFace = new FontFaceCtor(cssFamily, binary, descriptors);
    if ('display' in fontFace) {
      (fontFace as FontFace & { display?: string }).display = 'swap';
    }
    await fontFace.load();
    fontSet.add(fontFace);
    registeredFontFaces.push(fontFace);
    return cssFamily;
  } catch (error) {
    warn('[A11yPlugin] Failed to load font via FontFace API', font.baseName ?? font.id, error);
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

  const doc = (globalThis as { document?: Document }).document;
  const fontSet = doc?.fonts;
  if (fontSet) {
    for (const face of registeredFontFaces) {
      try {
        if (typeof fontSet.delete === 'function') {
          fontSet.delete(face);
        }
      } catch (error) {
        warn('[A11yPlugin] Failed to remove font face', face.family, error);
      }
    }
  }
  registeredFontFaces.length = 0;
}

export async function registerDocumentFonts(
  _docId: string,
  fonts: PdfDocumentEmbeddedFont[],
): Promise<void> {
  const seen = new Set<string>();
  const registrations: Array<Promise<void>> = [];
  for (const font of fonts) {
    if (seen.has(font.id)) {
      continue;
    }
    seen.add(font.id);

    registrations.push(
      (async () => {
        let cssFamily: string | undefined;
        try {
          cssFamily = await registerFontFace(font);
        } catch (error) {
          warn('[A11yPlugin] Unexpected error while registering font', font.baseName ?? font.id, error);
          cssFamily = undefined;
        }

        const names = collectFontNames(font);
        if (names.length === 0) {
          setNameMapping(font.id, cssFamily ?? null);
        }

        for (const name of names) {
          setNameMapping(name, cssFamily ?? null);
        }
      })(),
    );
  }

  await Promise.all(registrations);
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
