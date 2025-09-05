<script setup lang="ts">
import { ref, watchEffect, toRefs } from 'vue';
import type { StructElement } from '@embedpdf/plugin-a11y';
import { useA11yCapability } from '../hooks';

const props = defineProps<{ pageIndex: number; scale: number }>();
const { pageIndex, scale } = toRefs(props);

const { provides } = useA11yCapability();
const elements = ref<StructElement[]>([]);

watchEffect(() => {
  if (!provides.value) {
    elements.value = [];
    return;
  }
  provides.value
    .getStructElements(pageIndex.value)
    .then((els) => (elements.value = els))
    .catch(() => (elements.value = []));
});
</script>

<template>
  <div v-if="elements.length" style="position: absolute; left: 0; top: 0">
    <component
      v-for="(el, i) in elements"
      :is="el.htmlTag"
      :key="i"
      :style="{
        position: 'absolute',
        left: el.rect.origin.x * scale + 'px',
        top: el.rect.origin.y * scale + 'px',
        width: el.rect.size.width * scale + 'px',
        height: el.rect.size.height * scale + 'px'
      }"
      :role="el.attributes?.role"
      :aria-label="el.text"
    >
      {{ el.text }}
    </component>
  </div>
</template>
