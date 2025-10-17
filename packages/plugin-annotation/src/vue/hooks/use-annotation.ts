import { readonly, ref, watchEffect } from 'vue';
import { useCapability, usePlugin } from '@embedpdf/core/vue';
import { AnnotationPlugin, AnnotationState, initialState } from '@embedpdf/plugin-annotation';
import { AnnotationPluginConfig } from '../../lib';

export const useAnnotationPlugin = () => usePlugin<AnnotationPlugin>(AnnotationPlugin.id);
export const useAnnotationCapability = () => useCapability<AnnotationPlugin>(AnnotationPlugin.id);

export const useAnnotation = () => {
  const { provides } = useAnnotationCapability();
  // We need to provide a dummy config to initialState
  const dummyConfig: AnnotationPluginConfig = { enabled: true };
  const state = ref<AnnotationState>(initialState(dummyConfig));

  watchEffect((onCleanup) => {
    if (provides.value) {
      const unsubscribe = provides.value.onStateChange((newState) => {
        state.value = newState;
      });
      onCleanup(unsubscribe);
    }
  });

  return {
    state: readonly(state),
    provides,
  };
};
