import { useState, useEffect } from 'react';
import { LabHeader } from '../../components/LabHeader';
import { labs } from '../../labs';

const lab = labs.find((l) => l.slug === 'debugging-reporting')!;

function delay(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

export function DebuggingReporting() {
  const [flakyCount, setFlakyCount] = useState(0);
  const [flakyState, setFlakyState] = useState<'idle' | 'error' | 'success'>('idle');
  const [slowState, setSlowState] = useState<'idle' | 'loading' | 'done'>('idle');
  const [ticker, setTicker] = useState(0);
  const [screenshotHint, setScreenshotHint] = useState(false);

  // Auto-tick every second for the "non-deterministic" section
  useEffect(() => {
    const id = setInterval(() => setTicker((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const handleFlaky = async () => {
    setFlakyState('idle');
    setFlakyCount((n) => n + 1);
    await delay(300);
    // Fails on every 3rd click — deliberately unpredictable
    if ((flakyCount + 1) % 3 === 0) {
      setFlakyState('error');
    } else {
      setFlakyState('success');
    }
  };

  const handleSlow = async () => {
    setSlowState('loading');
    await delay(2000);
    setSlowState('done');
  };

  return (
    <div>
      <LabHeader lab={lab} />

      <div className="space-y-10">
        {/* ── Flaky button ───────────────────────────────────────────────── */}
        <section aria-labelledby="flaky-heading">
          <h2 id="flaky-heading" className="mb-1 text-base font-semibold text-content">
            Flaky component
          </h2>
          <p className="mb-1 text-sm text-muted">
            This button fails every third click. Explore how to configure automatic retries and how
            to capture a trace only when a retry occurs.
          </p>
          <p className="mb-4 text-xs text-muted">
            Click count: {flakyCount} — fails on clicks 3, 6, 9…
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void handleFlaky()}
              data-testid="flaky-button"
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
            >
              Click me (flaky)
            </button>
            {flakyState === 'success' && (
              <span
                role="status"
                aria-live="polite"
                data-testid="flaky-success"
                className="text-sm font-medium text-emerald-700 dark:text-emerald-400"
              >
                ✓ Success
              </span>
            )}
            {flakyState === 'error' && (
              <span
                role="alert"
                data-testid="flaky-error"
                className="text-sm font-medium text-red-700 dark:text-red-400"
              >
                ✗ Error — this was the flaky click
              </span>
            )}
          </div>
        </section>

        {/* ── Slow component ─────────────────────────────────────────────── */}
        <section aria-labelledby="slow-heading">
          <h2 id="slow-heading" className="mb-1 text-base font-semibold text-content">
            Slow component
          </h2>
          <p className="mb-4 text-sm text-muted">
            Takes 2 seconds to complete. Practice attaching a diagnostic artifact at a key point and
            configuring a step-level timeout so the test does not time out prematurely.
          </p>
          <button
            type="button"
            onClick={() => void handleSlow()}
            disabled={slowState === 'loading'}
            data-testid="slow-button"
            className="rounded-lg border border-edge px-4 py-2 text-sm font-medium text-muted hover:bg-canvas disabled:cursor-not-allowed disabled:opacity-50"
          >
            Trigger slow operation
          </button>
          {slowState === 'loading' && (
            <div
              role="status"
              aria-label="Loading"
              className="mt-3 flex items-center gap-2 text-sm text-muted"
            >
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-edge border-t-brand-600" />
              Processing…
            </div>
          )}
          {slowState === 'done' && (
            <p
              role="status"
              aria-live="polite"
              data-testid="slow-result"
              className="mt-3 text-sm text-emerald-700 dark:text-emerald-400"
            >
              ✓ Operation complete
            </p>
          )}
        </section>

        {/* ── Non-deterministic content ──────────────────────────────────── */}
        <section aria-labelledby="nondeterministic-heading">
          <h2 id="nondeterministic-heading" className="mb-1 text-base font-semibold text-content">
            Non-deterministic content
          </h2>
          <p className="mb-4 text-sm text-muted">
            This counter updates every second. A naive exact-text assertion on the raw number will
            be flaky. Think about what kind of assertion stays reliable when the value keeps
            changing.
          </p>
          <div className="inline-flex items-center gap-3 rounded-xl border border-edge bg-surface px-4 py-3">
            <span className="text-xs uppercase tracking-wider text-muted">Uptime</span>
            <span
              data-testid="live-counter"
              aria-label={`${ticker} seconds`}
              className="text-2xl font-bold tabular-nums text-content"
            >
              {ticker}s
            </span>
          </div>
        </section>

        {/* ── Screenshot hint ────────────────────────────────────────────── */}
        <section aria-labelledby="screenshot-heading">
          <h2 id="screenshot-heading" className="mb-1 text-base font-semibold text-content">
            Screenshot attachment
          </h2>
          <p className="mb-4 text-sm text-muted">
            Toggle the panel below, then attach a screenshot of this state to the test report so it
            is visible in the HTML output.
          </p>
          <button
            type="button"
            aria-expanded={screenshotHint}
            onClick={() => setScreenshotHint((v) => !v)}
            className="rounded-lg border border-edge bg-surface px-4 py-2 text-sm font-medium text-muted hover:bg-canvas"
          >
            {screenshotHint ? 'Collapse panel' : 'Expand panel'}
          </button>
          {screenshotHint && (
            <div
              data-testid="expandable-panel"
              className="mt-3 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-800 dark:border-brand-700 dark:bg-brand-950 dark:text-brand-300"
            >
              📸 Take a screenshot here. This content should appear in the trace viewer and HTML
              report when you attach it.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
