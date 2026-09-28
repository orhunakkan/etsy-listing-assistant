import { useState } from 'react';
import { LabHeader } from '../../components/LabHeader';
import { labs } from '../../labs';

const lab = labs.find((l) => l.slug === 'frames-contexts')!;

// Served as same-origin static files (rather than data: URIs) so the app's
// strict Content-Security-Policy doesn't have to relax script-src / frame-src
// for the whole site just to let these two lab iframes run their inline JS.
const counterSrc = '/lab-frames/counter.html';
const formSrc = '/lab-frames/login.html';

export function FramesContexts() {
  const [activeChallenge, setActiveChallenge] = useState<1 | 2>(1);

  return (
    <div>
      <LabHeader lab={lab} />

      <p className="mb-6 text-sm text-muted">
        Use{' '}
        <code className="rounded bg-surface-raised px-1 text-xs">page.frameLocator(selector)</code>{' '}
        to scope all subsequent locator calls inside a specific iframe. Locators outside that frame
        won&apos;t match elements inside it.
      </p>

      {/* Challenge tabs */}
      <div className="mb-6 flex gap-2" role="tablist" aria-label="Frame challenges">
        {([1, 2] as const).map((n) => (
          <button
            key={n}
            type="button"
            role="tab"
            aria-selected={activeChallenge === n}
            onClick={() => setActiveChallenge(n)}
            className={[
              'rounded-lg border px-4 py-1.5 text-sm font-medium transition-colors',
              activeChallenge === n
                ? 'border-brand-500 bg-brand-700 text-white'
                : 'border-edge text-muted hover:border-edge hover:bg-canvas',
            ].join(' ')}
          >
            Challenge {n}
          </button>
        ))}
      </div>

      <div role="tabpanel">
        {activeChallenge === 1 && (
          <div className="space-y-4">
            <div className="rounded-xl border border-edge bg-canvas p-4">
              <h2 className="mb-1 text-sm font-semibold text-content">
                Challenge 1 — Counter in an iframe
              </h2>
              <p className="mb-4 text-xs text-muted">
                Use{' '}
                <code className="rounded bg-surface-raised px-1 text-xs">
                  page.frameLocator(&apos;iframe[title=&quot;Counter frame&quot;]&apos;)
                </code>{' '}
                to interact with the counter and assert its value. Try changing the step size before
                incrementing.
              </p>
              <iframe
                src={counterSrc}
                title="Counter frame"
                className="h-52 w-full rounded-lg border border-edge bg-surface"
              />
            </div>
          </div>
        )}

        {activeChallenge === 2 && (
          <div className="space-y-4">
            <div className="rounded-xl border border-edge bg-canvas p-4">
              <h2 className="mb-1 text-sm font-semibold text-content">
                Challenge 2 — Login form in an iframe
              </h2>
              <p className="mb-4 text-xs text-muted">
                Scope a locator into the login iframe and fill the username and password fields.
                Assert the success message that appears after submitting. Notice that{' '}
                <code className="rounded bg-surface-raised px-1 text-xs">page.getByLabel()</code>{' '}
                alone won&apos;t reach inside the frame.
              </p>
              <iframe
                src={formSrc}
                title="Login frame"
                className="h-56 w-full rounded-lg border border-edge bg-surface"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
