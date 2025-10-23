import type { StructElement as StructElementModel } from '@embedpdf/plugin-a11y';
import { getFontClassName } from '../../lib/utils';
import { useEffect, useRef } from 'react';
import { computeStructElementViewModel } from './struct-element-viewmodel';

interface Props {
  element: StructElementModel;
  scale: number;
  parentLanguage?: string;
}

export function StructElementComponent({ element, scale, parentLanguage }: Props) {
  const elementRef = useRef<HTMLElement>(null);

  const viewModel = computeStructElementViewModel(element, scale, parentLanguage);
  const Tag = viewModel.tagName as any;

  useEffect(() => {
    if (elementRef.current != null && !elementRef.current.closest('.embedpdf-a11y-layer')) {
      console.error('StructElementComponent must be rendered within an A11yLayer component.');
    }
  });

  return (
    <Tag {...viewModel.attrs} style={viewModel.elementStyle} data-pdftag={element.tag} ref={elementRef}>
      {viewModel.textRuns.map((run, i) => (
        <span
          key={i}
          className={(() => {
            const fontClass = getFontClassName(
              run.fontFamily,
              run.fontSize,
              run.fontWeight,
              run.fontItalic,
            );
            return fontClass ? `${fontClass} textrun` : 'textrun';
          })()}
          style={run.style}
          role="presentation"
        >
          {run.text}
        </span>
      ))}
      {element.children.map((child, i) => (
        <StructElementComponent
          key={i}
          element={child}
          scale={scale}
          parentLanguage={viewModel.nextParentLanguage}
        />
      ))}
    </Tag>
  );
}
