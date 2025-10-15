<script setup lang="ts">
import { onBeforeUnmount, ref, shallowRef, watch, watchEffect } from 'vue';
import type { StyleValue } from 'vue';

import { createTilingCanvasController } from '../../shared/controllers/tiling-canvas';
import { useTilingCapability, useTilingPlugin } from '../hooks';

interface Props {
  pageIndex: number;
  scale: number;
  style?: StyleValue;
}

const props = defineProps<Props>();

const canvasRef = ref<HTMLCanvasElement | null>(null);
const controller = shallowRef(createTilingCanvasController({ pageIndex: props.pageIndex }));

const { provides: tilingCapability } = useTilingCapability();
const { plugin: tilingPlugin } = useTilingPlugin();

watch(
  () => props.pageIndex,
  (nextPage, previousPage) => {
    if (nextPage === previousPage) return;
    const previous = controller.value;
    const nextController = createTilingCanvasController({ pageIndex: nextPage });

    controller.value = nextController;

    nextController.setDependencies({
      capability: tilingCapability.value,
      plugin: tilingPlugin.value,
    });
    nextController.setScale(props.scale);
    if (canvasRef.value) {
      nextController.setCanvas(canvasRef.value);
    }

    previous.destroy();
  },
);

watchEffect(() => {
  controller.value.setDependencies({
    capability: tilingCapability.value,
    plugin: tilingPlugin.value,
  });
});

watchEffect(() => {
  controller.value.setScale(props.scale);
});

watchEffect((onCleanup) => {
  const instance = controller.value;
  instance.setCanvas(canvasRef.value ?? null);
  onCleanup(() => {
    instance.setCanvas(null);
  });
});

onBeforeUnmount(() => {
  controller.value.destroy();
});

const canvasStyle = {
  position: 'absolute',
  inset: '0',
  width: '100%',
  height: '100%',
  display: 'block',
  pointerEvents: 'none',
} as const;
</script>

<template>
  <div :style="[{ position: 'relative' }, style]" v-bind="$attrs">
    <canvas ref="canvasRef" :style="canvasStyle" />
  </div>
</template>
