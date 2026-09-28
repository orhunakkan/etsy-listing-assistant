import { useState } from 'react';
import { LabHeader } from '../../components/LabHeader';
import { labs } from '../../labs';

const lab = labs.find((l) => l.slug === 'service-workers')!;

interface SwItem {
  id: number;
  name: string;
  source: 'cache' | 'network';
}

export function ServiceWorkers() {
  const [items, setItems] = useState<SwItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [swRegistered, setSwRegistered] = useState<boolean | null>(null);

  const registerSW = async () => {
    if (!('serviceWorker' in navigator)) {
      setSwRegistered(false);
      return;
    }
    try {
      await navigator.serviceWorker.register('/sw-lab.js', { scope: '/practice/service-workers' });
      setSwRegistered(true);
    } catch {
      setSwRegistered(false);
    }
  };

  const fetchItems = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/sw-items');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as SwItem[];
      setItems(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <LabHeader lab={lab} />

      <div className="space-y-10">
        {/* ── SW registration ───────────────────────────────────────────── */}
        <section aria-labelledby="sw-reg-heading">
          <h2 id="sw-reg-heading" className="mb-1 text-base font-semibold text-content">
            Step 1 — Register the service worker
          </h2>
          <p className="mb-4 text-sm text-muted">
            Register a service worker scoped to this page. Once registered, it will intercept
            requests to{' '}
            <code className="rounded bg-surface-raised px-1 text-xs">/api/sw-items</code> and return
            stale cached data regardless of what the real server responds.
          </p>
          <button
            type="button"
            onClick={() => void registerSW()}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            Register service worker
          </button>
          {swRegistered === true && (
            <p
              role="status"
              aria-live="polite"
              className="mt-2 text-sm text-emerald-700 dark:text-emerald-300"
            >
              ✓ Service worker registered
            </p>
          )}
          {swRegistered === false && (
            <p role="alert" className="mt-2 text-sm text-red-700 dark:text-red-400">
              ✗ Registration failed (not supported or already registered)
            </p>
          )}
        </section>

        {/* ── Fetch with SW ─────────────────────────────────────────────── */}
        <section aria-labelledby="fetch-heading">
          <h2 id="fetch-heading" className="mb-1 text-base font-semibold text-content">
            Step 2 — Fetch items (SW intercepts)
          </h2>
          <p className="mb-4 text-sm text-muted">
            Click &quot;Fetch items&quot;. If the SW is active, it returns cached stale data. A
            Playwright test using{' '}
            <code className="rounded bg-surface-raised px-1 text-xs">page.route()</code> alone{' '}
            <strong>will not intercept</strong> this request — the SW gets there first.
          </p>

          <button
            type="button"
            onClick={() => void fetchItems()}
            disabled={loading}
            data-testid="fetch-items-btn"
            className="rounded-lg border border-edge px-4 py-2 text-sm font-medium text-muted hover:bg-canvas disabled:opacity-50"
          >
            Fetch items
          </button>

          {loading && (
            <div
              role="status"
              aria-label="Loading"
              className="mt-3 flex items-center gap-2 text-sm text-muted"
            >
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-edge border-t-brand-600" />
              Loading…
            </div>
          )}

          {error && (
            <p role="alert" className="mt-3 text-sm text-red-700 dark:text-red-400">
              {error}
            </p>
          )}

          {items.length > 0 && (
            <ul aria-label="Fetched items" className="mt-3 space-y-1">
              {items.map((item) => (
                <li
                  key={item.id}
                  data-testid={`sw-item-${item.id}`}
                  className="flex items-center gap-2 rounded-lg border border-edge bg-surface px-3 py-2 text-sm"
                >
                  <span
                    className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                      item.source === 'cache'
                        ? 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                        : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                    }`}
                  >
                    {item.source}
                  </span>
                  {item.name}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ── Block SW ──────────────────────────────────────────────────── */}
        <section aria-labelledby="block-heading">
          <h2 id="block-heading" className="mb-1 text-base font-semibold text-content">
            Step 3 — Block the service worker
          </h2>
          <div className="rounded-xl border border-brand-100 bg-brand-50 p-4 text-sm text-brand-800 dark:border-brand-700 dark:bg-brand-950 dark:text-brand-300">
            <p>
              In your Playwright test, pass{' '}
              <code className="rounded bg-brand-100 px-1 text-xs dark:bg-brand-900">
                serviceWorkers: &apos;block&apos;
              </code>{' '}
              when creating the context:
            </p>
            <pre className="mt-2 overflow-x-auto rounded-lg bg-brand-900 p-3 text-xs text-brand-100">
              {`const context = await browser.newContext({
  serviceWorkers: 'block',
});`}
            </pre>
            <p className="mt-3">
              Now{' '}
              <code className="rounded bg-brand-100 px-1 text-xs dark:bg-brand-900">
                page.route()
              </code>{' '}
              will intercept{' '}
              <code className="rounded bg-brand-100 px-1 text-xs dark:bg-brand-900">
                /api/sw-items
              </code>{' '}
              as expected, and you can mock or verify the real server response.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
