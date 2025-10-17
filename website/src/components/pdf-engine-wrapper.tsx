'use client'

import { ReactNode } from 'react'
import { PdfEngineProvider, usePdfiumEngine } from '@embedpdf/engines/react'

interface PdfEngineWrapperProps {
  children: ReactNode
}

/**
 * Client component wrapper that handles PDF engine initialization
 * and provides it to the app via context.
 */
export function PdfEngineWrapper({ children }: PdfEngineWrapperProps) {
  const engineProps = usePdfiumEngine()

  return <PdfEngineProvider {...engineProps}>{children}</PdfEngineProvider>
}
