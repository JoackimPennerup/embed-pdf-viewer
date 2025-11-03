<script setup lang="ts">
import { computed, onMounted, ref, toRefs } from 'vue';
import type { StructElement } from '@embedpdf/plugin-a11y';
import { A11yLayerClassName } from '../../lib/utils';
import { computeStructElementViewModel } from '../../shared/components/struct-element-viewmodel';

defineOptions({ name: 'StructElementComponent' });

const props = defineProps<{
  element: StructElement;
  scale: number;
  parentLang?: string;
  debug?: boolean;
}>();
const { element, scale, parentLang, debug } = toRefs(props);

const viewModel = computed(() =>
  computeStructElementViewModel(element.value, scale.value, parentLang.value, debug.value ?? false),
);

const tagName = computed(() => viewModel.value.tagName as any);const runs = computed(() => viewModel.value.textRuns);

const nextParentLang = computed(() => viewModel.value.nextParentLanguage);
const rootEl = ref<HTMLElement | null>(null);

onMounted(() => {
  if (rootEl.value && !rootEl.value.closest('.' + A11yLayerClassName)) {
    console.error('StructElementComponent must be rendered within an A11yLayer component.');
  }
});
</script>

<template>
  <component
    :is="tagName"
    v-bind="viewModel.attrs"
    :style="viewModel.elementStyle"
    ref="rootEl"
  >
    <span
      v-for="(run, i) in runs"
      :key="i"
      :class="run.className"
      :style="run.style"
      role="presentation"
    >
      {{ run.text }}
    </span>
    <StructElementComponent
      v-for="(child, index) in element.children"
      :key="index"
      :element="child"
      :scale="scale"
      :parent-lang="nextParentLang"
      :debug="debug"
    />
  </component>
</template>

