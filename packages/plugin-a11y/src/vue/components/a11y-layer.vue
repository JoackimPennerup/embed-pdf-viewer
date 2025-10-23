<script setup lang="ts">
import { ref, watchEffect, toRefs, useTemplateRef } from 'vue';
import type { StructElement } from '@embedpdf/plugin-a11y';
import { useA11yCapability } from '../hooks';
import { A11yLayerClassName, adoptA11yLayerStyleSheet } from '../../lib/utils';
import StructElementComponent from './struct-element-component.vue';

const props = defineProps<{ pageIndex: number; scale: number }>();
const { pageIndex, scale } = toRefs(props);

const { provides } = useA11yCapability();
const elements = ref<StructElement[]>([]);
const layerRef = useTemplateRef('layer');

watchEffect(() => {
  if (!provides.value) {
    elements.value = [];
    return;
  }
  provides.value
    .getStructElements(pageIndex.value)
    .then((els) => (elements.value = els))
    .catch(() => (elements.value = []));

  if (layerRef.value != null) {
    const rootNode = layerRef.value.getRootNode();
    const host = rootNode instanceof ShadowRoot ? rootNode : document;
    adoptA11yLayerStyleSheet(host);
    layerRef.value.className = provides.value.getClassNames();
  }
});
</script>

<template>
  <div
    v-if="elements.length"
    ref="layer"
    class="{A11yLayerClassName}"
    :style="{ '--scale': scale}"
  >
    <StructElementComponent
      v-for="(el, i) in elements"
      :key="i"
      :element="el"
      :scale="scale"
    />
  </div>
</template>
