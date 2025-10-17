<template>
  <svg
    :style="{
      position: 'absolute',
      width: `${width}px`,
      height: `${height}px`,
      pointerEvents: 'none',
      zIndex: 2,
      overflow: 'visible',
    }"
    :width="width"
    :height="height"
    :viewBox="`0 0 ${rect.size.width} ${rect.size.height}`"
  >
    <line
      :x1="localLine.x1"
      :y1="localLine.y1"
      :x2="localLine.x2"
      :y2="localLine.y2"
      :opacity="opacity"
      @pointerdown="onClick"
      @touchstart="onClick"
      :style="{
        cursor: isSelected ? 'move' : 'pointer',
        pointerEvents: isSelected ? 'none' : 'visibleStroke',
        stroke: strokeColor,
        strokeWidth: strokeWidth,
        strokeLinecap: 'butt',
        ...(strokeStyle === PdfAnnotationBorderStyle.DASHED && {
          strokeDasharray: strokeDashArray?.join(','),
        }),
      }"
    />
    <path
      v-if="endings.start"
      :d="endings.start.d"
      :transform="endings.start.transform"
      @pointerdown="onClick"
      @touchstart="onClick"
      :stroke="strokeColor"
      :style="getEndingStyle(endings.start)"
      :fill="endings.start.filled ? color : 'none'"
    />
    <path
      v-if="endings.end"
      :d="endings.end.d"
      :transform="endings.end.transform"
      @pointerdown="onClick"
      @touchstart="onClick"
      :stroke="strokeColor"
      :style="getEndingStyle(endings.end)"
      :fill="endings.end.filled ? color : 'none'"
    />
  </svg>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { Rect, LinePoints, LineEndings, PdfAnnotationBorderStyle } from '@embedpdf/models';
import { patching } from '@embedpdf/plugin-annotation';

const props = withDefaults(
  defineProps<{
    color?: string;
    opacity?: number;
    strokeWidth: number;
    strokeColor?: string;
    strokeStyle?: PdfAnnotationBorderStyle;
    strokeDashArray?: number[];
    rect: Rect;
    linePoints: LinePoints;
    lineEndings?: LineEndings;
    scale: number;
    onClick?: (e: PointerEvent | TouchEvent) => void;
    isSelected: boolean;
  }>(),
  {
    color: 'transparent',
    opacity: 1,
    strokeColor: '#000000',
    strokeStyle: PdfAnnotationBorderStyle.SOLID,
  },
);

const localLine = computed(() => ({
  x1: props.linePoints.start.x - props.rect.origin.x,
  y1: props.linePoints.start.y - props.rect.origin.y,
  x2: props.linePoints.end.x - props.rect.origin.x,
  y2: props.linePoints.end.y - props.rect.origin.y,
}));

const endings = computed(() => {
  const { x1, y1, x2, y2 } = localLine.value;
  const angle = Math.atan2(y2 - y1, x2 - x1);
  return {
    start: patching.createEnding(
      props.lineEndings?.start,
      props.strokeWidth,
      angle + Math.PI,
      x1,
      y1,
    ),
    end: patching.createEnding(props.lineEndings?.end, props.strokeWidth, angle, x2, y2),
  };
});

const getEndingStyle = (ending: patching.SvgEnding) => ({
  cursor: props.isSelected ? 'move' : 'pointer',
  strokeWidth: props.strokeWidth,
  strokeLinecap: 'butt' as 'butt',
  pointerEvents: (props.isSelected ? 'none' : ending.filled ? 'visible' : 'visibleStroke') as
    | 'none'
    | 'visible'
    | 'visibleStroke',
  ...(props.strokeStyle === PdfAnnotationBorderStyle.DASHED && {
    strokeDasharray: props.strokeDashArray?.join(','),
  }),
});

const width = computed(() => props.rect.size.width * props.scale);
const height = computed(() => props.rect.size.height * props.scale);
</script>
