import type { A11yHtmlNode } from './contract';

const ROLES: Record<string, string> = {
  P: 'paragraph',
  H: 'heading',
  H1: 'heading',
  H2: 'heading',
  H3: 'heading',
  H4: 'heading',
  H5: 'heading',
  H6: 'heading',
  L: 'list',
  LI: 'listitem',
  LBody: 'group',
  Table: 'table',
  TR: 'row',
  TH: 'columnheader',
  TD: 'cell',
  Figure: 'figure',
  Caption: 'caption',
};
const PRESENTATION = new Set(['Part', 'Sect', 'Div', 'Span', 'LBody']);
const INLINE = new Set(['Link', 'Span', 'LBody']);

export const mapPdfTagToRole = (tag: string): string | undefined => ROLES[tag];
export const shouldPresentPdfTag = (tag: string): boolean => PRESENTATION.has(tag);
export function headingLevelFromTag(tag: string): number | undefined {
  const match = /^H([1-6])$/.exec(tag);
  return match ? Number(match[1]) : undefined;
}

/** Semantic HTML decisions are framework-independent; navigation remains the LinkLayer's job. */
export function semanticHtmlForNode(
  node: A11yHtmlNode,
  parentTag?: string,
): {
  tagName: string | null;
  role?: string;
  ariaLevel?: number;
  ariaLabel?: string;
  href?: string;
} {
  const inlineOnly = node.children.every((child) => child.presentation || INLINE.has(child.tag));
  let tagName: string | null;
  switch (node.tag) {
    case 'H1':
    case 'H2':
    case 'H3':
    case 'H4':
    case 'H5':
    case 'H6':
      tagName = inlineOnly ? node.tag.toLowerCase() : 'div';
      break;
    case 'P':
      tagName = inlineOnly ? 'p' : 'div';
      break;
    case 'Link':
      tagName = 'a';
      break;
    case 'L':
      tagName = 'ul';
      break;
    case 'LI':
      tagName = 'li';
      break;
    case 'LBody':
    case 'Span':
      tagName = 'span';
      break;
    case 'Table':
      tagName = 'table';
      break;
    case 'TR':
      tagName = 'tr';
      break;
    case 'TH':
      tagName = 'th';
      break;
    case 'TD':
      tagName = 'td';
      break;
    case 'Caption':
      tagName = parentTag === 'table' ? 'caption' : 'p';
      break;
    case 'Figure':
      tagName = 'figure';
      break;
    case 'Document':
      tagName = null;
      break;
    default:
      tagName = 'div';
  }
  if (
    node.presentation &&
    !node.textLines.length &&
    !node.textRuns.length &&
    !node.children.length
  ) {
    tagName = null;
  }
  const role = node.presentation
    ? 'presentation'
    : tagName === 'div' && node.semanticRole === 'heading'
      ? 'heading'
      : ['ul', 'li', 'table', 'tr', 'th', 'td'].includes(tagName ?? '')
        ? node.semanticRole
        : undefined;
  return {
    tagName,
    role,
    ariaLevel: role === 'heading' ? node.headingLevel : undefined,
    ariaLabel:
      node.tag === 'Figure' ? node.altText || node.actualText || node.text || undefined : undefined,
    href: node.tag === 'Link' ? node.attributes.href : undefined,
  };
}
