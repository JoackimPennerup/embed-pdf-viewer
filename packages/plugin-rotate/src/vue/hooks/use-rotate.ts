import { useCapability, usePlugin } from '@embedpdf/core/vue';
import { RotatePlugin } from '@embedpdf/plugin-rotate';
import { ref, watchEffect } from 'vue';
import { Rotation } from '@embedpdf/models';

/**
 * Hook to get the raw rotate plugin instance.
 */
export const useRotatePlugin = () => usePlugin<RotatePlugin>(RotatePlugin.id);

/**
 * Hook to get the rotate plugin's capability API.
 * This provides methods for rotating the document.
 */
export const useRotateCapability = () => useCapability<RotatePlugin>(RotatePlugin.id);

/**
 * Hook that provides reactive rotation state and methods.
 */
export const useRotate = () => {
  const { provides } = useRotateCapability();
  const rotation = ref<Rotation>(0);

  watchEffect((onCleanup) => {
    if (!provides.value) return;

    const unsubscribe = provides.value.onRotateChange((newRotation) => {
      rotation.value = newRotation;
    });
    onCleanup(unsubscribe);
  });

  return {
    rotation,
    provides,
  };
};
