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
    :viewBox="`0 0 ${geometry.width} ${geometry.height}`"
  >
    <ellipse
      :cx="geometry.cx"
      :cy="geometry.cy"
      :rx="geometry.rx"
      :ry="geometry.ry"
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

interface CircleProps {
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
}

const props = withDefaults(defineProps<CircleProps>(), {
  color: '#000000',
  opacity: 1,
  strokeStyle: PdfAnnotationBorderStyle.SOLID,
});

const geometry = computed(() => {
  const outerW = props.rect.size.width;
  const outerH = props.rect.size.height;
  const innerW = Math.max(outerW - props.strokeWidth, 0);
  const innerH = Math.max(outerH - props.strokeWidth, 0);

  return {
    width: outerW,
    height: outerH,
    cx: props.strokeWidth / 2 + innerW / 2,
    cy: props.strokeWidth / 2 + innerH / 2,
    rx: innerW / 2,
    ry: innerH / 2,
  };
});

const svgWidth = computed(() => geometry.value.width * props.scale);
const svgHeight = computed(() => geometry.value.height * props.scale);
</script>
