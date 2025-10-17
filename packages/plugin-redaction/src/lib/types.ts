import { BasePluginConfig, EventHook } from '@embedpdf/core';
import { PdfErrorReason, Rect, Task } from '@embedpdf/models';

// Redaction mode enum
export enum RedactionMode {
  MarqueeRedact = 'marqueeRedact',
  RedactSelection = 'redactSelection',
}

export interface SelectedRedaction {
  page: number;
  id: string | null;
}

export interface RedactionState {
  isRedacting: boolean;
  activeType: RedactionMode | null;
  pending: Record<number, RedactionItem[]>;
  pendingCount: number;
  selected: SelectedRedaction | null;
}

export type RedactionItem =
  | {
      id: string;
      kind: 'text';
      page: number;
      rect: Rect;
      rects: Rect[];
    }
  | {
      id: string;
      kind: 'area';
      page: number;
      rect: Rect;
    };

export interface MarqueeRedactCallback {
  onPreview?: (rect: Rect | null) => void;
  onCommit?: (rect: Rect) => void;
}

export interface RegisterMarqueeOnPageOptions {
  pageIndex: number;
  scale: number;
  callback: MarqueeRedactCallback;
}

export interface RedactionPluginConfig extends BasePluginConfig {
  drawBlackBoxes: boolean;
}

// Add event types similar to annotation plugin
export type RedactionEvent =
  | {
      type: 'add';
      items: RedactionItem[];
    }
  | {
      type: 'remove';
      page: number;
      id: string;
    }
  | {
      type: 'clear';
    }
  | {
      type: 'commit';
      success: boolean;
      error?: PdfErrorReason;
    };

export interface RedactionCapability {
  queueCurrentSelectionAsPending: () => Task<boolean, PdfErrorReason>;

  enableMarqueeRedact: () => void;
  toggleMarqueeRedact: () => void;
  isMarqueeRedactActive: () => boolean;

  enableRedactSelection: () => void;
  toggleRedactSelection: () => void;
  isRedactSelectionActive: () => boolean;

  onPendingChange: EventHook<Record<number, RedactionItem[]>>;
  addPending: (items: RedactionItem[]) => void;
  removePending: (page: number, id: string) => void;
  clearPending: () => void;
  commitAllPending: () => Task<boolean, PdfErrorReason>;
  commitPending: (page: number, id: string) => Task<boolean, PdfErrorReason>;

  endRedaction: () => void;
  startRedaction: () => void;

  selectPending: (page: number, id: string) => void;
  deselectPending: () => void;

  // Event hook for redaction events
  onSelectedChange: EventHook<SelectedRedaction | null>;
  onRedactionEvent: EventHook<RedactionEvent>;
  onStateChange: EventHook<RedactionState>;
}
