<script setup lang="ts">
import { computed, onMounted, ref, toRefs } from 'vue';
import type { StructElement } from '@embedpdf/plugin-a11y';
import { getFontClassName } from '../../lib/utils';
import { computeStructElementViewModel } from '../../shared/components/struct-element-viewmodel';

defineOptions({ name: 'StructElementComponent' });

const props = defineProps<{
  element: StructElement;
  scale: number;
  parentLang?: string;
}>();
const { element, scale, parentLang } = toRefs(props);

const viewModel = computed(() =>
  computeStructElementViewModel(element.value, scale.value, parentLang.value),
);

const tagName = computed(() => viewModel.value.tagName as any);

const runs = computed(() =>
  viewModel.value.textRuns.map((run) => {
    const baseClass = getFontClassName(run.fontFamily, run.fontSize, run.fontWeight, run.fontItalic);
    return {
      ...run,
      className: baseClass ? `${baseClass} textrun` : 'textrun',
    };
  }),
);

const nextParentLang = computed(() => viewModel.value.nextParentLanguage);

const rootEl = ref<HTMLElement | null>(null);

onMounted(() => {
  if (rootEl.value && !rootEl.value.closest('.embedpdf-a11y-layer')) {
    console.error('StructElementComponent must be rendered within an A11yLayer component.');
  }
});
</script>

<template>
  <component
    :is="tagName"
    v-bind="viewModel.attrs"
    :style="viewModel.elementStyle"
    :data-pdftag="element.tag"
    ref="rootEl"
  >
    <span
      v-for="(run, i) in runs"
      :key="i"
      :class="run.className"
      :style="run.style"
    >
      {{ run.text }}
    </span>
    <StructElementComponent
      v-for="(child, index) in element.children"
      :key="index"
      :element="child"
      :scale="scale"
      :parent-lang="nextParentLang"
    />
  </component>
</template>
