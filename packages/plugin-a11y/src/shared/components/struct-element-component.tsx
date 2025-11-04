import type { StructElement as StructElementModel } from '@embedpdf/plugin-a11y';
import { Fragment, useEffect, useRef } from 'react';
import { computeStructElementViewModel } from './struct-element-viewmodel';
import { A11yLayerClassName } from '../../lib/utils';

interface Props {
  element: StructElementModel;
  scale: number;
  parentLanguage?: string;
  debug: boolean;
}

export function StructElementComponent({ element, scale, parentLanguage, debug }: Props) {
  const elementRef = useRef<HTMLElement>(null);

  const viewModel = computeStructElementViewModel(element, scale, parentLanguage, debug);
  const Tag = viewModel.tagName as any;

  useEffect(() => {
    if (elementRef.current != null && !elementRef.current.closest('.' + A11yLayerClassName)) {
      console.error('StructElementComponent must be rendered within an A11yLayer component.');
    }
  });

  return (
    <Tag {...viewModel.attrs} style={viewModel.elementStyle} ref={elementRef}>
      {viewModel.textRuns.map((run, i) => (
        <Fragment key={i}>
          {run.breakBefore ? <br role="presentation" /> : null}
          <span className={run.className} style={run.style} role="presentation">
            {run.text}
          </span>
        </Fragment>
      ))}
      {element.children.map((child, i) => (
        <StructElementComponent
          key={i}
          element={child}
          scale={scale}
          parentLanguage={viewModel.nextParentLanguage}
          debug={debug}
        />
      ))}
    </Tag>
  );
}
