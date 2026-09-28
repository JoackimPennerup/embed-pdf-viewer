import { definePlugin } from '@embedpdf/core';

import type { A11yCapability, A11yConfig } from './contract';
import { createA11yController } from './controller';
import { A11yToken } from './token';

export const a11yPlugin = (config: A11yConfig = {}) =>
  definePlugin<null, { type: 'noop' }, A11yCapability>({
    id: 'a11y',
    token: A11yToken,
    scope: 'document',
    initialState: () => null,
    reduce: (state) => state,
    create: (ctx) => ({ api: createA11yController(ctx, config) }),
  });
