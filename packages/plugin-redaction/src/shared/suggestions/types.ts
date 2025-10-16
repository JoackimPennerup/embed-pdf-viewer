import { PdfDocumentObject, Rect } from '@embedpdf/models';
import { RedactionItem } from '@embedpdf/plugin-redaction';

export interface RawRedactionOccurrence {
  start: number;
  end: number;
}

export interface RawRedactionSuggestion {
  average_score: number;
  entity: string;
  entity_type: string;
  occurrences: RawRedactionOccurrence[];
}

export interface TextContentSlice {
  pageIndex: number;
  start: number;
  end: number;
  rect: Rect;
  content: string;
}

export interface DocumentTextIndex {
  document: PdfDocumentObject;
  slices: TextContentSlice[];
  text: string;
}

export type OccurrenceStatus = 'ready' | 'unmapped';

export interface RedactionSuggestionOccurrence {
  id: string;
  start: number;
  end: number;
  text: string;
  items: RedactionItem[];
  pages: number[];
  status: OccurrenceStatus;
  reason?: string;
}

export interface RedactionSuggestion {
  id: string;
  entity: string;
  entityType: string;
  averageScore: number;
  totalOccurrences: number;
  readyOccurrences: number;
  occurrences: RedactionSuggestionOccurrence[];
}
