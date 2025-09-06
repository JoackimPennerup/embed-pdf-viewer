'use client'

import { createPluginRegistration } from '@embedpdf/core'
import { EmbedPDF } from '@embedpdf/core/react'
import { usePdfiumEngine } from '@embedpdf/engines/react'

// Import essential plugins
import {
  Viewport,
  ViewportPluginPackage,
} from '@embedpdf/plugin-viewport/react'
import { Scroller, ScrollPluginPackage } from '@embedpdf/plugin-scroll/react'
import { LoaderPluginPackage } from '@embedpdf/plugin-loader/react'
import { RenderLayer, RenderPluginPackage } from '@embedpdf/plugin-render/react'

// Import Export plugin
import {
  useExportCapability,
  ExportPluginPackage,
} from '@embedpdf/plugin-export/react'

// 1. Register the plugins you need
const plugins = [
  createPluginRegistration(LoaderPluginPackage, {
    loadingOptions: {
      type: 'url',
      pdfFile: {
        id: 'example-pdf',
        url: 'https://snippet.embedpdf.com/ebook.pdf',
      },
    },
  }),
  createPluginRegistration(ViewportPluginPackage),
  createPluginRegistration(ScrollPluginPackage),
  createPluginRegistration(RenderPluginPackage),
  createPluginRegistration(ExportPluginPackage, {
    // Optional: Set a fallback filename for the download
    defaultFileName: 'downloaded-ebook.pdf',
  }),
]

// 2. Create a toolbar with a Download button
export const ExportToolbar = () => {
  const { provides: exportApi } = useExportCapability()

  return (
    <div className="mb-4 mt-4 flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
      <button
        className="flex h-8 w-8 items-center justify-center rounded-md border border-gray-300 bg-white text-gray-700 transition-colors duration-150 hover:border-gray-400 hover:bg-gray-50 hover:text-gray-900 active:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
        onClick={() => exportApi?.download()}
        disabled={!exportApi}
        title="Download PDF"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          {' '}
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />{' '}
          <polyline points="7 10 12 15 17 10" />{' '}
          <line x1="12" y1="15" x2="12" y2="3" />{' '}
        </svg>
      </button>
    </div>
  )
}

// 3. Create the main viewer component
export const PDFViewer = () => {
  const { engine, isLoading } = usePdfiumEngine()

  if (isLoading || !engine) {
    return <div>Loading PDF Engine...</div>
  }

  return (
    <div style={{ height: '500px' }}>
      <EmbedPDF engine={engine} plugins={plugins}>
        <div className="flex h-full flex-col">
          <ExportToolbar />
          <div className="flex-grow" style={{ position: 'relative' }}>
            <Viewport
              style={{
                backgroundColor: '#f1f3f5',
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
              }}
            >
              <Scroller
                renderPage={({ width, height, pageIndex, scale }) => (
                  <div style={{ width, height, position: 'relative' }}>
                    <RenderLayer pageIndex={pageIndex} scale={scale} />
                  </div>
                )}
              />
            </Viewport>
          </div>
        </div>
      </EmbedPDF>
    </div>
  )
}
