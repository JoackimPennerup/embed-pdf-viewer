import { createCapabilityToken } from '@embedpdf/core';

import type { A11yCapability } from './contract';

export const A11yToken = createCapabilityToken<A11yCapability>('a11y', {
  hint: `add a11yPlugin() from '@embedpdf/plugin-a11y' to your plugins list`,
});
