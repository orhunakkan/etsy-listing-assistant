import { useState } from 'react';
import { LabHeader } from '../../components/LabHeader';
import { labs } from '../../labs';

const lab = labs.find((l) => l.slug === 'locator-handlers')!;

type OverlayType = 'cookie' | 'newsletter' | 'survey' | null;

const STEPS = ['Cart', 'Shipping', 'Payment', 'Confirmation'];

function CookieBanner({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="cookie-title"
      className="fixed bottom-4 left-4 right-4 z-50 rounded-lg border border-amber-300 bg-amber-50 p-4 shadow-lg dark:border-amber-700 dark:bg-amber-950 sm:left-auto sm:right-4 sm:max-w-sm"
    >
      <h3 id="cookie-title" className="font-semibold text-amber-900 dark:text-amber-100">
        Cookie Consent
      </h3>
      <p className="mt-1 text-sm text-amber-800 dark:text-amber-200">
        We use cookies to improve your experience.
      </p>
      <button
        type="button"
        onClick={onDismiss}
        className="mt-3 rounded bg-amber-600 px-3 py-1 text-sm font-medium text-white hover:bg-amber-700"
      >
        Accept & Close
      </button>
    </div>
  );
}

function NewsletterModal({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="newsletter-title"
        className="w-full max-w-sm rounded-lg border border-edge bg-surface p-6 shadow-xl"
      >
        <h3 id="newsletter-title" className="text-lg font-semibold text-content">
          Get 10% off your next order!
        </h3>
        <p className="mt-2 text-sm text-muted">Subscribe to our newsletter for exclusive deals.</p>
        <div className="mt-4 flex gap-3">
          <button
            type="button"
            onClick={onDismiss}
            className="rounded bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
          >
            No thanks
          </button>
        </div>
      </div>
    </div>
  );
}

function SurveyDialog({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="survey-title"
        className="w-full max-w-sm rounded-lg border border-edge bg-surface p-6 shadow-xl"
      >
        <h3 id="survey-title" className="text-lg font-semibold text-content">
          Quick Session Survey
        </h3>
        <p className="mt-2 text-sm text-muted">How would you rate your experience so far?</p>
        <button
          type="button"
          onClick={onDismiss}
          className="mt-4 rounded border border-edge bg-surface px-3 py-1.5 text-sm font-medium text-content hover:border-brand-300"
        >
          Skip Survey
        </button>
      </div>
    </div>
  );
}

export function LocatorHandlers() {
  const [step, setStep] = useState(0);
  const [overlay, setOverlay] = useState<OverlayType>(null);
  const [forceOverlays, setForceOverlays] = useState(false);

  // Pick a random overlay type (or always cycle when forced)
  function pickOverlay(currentStep: number): OverlayType {
    if (forceOverlays) {
      const types: OverlayType[] = ['cookie', 'newsletter', 'survey'];
      return types[currentStep % types.length]!;
    }
    // ~50% chance of showing an overlay when not forced
    if (Math.random() < 0.5) return null;
    const types: OverlayType[] = ['cookie', 'newsletter', 'survey'];
    return types[Math.floor(Math.random() * types.length)]!;
  }

  function handleNext() {
    const nextStep = step + 1;
    if (nextStep < STEPS.length) {
      setStep(nextStep);
      const chosen = pickOverlay(nextStep);
      if (chosen) setOverlay(chosen);
    }
  }

  function dismissOverlay() {
    setOverlay(null);
  }

  const isComplete = step === STEPS.length - 1;

  return (
    <div className="mx-auto max-w-2xl space-y-8 p-6">
      <LabHeader lab={lab} />

      {/* Controls */}
      <div className="flex items-center gap-3 rounded-lg border border-edge bg-surface p-4">
        <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-content select-none">
          <input
            type="checkbox"
            checked={forceOverlays}
            onChange={(e) => setForceOverlays(e.target.checked)}
            className="h-4 w-4 rounded border-edge text-brand-600 focus:ring-brand-500"
            aria-label="Force overlays every step"
          />
          Force overlays every step
        </label>
      </div>

      {/* Stepper */}
      <section
        aria-labelledby="checkout-heading"
        className="rounded-lg border border-edge bg-surface p-6"
      >
        <h2 id="checkout-heading" className="text-lg font-semibold text-content">
          Checkout Flow
        </h2>

        {/* Step indicators */}
        <ol aria-label="Checkout steps" className="mt-4 flex gap-2">
          {STEPS.map((s, i) => (
            <li
              key={s}
              aria-current={i === step ? 'step' : undefined}
              className={[
                'flex-1 rounded px-2 py-1 text-center text-xs font-medium',
                i < step
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                  : i === step
                    ? 'bg-brand-100 text-brand-700 dark:bg-brand-950 dark:text-brand-300'
                    : 'bg-surface text-muted border border-edge',
              ].join(' ')}
            >
              {s}
            </li>
          ))}
        </ol>

        <div className="mt-6">
          {isComplete ? (
            <div role="status" className="text-center">
              <p className="text-lg font-semibold text-emerald-700 dark:text-emerald-400">
                Order Confirmed!
              </p>
              <p className="mt-1 text-sm text-muted">Thank you for your purchase.</p>
              <button
                type="button"
                onClick={() => {
                  setStep(0);
                  setOverlay(null);
                }}
                className="mt-4 rounded border border-edge px-4 py-2 text-sm text-muted hover:border-brand-300"
              >
                Start over
              </button>
            </div>
          ) : (
            <div>
              <p className="text-sm text-muted">
                Step {step + 1} of {STEPS.length - 1}: <strong>{STEPS[step]}</strong>
              </p>
              <button
                type="button"
                onClick={handleNext}
                className="mt-4 rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                {step === STEPS.length - 2 ? 'Place Order' : 'Next'}
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Overlays */}
      {overlay === 'cookie' && <CookieBanner onDismiss={dismissOverlay} />}
      {overlay === 'newsletter' && <NewsletterModal onDismiss={dismissOverlay} />}
      {overlay === 'survey' && <SurveyDialog onDismiss={dismissOverlay} />}
    </div>
  );
}
