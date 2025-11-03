import { A11yLayerClassName } from './constants';

export const A11Y_BASE_STYLES = `
  .${A11yLayerClassName}, .${A11yLayerClassName} * {
    pointer-events: none;
    position: absolute;
    top: 0;
    left: 0;
    font-family: Sans-Serif;
  }
  .${A11yLayerClassName} * {
    white-space: pre;
    font-kerning: none;
  }
  .${A11yLayerClassName} .textrun {
    overflow: visible;
    display: inline-block;
    overflow: hidden;
  }
`;

export const a11yStyleSheet = new CSSStyleSheet();
a11yStyleSheet.replaceSync(A11Y_BASE_STYLES);

export function resetA11yStyleSheet(): void {
  a11yStyleSheet.replaceSync(A11Y_BASE_STYLES);
}
