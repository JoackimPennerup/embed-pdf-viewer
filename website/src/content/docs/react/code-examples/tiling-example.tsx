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
import { RenderLayer, RenderPluginPackage } from '@embedpdf/plugin-render/react' // A dependency for Tiling
import {
  useZoom,
  ZoomPluginPackage,
  ZoomMode,
} from '@embedpdf/plugin-zoom/react' // To demonstrate tiling

// Import Tiling plugin
import { TilingLayer, TilingPluginPackage } from '@embedpdf/plugin-tiling/react'

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
  createPluginRegistration(RenderPluginPackage), // Required for Tiling
  createPluginRegistration(ZoomPluginPackage, {
    defaultZoomLevel: ZoomMode.FitPage,
  }),
  createPluginRegistration(TilingPluginPackage, {
    tileSize: 768,
    overlapPx: 5,
  }),
]

// A simple zoom toolbar to demonstrate the tiling effect at high zoom
export const ZoomToolbar = () => {
  const { provides: zoom } = useZoom()
  if (!zoom) return null
  return (
    <div className="mb-4 mt-4 flex items-center gap-2 rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
      <button
        onClick={zoom.zoomOut}
        title="Zoom Out"
        className="flex h-8 w-8 items-center justify-center rounded-md border border-gray-300 bg-white text-gray-700 transition-colors duration-150 hover:bg-gray-50"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M5 12h14" />
        </svg>
      </button>
      <button
        onClick={zoom.zoomIn}
        title="Zoom In"
        className="flex h-8 w-8 items-center justify-center rounded-md border border-gray-300 bg-white text-gray-700 transition-colors duration-150 hover:bg-gray-50"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>
    </div>
  )
}

// 2. Create the main viewer component
export const PDFViewer = () => {
  const { engine, isLoading } = usePdfiumEngine()

  if (isLoading || !engine) {
    return <div>Loading PDF Engine...</div>
  }

  return (
    <div style={{ height: '500px' }}>
      <EmbedPDF engine={engine} plugins={plugins}>
        <div className="flex h-full flex-col">
          <ZoomToolbar />
          <div className="relative flex w-full flex-1 overflow-hidden">
            <Viewport className="flex-grow bg-gray-100">
              <Scroller
                renderPage={({ width, height, pageIndex, scale }) => (
                  <div style={{ width, height, position: 'relative' }}>
                    {/* Use the RenderLayer for immediate display */}
                    <RenderLayer pageIndex={pageIndex} scale={1} />
                    {/* Use the TilingLayer for optimized rendering */}
                    <TilingLayer pageIndex={pageIndex} scale={scale} />
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
