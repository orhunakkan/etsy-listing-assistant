import { useState } from 'react';
import { LabHeader } from '../../components/LabHeader';
import { labs } from '../../labs';

const lab = labs.find((l) => l.slug === 'init-scripts')!;

// ---------------------------------------------------------------------------
// Types for injected globals
// ---------------------------------------------------------------------------
declare global {
  interface Window {
    __FLAGS__?: Record<string, boolean>;
  }
}

// ---------------------------------------------------------------------------
// Helpers — read values injected by addInitScript (or defaults for normal use)
// ---------------------------------------------------------------------------
function readFlags(): Record<string, boolean> {
  return window.__FLAGS__ ?? {};
}

function readLuckyNumber(): number {
  // Uses Math.random() exactly once on mount.
  // When stubbed via addInitScript, Math.random always returns a fixed value.
  return Math.round(Math.random() * 100);
}

function readOnboarded(): boolean {
  return localStorage.getItem('onboarded') === 'true';
}

export function InitScripts() {
  const [flags] = useState<Record<string, boolean>>(readFlags);
  const [luckyNumber] = useState<number>(readLuckyNumber);
  const [onboarded, setOnboarded] = useState<boolean>(readOnboarded);

  function dismissOnboarding() {
    localStorage.setItem('onboarded', 'true');
    setOnboarded(true);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8 p-6">
      <LabHeader lab={lab} />

      {/* ── Onboarding modal ──────────────────────────────────────────── */}
      {!onboarded && (
        <div
          role="dialog"
          aria-labelledby="onboarding-title"
          aria-modal="true"
          className="rounded-lg border border-brand-300 bg-brand-50 p-6 shadow-md"
        >
          <h2 id="onboarding-title" className="text-lg font-semibold text-brand-800">
            Welcome to Init Scripts!
          </h2>
          <p className="mt-2 text-sm text-brand-700">
            This onboarding modal appears when{' '}
            <code className="rounded bg-brand-100 px-1 font-mono text-xs">
              localStorage.onboarded
            </code>{' '}
            is not set. Use{' '}
            <code className="rounded bg-brand-100 px-1 font-mono text-xs">page.addInitScript</code>{' '}
            to seed it before the page loads.
          </p>
          <button
            type="button"
            onClick={dismissOnboarding}
            className="mt-4 rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            Got it — Don't show again
          </button>
        </div>
      )}

      {/* ── Feature flags panel ───────────────────────────────────────── */}
      <section
        aria-labelledby="flags-heading"
        className="rounded-lg border border-edge bg-surface p-6"
      >
        <h2 id="flags-heading" className="text-lg font-semibold text-content">
          Feature Flags
        </h2>
        <p className="mt-1 text-sm text-muted">
          Reads{' '}
          <code className="rounded bg-surface-raised px-1 font-mono text-xs">window.__FLAGS__</code>{' '}
          on load. Inject it with{' '}
          <code className="rounded bg-surface-raised px-1 font-mono text-xs">
            page.addInitScript
          </code>
          .
        </p>

        <div className="mt-4 space-y-2">
          {flags.betaFeature ? (
            <div
              role="banner"
              aria-label="Beta feature banner"
              className="rounded-md bg-amber-50 px-4 py-2 text-sm font-medium text-amber-800 border border-amber-200"
            >
              Beta Feature is <strong>enabled</strong>
            </div>
          ) : (
            <p className="text-sm text-muted" aria-label="Beta feature status">
              No flags injected — <code className="font-mono text-xs">window.__FLAGS__</code> is
              empty or undefined.
            </p>
          )}

          {flags.darkExperiment && (
            <div
              role="note"
              className="rounded-md bg-neutral-800 px-4 py-2 text-sm text-neutral-100"
            >
              Dark Experiment active
            </div>
          )}
        </div>
      </section>

      {/* ── Lucky number panel ────────────────────────────────────────── */}
      <section
        aria-labelledby="lucky-heading"
        className="rounded-lg border border-edge bg-surface p-6"
      >
        <h2 id="lucky-heading" className="text-lg font-semibold text-content">
          Lucky Number
        </h2>
        <p className="mt-1 text-sm text-muted">
          Generated from{' '}
          <code className="rounded bg-surface-raised px-1 font-mono text-xs">Math.random()</code> on
          mount. Stub the function with{' '}
          <code className="rounded bg-surface-raised px-1 font-mono text-xs">addInitScript</code>{' '}
          for a deterministic result.
        </p>
        <p
          className="mt-4 text-4xl font-bold text-brand-600 dark:text-brand-400"
          aria-label="Lucky number"
          data-testid="lucky-number"
        >
          {luckyNumber}
        </p>
      </section>

      {/* ── Onboarding status panel ───────────────────────────────────── */}
      <section
        aria-labelledby="onboard-status-heading"
        className="rounded-lg border border-edge bg-surface p-6"
      >
        <h2 id="onboard-status-heading" className="text-lg font-semibold text-content">
          Onboarding Status
        </h2>
        <p className="mt-1 text-sm text-muted">
          Reads{' '}
          <code className="rounded bg-surface-raised px-1 font-mono text-xs">
            localStorage.onboarded
          </code>
          . Seed it via{' '}
          <code className="rounded bg-surface-raised px-1 font-mono text-xs">addInitScript</code> to
          skip the modal.
        </p>
        <p className="mt-3 text-sm text-content" aria-label="Onboarding state">
          Status:{' '}
          <strong
            className={
              onboarded
                ? 'text-emerald-700 dark:text-emerald-400'
                : 'text-rose-700 dark:text-rose-400'
            }
          >
            {onboarded ? 'Complete' : 'Pending'}
          </strong>
        </p>
      </section>
    </div>
  );
}
