<script setup lang="ts">
import { useAnnotationCapability } from '@embedpdf/plugin-annotation/vue';
import type { TrackedAnnotation } from '@embedpdf/plugin-annotation';
import type { MenuWrapperProps } from '@embedpdf/utils/vue';
import type { Rect } from '@embedpdf/models';

interface AnnotationSelectionMenuProps {
  menuWrapperProps: MenuWrapperProps;
  annotation: TrackedAnnotation;
  rect: Rect;
}

const props = defineProps<AnnotationSelectionMenuProps>();

const { provides: annotation } = useAnnotationCapability();

const handleDelete = (e: Event) => {
  e.stopPropagation();
  if (!annotation.value) return;
  const { pageIndex, id } = props.annotation.object;
  annotation.value.deleteAnnotation(pageIndex, id);
};
</script>

<template>
  <span v-bind="menuWrapperProps">
    <v-card
      elevation="2"
      class="pa-1"
      :style="{
        position: 'absolute',
        top: `${rect.size.height + 8}px`,
        left: '0',
        zIndex: 1000,
        cursor: 'default',
        pointerEvents: 'auto',
      }"
    >
      <div class="d-flex align-center ga-1">
        <v-btn
          icon="mdi-delete-outline"
          size="small"
          variant="text"
          @click="handleDelete"
          aria-label="Delete annotation"
        />
      </div>
    </v-card>
  </span>
</template>

<style scoped>
.d-flex {
  display: flex;
}
.align-center {
  align-items: center;
}
.ga-1 {
  gap: 0.25rem;
}
</style>
