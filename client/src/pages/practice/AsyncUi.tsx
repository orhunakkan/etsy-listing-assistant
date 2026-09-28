import { useState, useEffect, useCallback } from 'react';
import { LabHeader } from '../../components/LabHeader';
import { labs } from '../../labs';

const lab = labs.find((l) => l.slug === 'async-ui')!;

interface Article {
  id: number;
  title: string;
  source: string;
  summary: string;
}

const FAKE_ARTICLES: Article[] = [
  {
    id: 1,
    title: 'Playwright 2.0 ships with native component testing',
    source: 'Tech Digest',
    summary: 'The new release brings first-class component testing support to the framework.',
  },
  {
    id: 2,
    title: 'WebAssembly adoption surges in production apps',
    source: 'Dev Weekly',
    summary: 'A new survey finds 40% of teams now ship WASM modules to production.',
  },
  {
    id: 3,
    title: 'CSS anchor positioning reaches baseline 2025',
    source: 'Frontend News',
    summary: 'All major browsers now support the anchor positioning specification.',
  },
  {
    id: 4,
    title: 'TypeScript 6 drops CommonJS output',
    source: 'OSS Watch',
    summary: 'The TypeScript team announced ESM-only output starting in version 6.',
  },
];

const BASE_PRICE = 142.37;

type LoadState = 'idle' | 'loading' | 'success' | 'error';

function delay(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}

export function AsyncUi() {
  // ── Section 1: delayed content ──────────────────────────────────────────────
  const [loadState, setLoadState] = useState<LoadState>('idle');
  const [articles, setArticles] = useState<Article[]>([]);

  const loadArticles = useCallback(async (fail: boolean) => {
    setLoadState('loading');
    setArticles([]);
    await delay(1500);
    if (fail) {
      setLoadState('error');
    } else {
      setArticles(FAKE_ARTICLES);
      setLoadState('success');
    }
  }, []);

  // ── Section 2: auto-polling ticker ──────────────────────────────────────────
  const [tickCount, setTickCount] = useState(0);
  const price = (BASE_PRICE + tickCount * 0.13).toFixed(2);
  const lastUpdated = tickCount === 0 ? 'just now' : `${tickCount * 2}s ago`;

  useEffect(() => {
    const id = setInterval(() => setTickCount((n) => n + 1), 2000);
    return () => clearInterval(id);
  }, []);

  // ── Section 3: transient toast ──────────────────────────────────────────────
  const [toastVisible, setToastVisible] = useState(false);
  const [toastPending, setToastPending] = useState(false);

  const triggerToast = async () => {
    setToastPending(true);
    await delay(800);
    setToastPending(false);
    setToastVisible(true);
  };

  return (
    <div>
      <LabHeader lab={lab} />

      <div className="space-y-12">
        {/* ── Section 1 ──────────────────────────────────────────────────────── */}
        <section aria-labelledby="articles-heading">
          <h2 id="articles-heading" className="mb-1 text-base font-semibold text-content">
            Delayed content
          </h2>
          <p className="mb-4 text-sm text-muted">
            Load takes ~1.5 s. Practice asserting the loading state and waiting for content to
            appear. Use{' '}
            <code className="rounded bg-surface-raised px-1 text-xs">Load with error</code> to
            trigger a failure.
          </p>

          <div className="mb-4 flex gap-2">
            <button
              type="button"
              onClick={() => void loadArticles(false)}
              disabled={loadState === 'loading'}
              className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Load articles
            </button>
            <button
              type="button"
              onClick={() => void loadArticles(true)}
              disabled={loadState === 'loading'}
              className="rounded-lg border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-950"
            >
              Load with error
            </button>
          </div>

          {loadState === 'loading' && (
            <div
              role="status"
              aria-label="Loading articles"
              className="flex items-center gap-2 text-sm text-muted"
            >
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-edge border-t-brand-600" />
              Loading articles…
            </div>
          )}

          {loadState === 'error' && (
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-700 dark:bg-red-950"
            >
              <p className="text-sm font-medium text-red-700 dark:text-red-400">
                Failed to load articles.
              </p>
              <button
                type="button"
                onClick={() => void loadArticles(false)}
                className="mt-2 text-sm text-red-700 underline hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
              >
                Retry
              </button>
            </div>
          )}

          {loadState === 'success' && (
            <div className="space-y-3">
              {articles.map((article) => (
                <article key={article.id} className="rounded-xl border border-edge bg-surface p-4">
                  <h3 className="text-sm font-semibold text-content">{article.title}</h3>
                  <p className="mt-0.5 text-xs text-muted">{article.source}</p>
                  <p className="mt-1 text-xs text-muted">{article.summary}</p>
                </article>
              ))}
            </div>
          )}
        </section>

        {/* ── Section 2 ──────────────────────────────────────────────────────── */}
        <section aria-labelledby="ticker-heading">
          <h2 id="ticker-heading" className="mb-1 text-base font-semibold text-content">
            Auto-polling ticker
          </h2>
          <p className="mb-4 text-sm text-muted">
            Price updates every 2 s automatically. Use{' '}
            <code className="rounded bg-surface-raised px-1 text-xs">expect.poll()</code> to assert
            a value that keeps changing.
          </p>

          <div className="inline-block rounded-xl border border-edge bg-surface p-4">
            <p className="text-xs uppercase tracking-wider text-muted">ACME Corp · NASDAQ</p>
            <p
              className="mt-1 text-2xl font-bold tabular-nums text-content"
              aria-label={`Stock price $${price}`}
              data-testid="stock-price"
            >
              ${price}
            </p>
            <p className="mt-0.5 text-xs text-muted">
              Last updated: <span data-testid="last-updated">{lastUpdated}</span>
            </p>
          </div>
        </section>

        {/* ── Section 3 ──────────────────────────────────────────────────────── */}
        <section aria-labelledby="toast-heading">
          <h2 id="toast-heading" className="mb-1 text-base font-semibold text-content">
            Transient notification
          </h2>
          <p className="mb-4 text-sm text-muted">
            The toast appears after 800 ms — you must assert it before it's dismissed. Practice
            waiting for elements that appear and disappear.
          </p>

          <button
            type="button"
            onClick={() => void triggerToast()}
            disabled={toastPending || toastVisible}
            className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {toastPending ? 'Sending…' : 'Trigger notification'}
          </button>
        </section>
      </div>

      {/* Toast — intentionally dark widget, hardcoded colors */}
      {toastVisible && (
        <div
          role="alert"
          aria-live="assertive"
          className="fixed bottom-6 right-6 flex items-start gap-3 rounded-xl bg-zinc-900 dark:bg-surface-raised px-4 py-3 text-white dark:text-content shadow-lg"
        >
          <div>
            <p className="text-sm font-medium">Notification sent</p>
            <p className="mt-0.5 text-xs text-zinc-400 dark:text-muted">
              Your request was processed.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setToastVisible(false)}
            aria-label="Dismiss notification"
            className="ml-2 text-zinc-400 dark:text-muted transition-colors hover:text-white dark:hover:text-content"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
