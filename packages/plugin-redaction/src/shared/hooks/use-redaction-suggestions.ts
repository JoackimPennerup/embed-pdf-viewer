import { useCallback, useEffect, useMemo, useRef, useState } from '@framework';
import { useRegistry } from '@embedpdf/core/@framework';
import { useLoaderCapability } from '@embedpdf/plugin-loader/@framework';
import { PdfDocumentObject } from '@embedpdf/models';
import {
  buildDocumentTextIndex,
  DocumentTextIndex,
  RawRedactionSuggestion,
  RedactionSuggestion,
  transformSuggestions,
} from '../suggestions';

interface RequestBuilderArgs {
  text: string;
  document: PdfDocumentObject;
}

export interface UseRedactionSuggestionsOptions {
  serviceUrl: string;
  enabled?: boolean;
  autoFetch?: boolean;
  minScore?: number;
  buildRequestInit?: (args: RequestBuilderArgs) => Promise<RequestInit> | RequestInit;
  parseResponse?: (response: any) => RawRedactionSuggestion[];
}

export interface UseRedactionSuggestionsResult {
  document: PdfDocumentObject | null;
  extracting: boolean;
  loading: boolean;
  error: Error | null;
  suggestions: RedactionSuggestion[];
  ready: boolean;
  lastUpdated: Date | null;
  refetch: () => Promise<void>;
}

const defaultBuildRequestInit = ({ text }: RequestBuilderArgs): RequestInit => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ text }),
});

const defaultParseResponse = (response: any): RawRedactionSuggestion[] => {
  if (!Array.isArray(response)) {
    throw new Error('Unexpected response format from redaction suggestion service');
  }
  return response as RawRedactionSuggestion[];
};

function normalizeHeaders(headers: HeadersInit | undefined): Record<string, string> {
  if (!headers) return {};
  if (headers instanceof Headers) {
    const record: Record<string, string> = {};
    headers.forEach((value, key) => {
      record[key] = value;
    });
    return record;
  }
  if (Array.isArray(headers)) {
    const record: Record<string, string> = {};
    for (const [key, value] of headers) {
      record[key] = value;
    }
    return record;
  }
  return { ...headers };
}

function mergeHeaders(
  existing: HeadersInit | undefined,
  defaults: Record<string, string>,
): HeadersInit {
  const normalized = normalizeHeaders(existing);
  for (const [key, value] of Object.entries(defaults)) {
    const lowerKey = key.toLowerCase();
    const hasKey = Object.keys(normalized).some((k) => k.toLowerCase() === lowerKey);
    if (!hasKey) {
      normalized[key] = value;
    }
  }
  return normalized;
}

export function useRedactionSuggestions(
  options: UseRedactionSuggestionsOptions,
): UseRedactionSuggestionsResult {
  const { registry, pluginsReady } = useRegistry();
  const { provides: loader } = useLoaderCapability();

  const [document, setDocument] = useState<PdfDocumentObject | null>(
    () => loader?.getDocument() ?? null,
  );
  const [textIndex, setTextIndex] = useState<DocumentTextIndex | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [suggestions, setSuggestions] = useState<RedactionSuggestion[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const enabled = options.enabled !== false;
  const autoFetch = options.autoFetch ?? true;

  useEffect(() => {
    if (!loader) return;

    const offDocumentLoaded = loader.onDocumentLoaded((doc) => {
      setDocument(doc);
    });

    const offLoaderEvent = loader.onLoaderEvent((event) => {
      if (event.type === 'start') {
        setDocument(null);
      }
    });

    const currentDocument = loader.getDocument();
    if (currentDocument) {
      setDocument(currentDocument);
    }

    return () => {
      offDocumentLoaded?.();
      offLoaderEvent?.();
    };
  }, [loader]);

  useEffect(() => {
    setSuggestions([]);
    setLastUpdated(null);
    setError(null);
    setTextIndex(null);
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
  }, [document?.id]);

  useEffect(() => {
    if (enabled === false) {
      setSuggestions([]);
      setLastUpdated(null);
    }
  }, [enabled]);

  useEffect(() => {
    if (!document || !registry || !pluginsReady || !enabled) {
      setTextIndex(null);
      setExtracting(false);
      return;
    }

    let cancelled = false;
    setExtracting(true);

    (async () => {
      try {
        const index = await buildDocumentTextIndex(registry.getEngine(), document);
        if (cancelled) return;
        setTextIndex(index);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err : new Error(String(err)));
        setTextIndex(null);
      } finally {
        if (!cancelled) {
          setExtracting(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [document, registry, pluginsReady, enabled]);

  useEffect(
    () => () => {
      abortControllerRef.current?.abort();
    },
    [],
  );

  const refetch = useCallback(async () => {
    if (!enabled) return;
    if (!textIndex) return;
    const builder = options.buildRequestInit ?? defaultBuildRequestInit;
    const parser = options.parseResponse ?? defaultParseResponse;

    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoading(true);
    setError(null);

    try {
      const initFromBuilder = await builder({
        text: textIndex.text,
        document: textIndex.document,
      });

      const finalInit: RequestInit = { ...initFromBuilder };

      if (!finalInit.method) {
        finalInit.method = 'POST';
      }

      if (finalInit.body === undefined) {
        finalInit.body = JSON.stringify({ text: textIndex.text });
        finalInit.headers = mergeHeaders(finalInit.headers, { 'Content-Type': 'application/json' });
      }

      if (!finalInit.signal) {
        finalInit.signal = controller.signal;
      }

      const response = await globalThis.fetch(options.serviceUrl, finalInit);
      if (!response.ok) {
        throw new Error(
          `Failed to fetch redaction suggestions: ${response.status} ${response.statusText}`,
        );
      }

      const json = await response.json();
      const parsed = parser(json);
      const transformed = transformSuggestions(parsed, textIndex, {
        minScore: options.minScore,
      });

      setSuggestions(transformed);
      setLastUpdated(new Date());
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return;
      }
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
      setLoading(false);
    }
  }, [
    enabled,
    options.buildRequestInit,
    options.minScore,
    options.parseResponse,
    options.serviceUrl,
    textIndex,
  ]);

  useEffect(() => {
    if (!autoFetch) return;
    if (!enabled) return;
    if (!textIndex) return;
    refetch();
  }, [autoFetch, enabled, textIndex, refetch]);

  const ready = useMemo(() => Boolean(textIndex) && enabled, [textIndex, enabled]);

  return {
    document,
    extracting,
    loading,
    error,
    suggestions,
    ready,
    lastUpdated,
    refetch,
  };
}
