import { Fragment, JSX, useCallback, useEffect, useMemo, useState } from '@framework';
import {
  useRedactionSuggestions,
  UseRedactionSuggestionsOptions,
} from '../hooks/use-redaction-suggestions';
import { useRedactionCapability } from '../hooks';
import { RedactionSuggestion, RedactionSuggestionOccurrence } from '../suggestions';

interface AppliedRedactionRecord {
  ids: { page: number; id: string }[];
}

export interface RedactionSuggestionsSidebarProps extends UseRedactionSuggestionsOptions {
  className?: string;
  title?: string;
  description?: string;
  emptyState?: string;
  errorState?: string;
  loadingLabel?: string;
  extractingLabel?: string;
}

const defaultEmptyState = 'No AI redaction suggestions were returned for this document.';
const defaultErrorState = 'Unable to fetch AI redaction suggestions.';
const defaultLoadingLabel = 'Fetching suggestions…';
const defaultExtractingLabel = 'Preparing document text…';

const formatScore = (score: number): string => {
  if (!Number.isFinite(score)) return '—';
  return `${Math.round(score * 1000) / 10}%`;
};

const formatOccurrenceLabel = (
  occurrence: RedactionSuggestionOccurrence,
  index: number,
): string => {
  const pageList = occurrence.pages.map((page) => page + 1).join(', ');
  const pageLabel = pageList
    ? `Page${occurrence.pages.length > 1 ? 's' : ''} ${pageList}`
    : 'Location unavailable';
  return `Match ${index + 1} · ${pageLabel}`;
};

const normalizeSnippet = (text: string): string => {
  if (!text) return '';
  return text.replace(/\s+/g, ' ').trim();
};

