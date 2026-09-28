import EmbedPDF from '/embedpdf.js';

window.__cspViolations = [];
window.addEventListener('securitypolicyviolation', (event) => {
  window.__cspViolations.push({
    effectiveDirective: event.effectiveDirective,
    blockedURI: event.blockedURI,
  });
});

const target = document.getElementById('pdf-viewer');
if (!target) {
  throw new Error('Missing viewer target');
}

const viewer = EmbedPDF.init({
  type: 'container',
  target,
  src: '/demo.pdf',
  wasmUrl: '/pdfium.wasm',
  worker: false,
  fontFallback: null,
  fonts: { ui: null, signature: null },
  stamp: { manifests: [] },
  theme: { preference: 'light' },
});

viewer?.registry.then(() => {
  window.__viewerReady = true;
});
