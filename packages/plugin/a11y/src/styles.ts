import type { A11yHtmlNode, StructElementFont } from './contract';

/** CSS-only helpers; DOM insertion and canvas measurement belong to the host UI. */
const QUALIFIER =
  /\s*\b(?:ultra\s?thin|extra\s?thin|thin|ultra\s?light|extra\s?light|light|regular|medium|semi\s?bold|demi\s?bold|ultra\s?bold|extra\s?bold|bold|heavy|black|italic|oblique|condensed|narrow|compressed|extended|expanded|wide)\b\s*/gi;
const FAMILIES: Readonly<Record<string, readonly string[]>> = {
  arial: ['Arial', 'Helvetica', 'Helvetica Neue', 'sans-serif'],
  helvetica: ['Helvetica Neue', 'Helvetica', 'Arial', 'sans-serif'],
  'helvetica neue': ['Helvetica Neue', 'Helvetica', 'Arial', 'sans-serif'],
  'open sans': ['Open Sans', 'Segoe UI', 'Arial', 'Helvetica', 'sans-serif'],
  roboto: ['Roboto', 'Segoe UI', 'Arial', 'sans-serif'],
  lato: ['Lato', 'Segoe UI', 'Arial', 'Helvetica', 'sans-serif'],
  montserrat: ['Montserrat', 'Trebuchet MS', 'Arial', 'sans-serif'],
  raleway: ['Raleway', 'Trebuchet MS', 'Arial', 'sans-serif'],
  oswald: ['Oswald', 'Impact', 'Arial Narrow', 'Arial', 'sans-serif'],
  inter: ['Inter', 'Segoe UI', 'Arial', 'sans-serif'],
  poppins: ['Poppins', 'Segoe UI', 'Arial', 'sans-serif'],
  nunito: ['Nunito', 'Open Sans', 'Arial', 'sans-serif'],
  'fira sans': ['Fira Sans', 'Open Sans', 'Arial', 'sans-serif'],
  'source sans': ['Source Sans Pro', 'Source Sans 3', 'Open Sans', 'Arial', 'sans-serif'],
  'source sans pro': ['Source Sans Pro', 'Source Sans 3', 'Open Sans', 'Arial', 'sans-serif'],
  'source sans 3': ['Source Sans 3', 'Source Sans Pro', 'Open Sans', 'Arial', 'sans-serif'],
  'pt sans': ['PT Sans', 'Arial', 'sans-serif'],
  'noto sans': ['Noto Sans', 'Open Sans', 'Arial', 'sans-serif'],
  ubuntu: ['Ubuntu', 'Segoe UI', 'Arial', 'sans-serif'],
  'segoe ui': ['Segoe UI', 'Arial', 'sans-serif'],
  segoe: ['Segoe UI', 'Arial', 'sans-serif'],
  calibri: ['Calibri', 'Candara', 'Segoe UI', 'Arial', 'sans-serif'],
  candara: ['Candara', 'Calibri', 'Segoe UI', 'Arial', 'sans-serif'],
  verdana: ['Verdana', 'Geneva', 'Arial', 'sans-serif'],
  tahoma: ['Tahoma', 'Geneva', 'Verdana', 'Arial', 'sans-serif'],
  trebuchet: ['Trebuchet MS', 'Helvetica', 'Arial', 'sans-serif'],
  'trebuchet ms': ['Trebuchet MS', 'Helvetica', 'Arial', 'sans-serif'],
  'gill sans': ['Gill Sans', 'Gill Sans MT', 'Calibri', 'Arial', 'sans-serif'],
  myriad: ['Myriad', 'Myriad Pro', 'Segoe UI', 'Arial', 'sans-serif'],
  'myriad pro': ['Myriad Pro', 'Myriad', 'Segoe UI', 'Arial', 'sans-serif'],
  futura: ['Futura', 'Century Gothic', 'Trebuchet MS', 'Arial', 'sans-serif'],
  'century gothic': ['Century Gothic', 'Trebuchet MS', 'Arial', 'sans-serif'],
  'lucida sans': ['Lucida Sans Unicode', 'Lucida Grande', 'Arial', 'sans-serif'],
  impact: ['Impact', 'Arial Narrow', 'Arial', 'sans-serif'],
  'arial narrow': ['Arial Narrow', 'Arial', 'sans-serif'],
  garamond: ['Garamond', 'EB Garamond', 'Times New Roman', 'Times', 'Georgia', 'serif'],
  'eb garamond': ['EB Garamond', 'Garamond', 'Times New Roman', 'Times', 'Georgia', 'serif'],
  times: ['Times New Roman', 'Times', 'Georgia', 'serif'],
  'times new roman': ['Times New Roman', 'Times', 'Georgia', 'serif'],
  'times roman': ['Times New Roman', 'Times', 'Georgia', 'serif'],
  georgia: ['Georgia', 'Times New Roman', 'Times', 'serif'],
  palatino: ['Palatino Linotype', 'Palatino', 'Book Antiqua', 'Georgia', 'serif'],
  'book antiqua': ['Book Antiqua', 'Palatino Linotype', 'Palatino', 'Georgia', 'serif'],
  baskerville: ['Baskerville', 'Baskerville Old Face', 'Georgia', 'serif'],
  bodoni: ['Bodoni MT', 'Bodoni', 'Georgia', 'serif'],
  caslon: ['Adobe Caslon Pro', 'Big Caslon', 'Georgia', 'serif'],
  merriweather: ['Merriweather', 'Georgia', 'serif'],
  'noto serif': ['Noto Serif', 'Georgia', 'serif'],
  'pt serif': ['PT Serif', 'Georgia', 'serif'],
  cambria: ['Cambria', 'Georgia', 'Times New Roman', 'serif'],
  constantia: ['Constantia', 'Georgia', 'Times New Roman', 'serif'],
  bookman: ['Bookman Old Style', 'Book Antiqua', 'Georgia', 'serif'],
  century: ['Century Schoolbook', 'New Century Schoolbook', 'Georgia', 'serif'],
  lora: ['Lora', 'Georgia', 'serif'],
  crimson: ['Crimson Text', 'Crimson Pro', 'Georgia', 'serif'],
  spectral: ['Spectral', 'Georgia', 'serif'],
  courier: ['Courier New', 'Courier', 'Lucida Console', 'monospace'],
  'courier new': ['Courier New', 'Courier', 'Lucida Console', 'monospace'],
  consolas: ['Consolas', 'Courier New', 'Courier', 'monospace'],
  monaco: ['Monaco', 'Menlo', 'Consolas', 'Courier New', 'monospace'],
  menlo: ['Menlo', 'Monaco', 'Consolas', 'Courier New', 'monospace'],
  inconsolata: ['Inconsolata', 'Consolas', 'Courier New', 'monospace'],
  'source code pro': ['Source Code Pro', 'Consolas', 'Courier New', 'monospace'],
  'fira code': ['Fira Code', 'Consolas', 'Courier New', 'monospace'],
  'fira mono': ['Fira Mono', 'Consolas', 'Courier New', 'monospace'],
  'jetbrains mono': ['JetBrains Mono', 'Consolas', 'Courier New', 'monospace'],
  'roboto mono': ['Roboto Mono', 'Consolas', 'Courier New', 'monospace'],
  'ubuntu mono': ['Ubuntu Mono', 'Consolas', 'Courier New', 'monospace'],
  'ibm plex mono': ['IBM Plex Mono', 'Consolas', 'Courier New', 'monospace'],
};
const SERIF_BASES = new Set([
  'garamond',
  'eb garamond',
  'times',
  'times new roman',
  'times roman',
  'georgia',
  'palatino',
  'book antiqua',
  'baskerville',
  'bodoni',
  'caslon',
  'merriweather',
  'noto serif',
  'pt serif',
  'cambria',
  'constantia',
  'bookman',
  'century',
  'charter',
  'lora',
  'crimson',
  'spectral',
  'libre baskerville',
  'source serif',
  'cormorant',
  'playfair',
  'playfair display',
]);
const MONO_BASES = new Set([
  'courier',
  'courier new',
  'consolas',
  'monaco',
  'menlo',
  'inconsolata',
  'source code pro',
  'fira code',
  'fira mono',
  'jetbrains mono',
  'roboto mono',
  'ubuntu mono',
  'ibm plex mono',
  'anonymous pro',
  'space mono',
  'noto mono',
  'pt mono',
  'hack',
]);
const GENERICS = new Set(['serif', 'sans-serif', 'monospace']);
const quote = (family: string) =>
  GENERICS.has(family) ? family : `"${family.replace(/[\\"\r\n]/g, '')}"`;