export const RedactionSuggestionsSidebar = ({
  className,
  title = 'AI Redaction Suggestions',
  description = 'Review potential redactions identified by the AI service and add them to the document.',
  emptyState = defaultEmptyState,
  errorState = defaultErrorState,
  loadingLabel = defaultLoadingLabel,
  extractingLabel = defaultExtractingLabel,
  serviceUrl,
  enabled,
  autoFetch,
  minScore,
  buildRequestInit,
  parseResponse,
}: RedactionSuggestionsSidebarProps): JSX.Element => {
  const hookOptions = useMemo(
    () => ({ serviceUrl, enabled, autoFetch, minScore, buildRequestInit, parseResponse }),
    [serviceUrl, enabled, autoFetch, minScore, buildRequestInit, parseResponse],
  );

  const { suggestions, loading, extracting, error, ready, lastUpdated, document, refetch } =
    useRedactionSuggestions(hookOptions);
  const { provides: redaction } = useRedactionCapability();

  const [applied, setApplied] = useState<Record<string, AppliedRedactionRecord>>({});

  useEffect(() => {
    setApplied({});
  }, [document?.id]);

  useEffect(() => {
    if (enabled === false) {
      setApplied({});
    }
  }, [enabled]);

  useEffect(() => {
    if (!redaction) return;
    return redaction.onPendingChange((map) => {
      setApplied((prev) => {
        let changed = false;
        const next: Record<string, AppliedRedactionRecord> = {};
        for (const [suggestionId, record] of Object.entries(prev)) {
          const stillPresent = record.ids.every(({ page, id }) =>
            (map[page] ?? []).some((item) => item.id === id),
          );
          if (stillPresent) {
            next[suggestionId] = record;
          } else {
            changed = true;
          }
        }
        if (!changed && Object.keys(next).length === Object.keys(prev).length) {
          return prev;
        }
        return next;
      });
    });
  }, [redaction]);

  const handleToggle = useCallback(
    (suggestion: RedactionSuggestion, checked: boolean) => {
      if (!redaction) return;

      if (checked) {
        setApplied((prev) => {
          if (prev[suggestion.id]) return prev;
          const items = suggestion.occurrences
            .filter((occ) => occ.status === 'ready')
            .flatMap((occ) => occ.items);
          if (!items.length) return prev;
          redaction.addPending(items);
          return {
            ...prev,
            [suggestion.id]: {
              ids: items.map((item) => ({ page: item.page, id: item.id })),
            },
          };
        });
      } else {
        setApplied((prev) => {
          const record = prev[suggestion.id];
          if (!record) return prev;
          record.ids.forEach(({ page, id }) => {
            redaction.removePending(page, id);
          });
          const next = { ...prev };
          delete next[suggestion.id];
          return next;
        });
      }
    },
    [redaction],
  );

  const suggestionsDisabled = enabled === false;
  const isDisabled = !redaction || !ready;
  const hasSuggestions = suggestions.length > 0;
  const showEmpty =
    !loading && !extracting && ready && !hasSuggestions && !error && !suggestionsDisabled;
  const showError = Boolean(error);
  const showLoading = loading;
  const showExtracting = !loading && extracting;
  const showDisabled = suggestionsDisabled;
  const showAwaitingDocument =
    !document && !extracting && !loading && !error && !suggestionsDisabled;

  const handleRefresh = useCallback(() => {
    void refetch();
  }, [refetch]);

  return (
    <div
      className={
        className ??
        'flex h-full flex-col border-l border-gray-200 bg-white text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100'
      }
    >
      <div className="border-b border-gray-200 px-4 py-3 dark:border-gray-700">
        <h2 className="text-sm font-semibold leading-5">{title}</h2>
        <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">{description}</p>
      </div>

      <div className="flex items-center justify-between gap-2 border-b border-gray-200 px-4 py-2 text-xs text-gray-600 dark:border-gray-700 dark:text-gray-400">
        <div className="flex flex-col">
          <span className="font-medium text-gray-700 dark:text-gray-300">
            {hasSuggestions
              ? `${suggestions.length} suggestion${suggestions.length === 1 ? '' : 's'}`
              : 'Suggestions'}
          </span>
          {lastUpdated ? (
            <span className="text-[11px] text-gray-500 dark:text-gray-500">
              Updated {lastUpdated.toLocaleTimeString()}
            </span>
          ) : null}
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={showLoading || showExtracting || !ready}
          className="rounded border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
        >
          Refresh
        </button>
      </div>

      <div className="flex-1 overflow-auto px-4 py-3">
        {showAwaitingDocument ? (
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Load a document to request AI redaction suggestions.
          </p>
        ) : null}

        {showDisabled ? (
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Redaction suggestions are disabled for the current configuration.
          </p>
        ) : null}

        {showExtracting ? (
          <p className="text-sm text-gray-600 dark:text-gray-400">{extractingLabel}</p>
        ) : null}

        {showLoading ? (
          <p className="text-sm text-gray-600 dark:text-gray-400">{loadingLabel}</p>
        ) : null}

        {showError ? (
          <div className="space-y-2 text-sm text-red-600 dark:text-red-400">
            <p>{errorState}</p>
            <p className="text-xs text-red-500 dark:text-red-400">{error?.message}</p>
            <button
              type="button"
              onClick={handleRefresh}
              className="rounded border border-red-400 px-2 py-1 text-xs font-medium text-red-600 transition hover:bg-red-50 dark:border-red-600 dark:text-red-300 dark:hover:bg-red-900/30"
            >
              Try again
            </button>
          </div>
        ) : null}

        {showEmpty ? (
          <p className="text-sm text-gray-600 dark:text-gray-400">{emptyState}</p>
        ) : null}

        {ready && hasSuggestions ? (
          <ul className="space-y-3">
            {suggestions.map((suggestion) => {
              const checked = Boolean(applied[suggestion.id]);
              const disabled = isDisabled || suggestion.readyOccurrences === 0;
              return (
                <li
                  key={suggestion.id}
                  className="rounded-md border border-gray-200 bg-white p-3 shadow-sm transition hover:border-gray-300 dark:border-gray-700 dark:bg-gray-900/60 dark:hover:border-gray-600"
                >
                  <label className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      checked={checked}
                      disabled={disabled}
                      onChange={(evt) => handleToggle(suggestion, evt.currentTarget.checked)}
                    />
                    <div className="flex-1 space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-col">
                          <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                            {suggestion.entity}
                          </span>
                          <span className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
                            {suggestion.entityType}
                          </span>
                        </div>
                        <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
                          Confidence {formatScore(suggestion.averageScore)}
                        </span>
                      </div>

                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        {suggestion.readyOccurrences} of {suggestion.totalOccurrences} occurrence
                        {suggestion.totalOccurrences === 1 ? '' : 's'} located in the document.
                      </p>

                      <div className="space-y-2">
                        {suggestion.occurrences.map((occurrence, index) => (
                          <Fragment key={occurrence.id}>
                            <div className="rounded border border-gray-200 bg-gray-50 p-2 text-xs text-gray-700 dark:border-gray-600 dark:bg-gray-800/80 dark:text-gray-200">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className="font-medium text-gray-700 dark:text-gray-200">
                                  {formatOccurrenceLabel(occurrence, index)}
                                </span>
                                <span
                                  className={
                                    occurrence.status === 'ready'
                                      ? 'text-[11px] font-medium uppercase text-emerald-600 dark:text-emerald-400'
                                      : 'text-[11px] font-medium uppercase text-amber-600 dark:text-amber-400'
                                  }
                                >
                                  {occurrence.status === 'ready' ? 'Ready' : 'Unmapped'}
                                </span>
                              </div>
                              <p className="mt-1 text-[11px] text-gray-600 dark:text-gray-300">
                                {normalizeSnippet(occurrence.text || suggestion.entity)}
                              </p>
                              {occurrence.status === 'unmapped' && occurrence.reason ? (
                                <p className="mt-1 text-[11px] text-amber-600 dark:text-amber-400">
                                  {occurrence.reason}
                                </p>
                              ) : null}
                            </div>
                          </Fragment>
                        ))}
                      </div>
                    </div>
                  </label>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
    </div>
  );
};
