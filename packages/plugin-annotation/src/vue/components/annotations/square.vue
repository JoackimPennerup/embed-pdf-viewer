<template>
  <svg
    :style="{
      position: 'absolute',
      width: svgWidth,
      height: svgHeight,
      pointerEvents: 'none',
      zIndex: 2,
    }"
    :width="svgWidth"
    :height="svgHeight"
    :viewBox="`0 0 ${geometry.width + strokeWidth} ${geometry.height + strokeWidth}`"
  >
    <rect
      :x="geometry.x"
      :y="geometry.y"
      :width="geometry.width"
      :height="geometry.height"
      :fill="color"
      :opacity="opacity"
      @pointerdown="onClick"
      @touchstart="onClick"
      :style="{
        cursor: isSelected ? 'move' : 'pointer',
        pointerEvents: isSelected ? 'none' : color === 'transparent' ? 'visibleStroke' : 'visible',
        stroke: strokeColor ?? color,
        strokeWidth: strokeWidth,
        ...(strokeStyle === PdfAnnotationBorderStyle.DASHED && {
          strokeDasharray: strokeDashArray?.join(','),
        }),
      }"
    />
  </svg>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { PdfAnnotationBorderStyle, Rect } from '@embedpdf/models';

const props = withDefaults(
  defineProps<{
    isSelected: boolean;
    color?: string;
    strokeColor?: string;
    opacity?: number;
    strokeWidth: number;
    strokeStyle?: PdfAnnotationBorderStyle;
    strokeDashArray?: number[];
    rect: Rect;
    scale: number;
    onClick?: (e: PointerEvent | TouchEvent) => void;
  }>(),
  {
    color: '#000000',
    opacity: 1,
    strokeStyle: PdfAnnotationBorderStyle.SOLID,
  },
);

const geometry = computed(() => {
  const outerW = props.rect.size.width;
  const outerH = props.rect.size.height;
  const innerW = Math.max(outerW - props.strokeWidth, 0);
  const innerH = Math.max(outerH - props.strokeWidth, 0);

  return {
    width: innerW,
    height: innerH,
    x: props.strokeWidth / 2,
    y: props.strokeWidth / 2,
  };
});

const svgWidth = computed(() => (geometry.value.width + props.strokeWidth) * props.scale);
const svgHeight = computed(() => (geometry.value.height + props.strokeWidth) * props.scale);
</script>
