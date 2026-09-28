import { useState } from 'react';

// The page that opens in a new tab from the Multi-Tab lab.
// It is intentionally minimal — just enough to practice asserting cross-tab state.
export function MultiTabWindow() {
  const [count, setCount] = useState(0);

  const writeShared = () => {
    localStorage.setItem('multi-tab:shared', `written-from-tab-${Date.now()}`);
    setCount((n) => n + 1);
  };

  return (
    <div className="min-h-screen bg-canvas p-8">
      <h1 className="text-2xl font-bold text-content">Dashboard (New Tab)</h1>
      <p className="mt-2 text-sm text-muted">
        You are on a page that was opened in a new tab. Playwright can target this page via{' '}
        <code className="rounded bg-surface-raised px-1 text-xs">context.pages()</code> or the
        captured page reference from{' '}
        <code className="rounded bg-surface-raised px-1 text-xs">
          context.waitForEvent(&apos;page&apos;)
        </code>
        .
      </p>

      <div className="mt-8 space-y-4">
        <div className="rounded-xl border border-edge bg-canvas p-4">
          <h2 className="mb-1 text-sm font-semibold text-content">Counter</h2>
          <p
            data-testid="tab-counter"
            aria-label={`Counter: ${count}`}
            className="text-3xl font-bold text-content"
          >
            {count}
          </p>
          <button
            type="button"
            onClick={() => setCount((n) => n + 1)}
            className="mt-3 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            Increment
          </button>
        </div>

        <div className="rounded-xl border border-edge bg-canvas p-4">
          <h2 className="mb-1 text-sm font-semibold text-content">Shared storage</h2>
          <p className="mb-3 text-xs text-muted">
            Write a value to <code className="rounded bg-surface-raised px-1">localStorage</code>{' '}
            and observe it on the opener page.
          </p>
          <button
            type="button"
            onClick={writeShared}
            data-testid="write-storage"
            className="rounded-lg border border-edge px-4 py-2 text-sm font-medium text-muted hover:bg-canvas"
          >
            Write to shared storage ({count} times)
          </button>
        </div>
      </div>
    </div>
  );
}
