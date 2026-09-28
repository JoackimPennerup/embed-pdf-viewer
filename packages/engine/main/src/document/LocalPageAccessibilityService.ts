import {
  AbortablePromise,
  EngineError,
  EngineErrorCode,
  wirePack,
  type PageAccessibilityService,
  type PageAccessibilitySnapshot,
  type PageRef,
} from '@embedpdf/engine-core/runtime';

import type { ScopeGuard } from '../scope';
import { Priority } from '../worker/Priority';
import type { JobId, WorkerResultPayload } from '../worker/protocol';
import type { WorkerQueue } from '../worker/WorkerQueue';

export class LocalPageAccessibilityService implements PageAccessibilityService {
  constructor(
    private readonly docId: string,
    private readonly ref: PageRef,
    private readonly queue: WorkerQueue,
    private readonly view: { isClosed(): boolean },
    private readonly guard: ScopeGuard,
  ) {}

  read(): AbortablePromise<PageAccessibilitySnapshot> {
    if (this.view.isClosed()) {
      return AbortablePromise.rejectReason(
        new EngineError(EngineErrorCode.DocNotOpen, `document not open: ${this.docId}`),
      );
    }
    try {
      this.guard.assertCapability('doc.text.copy');
      // Structure text can be copied, but its run and element bounds are
      // selection geometry and must not be exposed to copy-only callers.
      this.guard.assertCapability('doc.text.select');
    } catch (error) {
      return AbortablePromise.rejectReason(error);
    }
    const submission = this.queue.enqueue<WorkerResultPayload>(
      {
        buildPack: (jobId: JobId) =>
          wirePack({ kind: 'pages.accessibility', jobId, docId: this.docId, page: this.ref }),
      },
      { priority: Priority.MEDIUM },
    );
    return AbortablePromise.run<PageAccessibilitySnapshot>(async (signal) => {
      const onAbort = () => submission.abort(signal.reason);
      if (signal.aborted) onAbort();
      else signal.addEventListener('abort', onAbort, { once: true });
      try {
        const payload = await submission;
        if (payload.tag !== 'pages.accessibility') {
          throw new EngineError(
            EngineErrorCode.WireFormat,
            `unexpected payload tag: ${payload.tag}`,
          );
        }
        return payload.snapshot;
      } finally {
        signal.removeEventListener('abort', onAbort);
      }
    });
  }
}
