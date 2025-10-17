<template>
  <div
    v-for="(b, i) in segmentRects"
    :key="i"
    @pointerdown="onClick"
    @touchstart="onClick"
    :style="{
      position: 'absolute',
      left: `${(rect ? b.origin.x - rect.origin.x : b.origin.x) * scale}px`,
      top: `${(rect ? b.origin.y - rect.origin.y : b.origin.y) * scale}px`,
      width: `${b.size.width * scale}px`,
      height: `${b.size.height * scale}px`,
      background: color,
      opacity: opacity,
      pointerEvents: onClick ? 'auto' : 'none',
      cursor: onClick ? 'pointer' : 'default',
      zIndex: onClick ? 1 : undefined,
    }"
  ></div>
</template>

<script setup lang="ts">
import { Rect } from '@embedpdf/models';

withDefaults(
  defineProps<{
    color?: string;
    opacity?: number;
    segmentRects: Rect[];
    rect?: Rect;
    scale: number;
    onClick?: (e: PointerEvent | TouchEvent) => void;
  }>(),
  {
    color: '#FFFF00',
    opacity: 0.5,
  },
);
</script>
