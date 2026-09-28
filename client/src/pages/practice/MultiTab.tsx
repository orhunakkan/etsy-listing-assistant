import { LabHeader } from '../../components/LabHeader';
import { labs } from '../../labs';

const lab = labs.find((l) => l.slug === 'multi-tab')!;

export function MultiTab() {
  const openDashboard = () => {
    window.open('/practice/multi-tab/window', '_blank', 'noopener,noreferrer');
  };

  const openPopup = () => {
    window.open('/practice/multi-tab/popup', 'stagecraft-popup', 'width=480,height=360');
  };

  return (
    <div>
      <LabHeader lab={lab} />

      <div className="space-y-10">
        <section aria-labelledby="newtab-heading">
          <h2 id="newtab-heading" className="mb-1 text-base font-semibold text-content">
            Challenge 1 — New tab
          </h2>
          <p className="mb-4 text-sm text-muted">
            Click the button below to open the dashboard in a new tab. Capture the new page object
            before the tab opens, interact with it, assert a heading, then close it.
          </p>
          <button
            type="button"
            onClick={openDashboard}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            Open dashboard in new tab
          </button>
        </section>

        <section aria-labelledby="popup-heading">
          <h2 id="popup-heading" className="mb-1 text-base font-semibold text-content">
            Challenge 2 — Popup window
          </h2>
          <p className="mb-4 text-sm text-muted">
            This button opens a popup window (not a tab). Capture it before the click, assert
            content inside the popup, and observe how the opener and popup can communicate.
          </p>
          <button
            type="button"
            onClick={openPopup}
            className="rounded-lg border border-brand-300 px-4 py-2 text-sm font-medium text-brand-700 hover:bg-brand-50 dark:border-brand-600 dark:text-brand-300 dark:hover:bg-brand-950"
          >
            Open popup window
          </button>
          <div
            id="opener-result"
            role="status"
            aria-live="polite"
            className="mt-3 text-sm text-muted"
          />
        </section>

        <section aria-labelledby="storage-heading">
          <h2 id="storage-heading" className="mb-1 text-base font-semibold text-content">
            Challenge 3 — Cross-tab storage
          </h2>
          <p className="mb-4 text-sm text-muted">
            Both the main page and the new tab share the same{' '}
            <code className="rounded bg-surface-raised px-1 text-xs">localStorage</code> (same
            origin). Write a value in the new tab and assert it&apos;s visible here after switching
            back.
          </p>
          <div className="rounded-xl border border-edge bg-surface p-4">
            <p className="text-sm text-muted">
              Storage key:{' '}
              <code className="rounded bg-surface-raised px-1 text-xs">multi-tab:shared</code>
            </p>
            <p className="mt-1 text-sm text-muted">
              Current value:{' '}
              <span data-testid="shared-storage-value" className="font-mono">
                {localStorage.getItem('multi-tab:shared') ?? '(none)'}
              </span>
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-2 text-xs text-accent underline hover:text-brand-800 dark:hover:text-brand-300"
            >
              Reload to refresh value
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
