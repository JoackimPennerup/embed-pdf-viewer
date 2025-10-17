import { useCapability, usePlugin } from '@embedpdf/core/@framework';
import { initialState, RedactionPlugin, RedactionState } from '@embedpdf/plugin-redaction';
import { useState, useEffect } from '@framework';

export const useRedactionPlugin = () => usePlugin<RedactionPlugin>(RedactionPlugin.id);
export const useRedactionCapability = () => useCapability<RedactionPlugin>(RedactionPlugin.id);

export const useRedaction = () => {
  const { provides } = useRedactionCapability();
  const [state, setState] = useState<RedactionState>(initialState);

  useEffect(() => {
    return provides?.onStateChange((action) => {
      setState(action);
    });
  }, [provides]);

  return {
    state,
    provides,
  };
};
