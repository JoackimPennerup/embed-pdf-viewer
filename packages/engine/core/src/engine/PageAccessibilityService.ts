import type { PageAccessibilitySnapshot } from '../dto/PageAccessibilitySnapshot';
import type { AbortablePromise } from '../promise/AbortablePromise';

export interface PageAccessibilityService {
  read(): AbortablePromise<PageAccessibilitySnapshot>;
}
