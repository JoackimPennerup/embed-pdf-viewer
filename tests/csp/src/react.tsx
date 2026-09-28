import './violations';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { PDFViewer } from '@embedpdf/react-pdf-viewer';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <PDFViewer
      config={{
        src: '/demo.pdf',
        wasmUrl: '/pdfium.wasm',
        worker: false,
        fontFallback: null,
        fonts: { ui: null, signature: null },
        stamp: { manifests: [] },
        theme: { preference: 'light' },
      }}
      style={{ width: '100%', height: '100%' }}
      onReady={() => {
        window.__viewerReady = true;
      }}
    />
  </React.StrictMode>,
);
