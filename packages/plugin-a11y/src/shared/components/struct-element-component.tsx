import type { StructElement as StructElementModel } from '@embedpdf/plugin-a11y';

interface Props {
  element: StructElementModel;
  scale: number;
  parentLanguage?: string;
}

export function StructElementComponent({ element, scale, parentLanguage }: Props) {
  const Tag = (element.htmlTag || 'span') as any;
  const hasText = element.text.trim().length > 0;

  const style = {
    position: 'absolute' as const,
    left: element.rect.origin.x * scale,
    top: element.rect.origin.y * scale,
    width: element.rect.size.width * scale,
    height: element.rect.size.height * scale,
  };

  const attrs: Record<string, string> = { ...(element.attributes ?? {}) };
  const ownLang = element.language;
  if (ownLang && ownLang !== parentLanguage) {
    attrs.lang = ownLang;
  }

  return (
    <Tag {...attrs} style={style} data-pdftag={element.tag}>
      {hasText ? element.text : null}
      {element.children.map((child, i) => (
        <StructElementComponent
          key={i}
          element={child}
          scale={scale}
          parentLanguage={ownLang ?? parentLanguage}
        />
      ))}
    </Tag>
  );
}
