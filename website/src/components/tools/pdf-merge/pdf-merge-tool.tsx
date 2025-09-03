'use client'

import React, { useEffect, useState } from 'react'
import { DragEndEvent } from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'
import { DocumentPage, DocumentWithPages, MergeDocPage } from './types'
import { openPdfDocument, mergePdfPages, closePdfDocument } from './pdf-engine'
import { DocumentView } from './document-view'
import { MergeView } from './merge-view'
import { MergeResult } from './merge-result'
import { useEngine } from '@embedpdf/engines/react'
import { ToolLayout } from '../shared/tool-layout'
import { FilePicker } from '../shared/file-picker'
import { LoadingState } from '../shared/loading-state'

export const PdfMergeTool = () => {
  const engine = useEngine()
  const [docs, setDocs] = useState<Record<string, DocumentWithPages>>({})
  const [mergePages, setMergePages] = useState<MergeDocPage[]>([])
  const [isMerging, setIsMerging] = useState(false)
  const [mergedPdf, setMergedPdf] = useState<string | null>(null)

  useEffect(() => {
    // Cleanup on unmount
    return () => {
      if (engine) {
        engine.closeAllDocuments()
      }
    }
  }, [engine])

  // Handle file upload
  const handleFileUpload = async (files: File[]) => {
    if (!engine || !files.length) return

    for (const file of files) {
      const arrayBuffer = await file.arrayBuffer()

      try {
        // Open the document
        const doc = await openPdfDocument(engine, arrayBuffer)

        // Initialize pages array for this document
        const pages: DocumentPage[] = Array.from(
          { length: doc.pages.length },
          (_, i) => ({
            docId: doc.id,
            pageIndex: i,
            selected: false,
          }),
        )

        // Add the document to state
        setDocs((prevDocs) => ({
          ...prevDocs,
          [doc.id]: { doc, pages },
        }))
      } catch (error) {
        console.error('Error opening PDF:', error)
      }
    }
  }

  // New consolidated update handler
  const handleUpdatePages = (docId: string, updates: DocumentPage[]) => {
    setDocs((prevDocs) => {
      if (!prevDocs[docId]) return prevDocs

      const docPages = [...prevDocs[docId].pages]

      // Apply all updates in a single pass
      updates.forEach((update) => {
        const pageIndex = docPages.findIndex(
          (p) => p.pageIndex === update.pageIndex,
        )
        if (pageIndex !== -1) {
          docPages[pageIndex] = {
            ...docPages[pageIndex],
            ...update,
            // Preserve the docId to prevent accidental changes
            docId: docPages[pageIndex].docId,
          }
        }
      })

      return {
        ...prevDocs,
        [docId]: {
          ...prevDocs[docId],
          pages: docPages,
        },
      }
    })
  }

  // Add selected pages to the merge document
  const addSelectedPages = () => {
    const selectedPages: MergeDocPage[] = []
    let pagesToDeselect: DocumentPage[] = []

    Object.values(docs).forEach(({ doc, pages }) => {
      pages.forEach((page) => {
        if (page.selected) {
          selectedPages.push({
            id: `${doc.id}-${page.pageIndex}-${Date.now()}`,
            docId: doc.id,
            pageIndex: page.pageIndex,
            thumbnail: page.thumbnail,
          })

          // Collect pages to deselect
          pagesToDeselect.push(page)
        }
      })
    })

    // Add selected pages to merge list
    if (selectedPages.length > 0) {
      setMergePages((prevPages) => [...prevPages, ...selectedPages])

      // Deselect all pages that were added
      pagesToDeselect.forEach((page) => {
        handleUpdatePages(page.docId, [
          {
            ...page,
            selected: false,
          },
        ])
      })
    }
  }

  // Remove a page from the merge document
  const removePage = (id: string) => {
    setMergePages((prevPages) => prevPages.filter((page) => page.id !== id))
  }

  // Handle drag end for reordering pages
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      setMergePages((pages) => {
        const oldIndex = pages.findIndex((page) => page.id === active.id)
        const newIndex = pages.findIndex((page) => page.id === over.id)

        return arrayMove(pages, oldIndex, newIndex)
      })
    }
  }

  // Merge PDFs
  const mergePDFs = async () => {
    if (!engine || mergePages.length === 0) return

    setIsMerging(true)

    try {
      // Create merge configurations
      const mergeConfigs = mergePages.map((page) => ({
        docId: page.docId,
        pageIndices: [page.pageIndex],
      }))

      // Merge the PDFs
      const result = await mergePdfPages(engine, mergeConfigs)

      // Convert the merged PDF to a data URL for download
      const blob = new Blob([result.content], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)

      setMergedPdf(url)
    } catch (error) {
      console.error('Error merging PDFs:', error)
    } finally {
      setIsMerging(false)
    }
  }

  // Reset the tool
  const resetTool = () => {
    // Close and clean up all open documents
    Object.values(docs).forEach(({ doc }) => {
      if (engine) {
        engine.closeDocument(doc)
      }
    })

    setDocs({})
    setMergePages([])
    setMergedPdf(null)
  }

  const handleCloseDocument = async (docId: string) => {
    if (!engine) return

    // Get the document before removing it from state
    const docToClose = docs[docId]
    if (!docToClose) return
    // Close the document in the engine
    await closePdfDocument(engine, docToClose.doc)

    // Update state atomically
    setDocs((prevDocs) => {
      const { [docId]: _, ...remainingDocs } = prevDocs
      return remainingDocs
    })

    // Remove pages from merge list
    setMergePages((prevPages) =>
      prevPages.filter((page) => page.docId !== docId),
    )
  }

  return (
    <ToolLayout
      title="Merge PDFs"
      subtitle="right in your browser"
      description="Securely combine PDFs with complete privacy"
      badgeText="PDF Merge Tool"
      badgeColor="border-purple-200 bg-purple-50 text-purple-800"
      gradientColor="from-purple-600 to-blue-700"
    >
      {!engine ? (
        <LoadingState />
      ) : mergedPdf ? (
        <MergeResult mergedPdfUrl={mergedPdf} onReset={resetTool} />
      ) : Object.keys(docs).length === 0 ? (
        <FilePicker
          onFileSelect={handleFileUpload}
          multiple={true}
          buttonText="Choose PDF Files"
          helperText="All processing happens locally in your browser for complete privacy."
          gradientColor="from-purple-600 to-blue-700"
        />
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Source documents */}
          <div>
            <h2 className="mb-2 text-xl font-semibold">Source Documents</h2>
            <DocumentView
              documents={docs}
              onUpdatePages={handleUpdatePages}
              onAddSelectedPages={addSelectedPages}
              onCloseDocument={handleCloseDocument}
              engine={engine}
            />
          </div>

          {/* Target document */}
          <div>
            <h2 className="mb-2 text-xl font-semibold">New Document</h2>
            <MergeView
              pages={mergePages}
              onDragEnd={handleDragEnd}
              onRemovePage={removePage}
              onMerge={mergePDFs}
              isMerging={isMerging}
            />
          </div>
        </div>
      )}
    </ToolLayout>
  )
}
