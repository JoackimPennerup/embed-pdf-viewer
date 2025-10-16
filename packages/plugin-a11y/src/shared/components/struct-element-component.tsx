import type { StructElement as StructElementModel } from '@embedpdf/plugin-a11y';

interface Props {
  element: StructElementModel;
  scale: number;
  parentLanguage?: string;
}

export function StructElementComponent({ element, scale, parentLanguage }: Props) {
  const Tag = (element.htmlTag || 'span') as any;
  const hasText = element.text.trim().length > 0;

  const {
    origin: { x, y },
    size: { width: rectWidth, height: rectHeight },
  } = element.rect;

  const style = {
    position: 'absolute' as const,
    ...(x !== 0 && { left: x * scale }),
    ...(y !== 0 && { top: y * scale }),
    ...(rectWidth !== 0 && { width: rectWidth * scale }),
    ...(rectHeight !== 0 && { height: rectHeight * scale }),
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
