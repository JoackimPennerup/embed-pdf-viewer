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

// Import Spread plugin
import {
  useSpread,
  SpreadPluginPackage,
  SpreadMode,
} from '@embedpdf/plugin-spread/react'
import { ZoomMode, ZoomPluginPackage } from '@embedpdf/plugin-zoom/preact'

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
  createPluginRegistration(ZoomPluginPackage, {
    defaultZoomLevel: ZoomMode.FitPage,
  }),
  createPluginRegistration(SpreadPluginPackage, {
    // Optional: Set the initial spread mode
    defaultSpreadMode: SpreadMode.None,
  }),
]

// 2. Create a toolbar to control the spread mode
export const SpreadToolbar = () => {
  const { provides: spread, spreadMode } = useSpread()

  if (!spread) {
    return null
  }

  const modes = [
    { label: 'Single Page', value: SpreadMode.None },
    { label: 'Two-Page (Odd)', value: SpreadMode.Odd },
    { label: 'Two-Page (Even)', value: SpreadMode.Even },
  ]

  return (
    <div className="mb-4 mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
      <span className="tracking-wide text-xs font-medium uppercase text-gray-600">
        Page Layout
      </span>
      <div className="h-6 w-px bg-gray-200"></div>
      <div className="flex items-center gap-2">
        {modes.map((mode) => (
          <button
            key={mode.value}
            onClick={() => spread.setSpreadMode(mode.value)}
            className={`rounded-md px-3 py-1 text-sm font-medium transition-colors duration-150 ${
              spreadMode === mode.value
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {mode.label}
          </button>
        ))}
      </div>
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
          <SpreadToolbar />
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
              {/* The Scroller component automatically adapts to the spread mode */}
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
