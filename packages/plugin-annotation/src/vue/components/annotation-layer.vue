<template>
  <div>
    <Annotations v-bind="props">
      <template #selection-menu="slotProps">
        <slot name="selection-menu" v-bind="slotProps"></slot>
      </template>
      <template #resize-handle="slotProps">
        <slot name="resize-handle" v-bind="slotProps"></slot>
      </template>
      <template #vertex-handle="slotProps">
        <slot name="vertex-handle" v-bind="slotProps"></slot>
      </template>
    </Annotations>
    <TextMarkup :pageIndex="pageIndex" :scale="scale" />
    <AnnotationPaintLayer :pageIndex="pageIndex" :scale="scale" />
  </div>
</template>

<script setup lang="ts">
import Annotations from './annotations.vue';
import TextMarkup from './text-markup.vue';
import AnnotationPaintLayer from './annotation-paint-layer.vue';
import { ResizeHandleUI, VertexHandleUI } from '../types';

const props = defineProps<{
  pageIndex: number;
  scale: number;
  pageWidth: number;
  pageHeight: number;
  rotation: number;
  resizeUI?: ResizeHandleUI;
  vertexUI?: VertexHandleUI;
  selectionOutlineColor?: string;
}>();
</script>
