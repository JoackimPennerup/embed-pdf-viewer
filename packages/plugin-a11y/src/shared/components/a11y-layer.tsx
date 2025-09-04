import { StructElement } from '@embedpdf/plugin-a11y';
import { useEffect, useState } from '@framework';

import { useA11yCapability } from '../hooks';

type Props = {
  pageIndex: number;
  scale: number;
};

export function A11yLayer({ pageIndex, scale }: Props) {
  const { provides } = useA11yCapability();
  const [elements, setElements] = useState<StructElement[]>([]);

  useEffect(() => {
    if (!provides) return;
    provides
      .getStructElements(pageIndex)
      .then(setElements)
      .catch(() => setElements([]));
  }, [provides, pageIndex]);

  if (!elements.length) return null;

  return (
    <div className="embedpdf-a11y-layer" style={{ position: 'absolute', left: 0, top: 0, color: 'transparent', pointerEvents: 'none'}}>
      {elements.map((el, i) => {
        if (el.text === "") {
          return null;
        }
        const Tag = el.htmlTag as any;
        const style = {
          position: 'absolute' as const,
          left: el.rect.origin.x * scale,
          top: el.rect.origin.y * scale,
          width: el.rect.size.width * scale,
          height: el.rect.size.height * scale,
        };
        return (
          <Tag key={i} style={style} role={el.attributes?.role} data-pdf-tag={el.tag}>
            {el.text}
          </Tag>
        );
      })}
    </div>
  );
}