export function stripFontQualifiers(family: string): string {
  return family.replace(QUALIFIER, ' ').replace(/\s+/g, ' ').trim();
}

export function buildFontFamilyStack(family?: string): string {
  if (!family) return 'sans-serif';
  const base = stripFontQualifiers(family) || family;
  const known = FAMILIES[base.toLowerCase()];
  const generic = MONO_BASES.has(base.toLowerCase())
    ? 'monospace'
    : SERIF_BASES.has(base.toLowerCase())
      ? 'serif'
      : 'sans-serif';
  const chain = [
    family,
    ...(known ?? (base === family ? [] : [base])),
    ...(!known
      ? generic === 'serif'
        ? ['Georgia', 'Times New Roman']
        : generic === 'monospace'
          ? ['Consolas', 'Courier New']
          : ['Segoe UI', 'Arial']
      : []),
    ...(!known ? [generic] : []),
  ];
  const seen = new Set<string>();
  return chain
    .filter((name) => {
      const key = name.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map(quote)
    .join(', ');
}

export const makeFontClassKey = (font?: StructElementFont): string =>
  `${font?.family ?? ''}\0${font?.weight ?? 0}\0${font?.italic ? 1 : 0}`;

export function fontClassName(key: string): string {
  let hash = 5381;
  for (let index = 0; index < key.length; index++)
    hash = (Math.imul(hash, 33) ^ key.charCodeAt(index)) | 0;
  return `epdf-f${(hash >>> 0).toString(36)}`;
}

export function buildFontClassRule(className: string, font?: StructElementFont): string {
  const declarations = [`font-family:${buildFontFamilyStack(font?.family)}`];
  if (font?.weight) declarations.push(`font-weight:${font.weight}`);
  if (font?.italic) declarations.push('font-style:italic');
  return `.${className}{${declarations.join(';')}}`;
}

export function collectFontClasses(nodes: readonly A11yHtmlNode[]): Map<string, string> {
  const rules = new Map<string, string>();
  function visit(node: A11yHtmlNode): void {
    for (const text of [...node.textRuns, ...node.textLines]) {
      const className = fontClassName(makeFontClassKey(text.font));
      if (!rules.has(className)) rules.set(className, buildFontClassRule(className, text.font));
    }
    node.children.forEach(visit);
  }
  nodes.forEach(visit);
  return rules;
}

/** Browser measures with canvas; the scale policy stays pure and testable here. */
export function computeScaleX(targetWidth: number, measuredWidth: number): number {
  if (targetWidth <= 0 || measuredWidth <= 0) return 1;
  return Math.min(3, Math.max(0.5, targetWidth / measuredWidth));
}

export function fragmentStyleVars(
  x: number,
  y: number,
  height: number,
  scaleX: number,
  rotation: number,
) {
  return {
    '--x': `${x}px`,
    '--y': `${y}px`,
    '--font-height': `${height}px`,
    '--scale-x': String(scaleX),
    '--rotate': `${rotation}deg`,
  };
}
