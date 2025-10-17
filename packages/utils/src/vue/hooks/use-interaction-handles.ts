import { computed, type CSSProperties } from 'vue';
import { useDragResize, type UseDragResizeOptions } from './use-drag-resize';
import {
  describeResizeFromConfig,
  describeVerticesFromConfig,
  type ResizeUI,
  type VertexUI,
} from '../../shared/plugin-interaction-primitives/utils';
import type { Position, Rect } from '@embedpdf/models';
import { norm, rectDTO, vertsDTO } from '../utils/interaction-normalize';

export type HandleElementProps = {
  key: string | number;
  style: CSSProperties;
  onPointerdown: (e: PointerEvent) => void;
  onPointermove: (e: PointerEvent) => void;
  onPointerup: (e: PointerEvent) => void;
  onPointercancel: (e: PointerEvent) => void;
} & Record<string, any>;

export interface UseInteractionHandlesOptions {
  controller: UseDragResizeOptions; // may contain refs
  resizeUI?: ResizeUI;
  vertexUI?: VertexUI;
  includeVertices?: boolean;
  handleAttrs?: (
    h: 'nw' | 'ne' | 'sw' | 'se' | 'n' | 'e' | 's' | 'w',
  ) => Record<string, any> | void;
  vertexAttrs?: (i: number) => Record<string, any> | void;
}

export function useInteractionHandles(opts: UseInteractionHandlesOptions) {
  const {
    controller,
    resizeUI,
    vertexUI,
    includeVertices = false,
    handleAttrs,
    vertexAttrs,
  } = opts;

  // Owns live interaction handlers
  const { dragProps, createResizeProps, createVertexProps } = useDragResize(controller);

  // Plain snapshots for the *descriptor* helpers
  const elementPlain = computed<Rect>(() => rectDTO(norm(controller.element)));
  const verticesPlain = computed<Position[] | undefined>(() =>
    controller.vertices ? vertsDTO(norm(controller.vertices)) : undefined,
  );
  const scalePlain = computed<number>(() => Number(norm(controller.scale ?? 1)));
  const rotationPlain = computed<number>(() => Number(norm(controller.pageRotation ?? 0)));
  const maintainPlain = computed<boolean | undefined>(() =>
    controller.maintainAspectRatio === undefined
      ? undefined
      : Boolean(norm(controller.maintainAspectRatio)),
  );
  const constraintsPlain = computed(() => norm(controller.constraints ?? undefined));

  const resize = computed<HandleElementProps[]>(() => {
    const desc = describeResizeFromConfig(
      {
        element: elementPlain.value,
        scale: scalePlain.value,
        pageRotation: rotationPlain.value,
        maintainAspectRatio: maintainPlain.value,
        constraints: constraintsPlain.value,
      },
      resizeUI,
    );
    return desc.map((d) => ({
      key: (d.attrs?.['data-epdf-handle'] as string) ?? d.handle,
      style: d.style as CSSProperties,
      ...createResizeProps(d.handle),
      ...(d.attrs ?? {}),
      ...(handleAttrs?.(d.handle) ?? {}),
    }));
  });

  const vertices = computed<HandleElementProps[]>(() => {
    if (!includeVertices) return [];
    const verts = verticesPlain.value ?? [];
    const desc = describeVerticesFromConfig(
      { element: elementPlain.value, scale: scalePlain.value, vertices: verts },
      vertexUI,
      verts,
    );
    return desc.map((d, i) => ({
      key: i,
      style: d.style as CSSProperties,
      ...createVertexProps(i),
      ...(d.attrs ?? {}),
      ...(vertexAttrs?.(i) ?? {}),
    }));
  });

  return { dragProps, resize, vertices };
}
