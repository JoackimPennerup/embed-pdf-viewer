import type { StructElement as StructElementModel } from '@embedpdf/plugin-a11y';

interface Props {
  element: StructElementModel;
  scale: number;
  mcidMap: Map<number, string>;
}

export function StructElementComponent({ element, scale, mcidMap }: Props) {
  const Tag = (element.htmlTag || 'span') as any;
  // const Tag = ('span') as any;

  const mcids = element.mcids.filter((mcid) => mcid >= 0);

  const existingIds = mcids
    .map((mcid) => mcidMap.get(mcid))
    .filter((id): id is string => Boolean(id));

  const hasText = element.text.trim().length > 0;
  const newMcids = hasText ? mcids.filter((mcid) => !mcidMap.has(mcid)) : [];

  let id: string | undefined;
  if (newMcids.length) {
    id = `mcid-${newMcids[0]}`;
    newMcids.forEach((mcid) => mcidMap.set(mcid, id!));
  }

  const ariaProps = existingIds.length ? { 'aria-labelledby': existingIds.join(' ') } : {};

  const style = {
    position: 'absolute' as const,
    left: element.rect.origin.x * scale,
    top: element.rect.origin.y * scale,
    width: element.rect.size.width * scale,
    height: element.rect.size.height * scale,
  };

  return (
    <Tag
      {...element.attributes}
      {...(id && { id })}
      {...ariaProps}
      style={style}
      data-pdftag={element.tag}
    >
      {hasText && (id || mcids.length === 0) ? element.text : null}
      {element.children.map((child, i) => (
        <StructElementComponent key={i} element={child} scale={scale} mcidMap={mcidMap} />
      ))}
    </Tag>
  );
}
