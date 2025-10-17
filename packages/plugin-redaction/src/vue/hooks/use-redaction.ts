import { ref, watchEffect, readonly } from 'vue';
import { useCapability, usePlugin } from '@embedpdf/core/vue';
import { RedactionPlugin, initialState, RedactionState } from '@embedpdf/plugin-redaction';

export const useRedactionPlugin = () => usePlugin<RedactionPlugin>(RedactionPlugin.id);
export const useRedactionCapability = () => useCapability<RedactionPlugin>(RedactionPlugin.id);

export const useRedaction = () => {
  const { provides } = useRedactionCapability();
  const state = ref<RedactionState>(initialState);

  watchEffect((onCleanup) => {
    if (!provides.value) return;

    const unsubscribe = provides.value.onStateChange((newState) => {
      state.value = newState;
    });
    onCleanup(unsubscribe);
  });

  return {
    state: readonly(state),
    provides,
  };
};
