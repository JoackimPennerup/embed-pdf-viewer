const TAG_MAP: Record<string, string> = {
  Document: 'article',
  Part: 'section',
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
  return TAG_MAP[tag] ?? 'div';
}
