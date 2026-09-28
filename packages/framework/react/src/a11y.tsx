/** Semantic, visually transparent page text for assistive technology. */
export * from '@embedpdf/plugin-a11y';

import {
  A11yToken,
  buildFontFamilyStack,
  computeScaleX,
  semanticHtmlForNode,
  type A11yHtmlNode,
  type A11yHtmlTextLine,
  type A11yHtmlTextRun,
  type A11yPageData,
} from '@embedpdf/plugin-a11y';
import * as React from 'react';
import { useEffect, useState } from 'react';

import { useCapability, usePage, useSelector } from './runtime';

type TextFragment = A11yHtmlTextLine | A11yHtmlTextRun;
type ToPixels = (point: { x: number; y: number }) => { x: number; y: number };

let measureContext: CanvasRenderingContext2D | null = null;

function horizontalScale(fragment: TextFragment, fontSize: number, width: number): number {
  if (!fragment.text || width <= 0 || typeof document === 'undefined') return 1;
  try {
    measureContext ??= document.createElement('canvas').getContext('2d');
    if (!measureContext) return 1;
    measureContext.font = [
      fragment.font?.italic ? 'italic' : '',
      fragment.font?.weight || '',
      `${fontSize}px`,
      buildFontFamilyStack(fragment.font?.family),
    ]
      .filter(Boolean)
      .join(' ');
    const measured = measureContext.measureText(fragment.text).width;
    return computeScaleX(width, measured);
  } catch {
    return 1;
  }
}

function Fragment({ fragment, toPixels }: { fragment: TextFragment; toPixels: ToPixels }) {
  const origin = toPixels({ x: fragment.left, y: fragment.top });
  const size = Math.max(toPixels({ x: 0, y: fragment.fontHeight }).y, 1);
  const width = Math.max(toPixels({ x: fragment.width, y: 0 }).x, 1);
  const family = buildFontFamilyStack(fragment.font?.family);
  return (
    <span
      role="presentation"
      dir={fragment.dir}
      style={{
        position: 'absolute',
        left: origin.x,
        top: origin.y,
        transformOrigin: '0 0',
        transform: `rotate(${fragment.rotation ?? 0}deg) scaleX(${horizontalScale(fragment, size, width)})`,
        fontSize: size,
        fontFamily: family,
        fontWeight: fragment.font?.weight,
        fontStyle: fragment.font?.italic ? 'italic' : undefined,
        color: 'transparent',
        whiteSpace: 'pre',
        lineHeight: 1,
        pointerEvents: 'none',
        userSelect: 'text',
        WebkitUserSelect: 'text',
      }}
    >
      {fragment.text}
    </span>
  );
}

function SemanticNode({
  node,
  toPixels,
  parent,
  debug,
}: {
  node: A11yHtmlNode;
  toPixels: ToPixels;
  parent?: string;
  debug: boolean;
}) {
  const { tagName: tag, role, ariaLevel, ariaLabel } = semanticHtmlForNode(node, parent);
  const fragments = node.textLines.length ? node.textLines : node.textRuns;
  const ordered = node.content?.map((entry, i) => {
    if (entry.kind === 'text') {
      const run = node.textRuns[entry.runIndex];
      return run ? <Fragment key={`text-${i}`} fragment={run} toPixels={toPixels} /> : null;
    }
    const child = node.children[entry.childIndex];
    return child ? (
      <SemanticNode
        key={`child-${i}`}
        node={child}
        toPixels={toPixels}
        parent={tag ?? parent}
        debug={debug}
      />
    ) : null;
  });
  const children = (
    <>
      {debug && node.rect && (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: toPixels(node.rect.origin).x,
            top: toPixels(node.rect.origin).y,
            width: toPixels({ x: node.rect.size.width, y: 0 }).x,
            height: toPixels({ x: 0, y: node.rect.size.height }).y,
            outline: '1px solid rgba(255, 105, 180, 0.45)',
            pointerEvents: 'none',
          }}
        />
      )}
      {ordered ?? (
        <>
          {fragments.map((fragment, i) => (
            <React.Fragment key={i}>
              <Fragment fragment={fragment} toPixels={toPixels} />
              {node.textLines.length > 0 && i < fragments.length - 1 && <br role="presentation" />}
            </React.Fragment>
          ))}
          {node.children.map((child, i) => (
            <SemanticNode
              key={`${child.markedContentId ?? child.tag}-${i}`}
              node={child}
              toPixels={toPixels}
              parent={tag ?? parent}
              debug={debug}
            />
          ))}
        </>
      )}
    </>
  );
  if (!tag) return children;
  return React.createElement(
    tag,
    {
      lang: node.language,
      role,
      'aria-level': ariaLevel,
      'aria-label': ariaLabel,
      'data-pdf-tag': node.tag,
      style: {
        position: 'absolute',
        inset: 0,
        margin: 0,
        padding: 0,
        border: 0,
        background: 'transparent',
        color: 'transparent',
        display: 'block',
        listStyle: 'none',
        pointerEvents: 'none',
      },
    },
    children,
  );
}

/** Place after the raster and before selection/annotation layers inside a Stage page. */
export function A11yLayer() {
  const page = usePage();
  const a11y = useCapability(A11yToken);
  const canRead = useSelector(A11yToken, (capability) => capability.canRead());
  const [data, setData] = useState<A11yPageData | null>(null);

  useEffect(() => {
    let active = true;
    setData(null);
    if (!canRead) return;
    a11y.getPageData(page.ref).then(
      (value) => {
        if (active) setData(value);
      },
      () => {
        if (active) setData(null);
      },
    );
    return () => {
      active = false;
    };
  }, [a11y, canRead, page.ref]);

  if (!canRead || !data?.elements.length) return null;
  return (
    <div
      data-mode={data.mode}
      className={a11y.getClassNames()}
      style={{
        position: 'absolute',
        inset: 0,
        width: page.transform.contentWidth,
        height: page.transform.contentHeight,
        overflow: 'hidden',
        pointerEvents: 'none',
        userSelect: 'text',
        WebkitUserSelect: 'text',
      }}
    >
      {data.elements.map((node, i) => (
        <SemanticNode
          key={`${node.markedContentId ?? node.tag}-${i}`}
          node={node}
          toPixels={page.transform.toPixels}
          debug={a11y.getDebugState()}
        />
      ))}
    </div>
  );
}
