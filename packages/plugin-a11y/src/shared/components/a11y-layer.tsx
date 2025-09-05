import { StructElement as StructElementModel } from '@embedpdf/plugin-a11y';
import { useEffect, useState } from '@framework';

import { useA11yCapability } from '../hooks';
import { StructElementComponent } from './struct-element-component';

type Props = {
  pageIndex: number;
  scale: number;
};

export function A11yLayer({ pageIndex, scale }: Props) {
  const { provides } = useA11yCapability();
  const [elements, setElements] = useState<StructElementModel[]>([]);

  useEffect(() => {
    if (!provides) return;
    provides
      .getStructElements(pageIndex)
      .then(setElements)
      .catch(() => setElements([]));
  }, [provides, pageIndex]);

  if (!elements.length) return null;

  return (
    <div style={{ position: 'absolute', left: 0, top: 0 }}>
      {elements.map((el, i) => (
        <StructElementComponent key={i} element={el} scale={scale} />
      ))}
    </div>
  );
}
