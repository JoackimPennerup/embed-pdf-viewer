import type { StructElement as StructElementModel } from '@embedpdf/plugin-a11y';

interface Props {
  element: StructElementModel;
  scale: number;
}

export function StructElementComponent({ element, scale }: Props) {
  const Tag = (element.htmlTag || 'span') as any;
  const hasText = element.text.trim().length > 0;

  const style = {
    position: 'absolute' as const,
    left: element.rect.origin.x * scale,
    top: element.rect.origin.y * scale,
    width: element.rect.size.width * scale,
    height: element.rect.size.height * scale,
  };

  return (
    <Tag {...element.attributes} style={style} data-pdftag={element.tag}>
      {hasText ? element.text : null}
      {element.children.map((child, i) => (
        <StructElementComponent key={i} element={child} scale={scale} />
      ))}
    </Tag>
  );
}
