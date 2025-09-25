<script setup lang="ts">
import { toRefs } from 'vue';
import type { StructElement } from '@embedpdf/plugin-a11y';

  const props = defineProps<{ 
    element: StructElement;  
    scale: number;  
    parentLang?: string; 
  }>();
  const { element, scale, parentLang } = toRefs(props);
  const Tag = (element.value.htmlTag || 'span') as any;
  
  const attrs: Record<string, string> = { ...(element.value.attributes || {}) };
  if (element.value.language && element.value.language !== parentLang.value) {
    attrs.lang = element.value.language;
  }

  const style = {
    left: element.value.rect.origin.x * scale.value || undefined,
    top: element.value.rect.origin.y * scale.value || undefined,
    width: element.value.rect.size.width * scale.value || undefined,
    height: element.value.rect.size.height * scale.value || undefined,
  };

</script>

<template>
  <component
    :is="Tag"
    :style="style"
    :attrs="attrs"  >
    {{ element.text }}
  </component>
</template>
