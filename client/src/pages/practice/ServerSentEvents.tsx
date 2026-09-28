import { useState, useRef, useCallback, useEffect } from 'react';
import { LabHeader } from '../../components/LabHeader';
import { labs } from '../../labs';

const lab = labs.find((l) => l.slug === 'server-sent-events')!;

interface LogEntry {
  id: number;
  type: 'info' | 'warn' | 'error' | 'system';
  message: string;
}

const TYPE_BADGE: Record<LogEntry['type'], string> = {
  info: 'bg-blue-100 text-blue-800',
  warn: 'bg-amber-100 text-amber-800',
  error: 'bg-red-100 text-red-800',
  system: 'bg-gray-100 text-gray-600',
};

export function ServerSentEvents() {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [done, setDone] = useState(false);
  const esRef = useRef<EventSource | null>(null);
  const idRef = useRef(0);

  const append = useCallback((type: LogEntry['type'], message: string) => {
    setEntries((prev) => [...prev, { id: idRef.current++, type, message }]);
  }, []);

  useEffect(() => {
    return () => {
      esRef.current?.close();
      esRef.current = null;
    };
  }, []);

  function startStream() {
    if (esRef.current) return;
    setEntries([]);
    setDone(false);
    setStreaming(true);
    append('system', 'Connecting to stream…');

    const es = new EventSource('/api/sse');
    esRef.current = es;

    es.addEventListener('log', (e) => {
      try {
        const data = JSON.parse((e as MessageEvent).data) as {
          type: 'info' | 'warn' | 'error';
          message: string;
        };
        append(data.type, data.message);
      } catch {
        // ignore malformed frames
      }
    });

    es.addEventListener('done', () => {
      append('system', 'Stream complete.');
      setDone(true);
      setStreaming(false);
      es.close();
      esRef.current = null;
    });

    es.onerror = () => {
      append('system', 'Connection error or stream closed.');
      setStreaming(false);
      es.close();
      esRef.current = null;
    };
  }

  function stopStream() {
    if (!esRef.current) return;
    esRef.current.close();
    esRef.current = null;
    setStreaming(false);
    append('system', 'Stream stopped by user.');
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8 p-6">
      <LabHeader lab={lab} />

      {/* ── Controls ──────────────────────────────────────────────────── */}
      <section
        aria-labelledby="sse-controls-heading"
        className="rounded-lg border border-edge bg-surface p-6"
      >
        <h2 id="sse-controls-heading" className="text-lg font-semibold text-content">
          Build &amp; Deploy Stream
        </h2>
        <p className="mt-1 text-sm text-muted">
          Click <strong>Start Stream</strong> to open an{' '}
          <code className="rounded bg-surface-raised px-1 font-mono text-xs">EventSource</code>{' '}
          connection to{' '}
          <code className="rounded bg-surface-raised px-1 font-mono text-xs">/api/sse</code>. Events
          arrive every 600 ms. Use{' '}
          <code className="rounded bg-surface-raised px-1 font-mono text-xs">page.route()</code> to
          intercept and stub the stream in tests.
        </p>

        <div className="mt-4 flex gap-3">
          <button
            type="button"
            onClick={startStream}
            disabled={streaming}
            aria-label="Start Stream"
            className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            Start Stream
          </button>
          <button
            type="button"
            onClick={stopStream}
            disabled={!streaming}
            aria-label="Stop Stream"
            className="rounded-md border border-edge px-4 py-2 text-sm font-medium text-content hover:bg-canvas disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            Stop Stream
          </button>
        </div>

        {done && (
          <p
            role="status"
            aria-label="Stream done"
            className="mt-3 text-sm font-medium text-emerald-700"
          >
            ✓ Stream complete
          </p>
        )}
      </section>

      {/* ── Log output ────────────────────────────────────────────────── */}
      <section
        aria-labelledby="log-heading"
        className="rounded-lg border border-edge bg-surface p-6"
      >
        <h2 id="log-heading" className="text-lg font-semibold text-content">
          Event Log
        </h2>
        {entries.length === 0 ? (
          <p className="mt-3 text-sm text-muted" aria-label="Empty log message">
            No events yet — start the stream above.
          </p>
        ) : (
          <ol
            aria-label="SSE event log"
            aria-live="polite"
            aria-atomic="false"
            className="mt-3 space-y-2"
          >
            {entries.map((entry) => (
              <li
                key={entry.id}
                className="flex items-start gap-3 text-sm"
                aria-label={`${entry.type} event: ${entry.message}`}
              >
                <span
                  aria-label={`${entry.type} badge`}
                  className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${TYPE_BADGE[entry.type]}`}
                >
                  {entry.type}
                </span>
                <span className="text-content">{entry.message}</span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
