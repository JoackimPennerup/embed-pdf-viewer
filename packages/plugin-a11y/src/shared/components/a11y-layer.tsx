import { StructElement as StructElementModel } from '@embedpdf/plugin-a11y';
import { useEffect, useMemo, useState } from '@framework';

import { useA11yCapability } from '../hooks';
import { StructElementComponent } from './struct-element-component';

type Props = {
  pageIndex: number;
  scale: number;
};

export function A11yLayer({ pageIndex, scale }: Props) {
  const { provides } = useA11yCapability();
  const [elements, setElements] = useState<StructElementModel[]>([]);
  const mcidMap = useMemo(() => new Map<number, string>(), [pageIndex]);

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
        <StructElementComponent key={i} element={el} scale={scale} mcidMap={mcidMap} />
      ))}
    </div>
  );
}
