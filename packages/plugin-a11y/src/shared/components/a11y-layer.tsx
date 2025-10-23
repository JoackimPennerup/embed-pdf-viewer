import { StructElement as StructElementModel } from '@embedpdf/plugin-a11y';
import { useEffect, useRef, useState } from '@framework';

import { useA11yCapability } from '../hooks';
import { StructElementComponent } from './struct-element-component';
import { A11yLayerClassName, adoptA11yLayerStyleSheet } from '../../lib/utils';

type Props = {
  pageIndex: number;
  scale: number;
};

export function A11yLayer({ pageIndex, scale }: Props) {
  const { provides } = useA11yCapability();
  const [className, setClassName] = useState<string>(A11yLayerClassName); 
  const [elements, setElements] = useState<StructElementModel[]>([]);
  const layerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!provides) return;
    provides
      .getStructElements(pageIndex)
      .then(setElements)
      .catch(() => setElements([]));
    setClassName(provides.getClassNames());
  }, [provides, pageIndex]);

  useEffect(() => {
    if (layerRef.current != null) {
      const rootNode = layerRef.current.getRootNode();
      const host = rootNode instanceof ShadowRoot ? rootNode : document;
      adoptA11yLayerStyleSheet(host);
    }
  }, [elements]);

  if (!elements.length) return null;

  const style = {
    '--scale': scale
  };

  return (
    <div className={className} ref={layerRef} style={style}>
      {elements.map((el, i) => (
        <StructElementComponent key={i} element={el} scale={scale} />
      ))}
    </div>
  );
}
