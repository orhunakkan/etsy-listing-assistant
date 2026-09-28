import { useState, useEffect } from 'react';
import { LabHeader } from '../../components/LabHeader';
import { labs } from '../../labs';

const lab = labs.find((l) => l.slug === 'media-locale')!;

// Colour-scheme panel — reads window.matchMedia, not React state
function ColorSchemePanel() {
  const [label, setLabel] = useState('');

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    setLabel(mq.matches ? 'Dark' : 'Light');
    const handler = (e: MediaQueryListEvent) => setLabel(e.matches ? 'Dark' : 'Light');
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return (
    <section
      aria-labelledby="color-scheme-heading"
      className="rounded-lg border border-edge bg-surface p-6"
      style={{ colorScheme: 'light dark' }}
    >
      <h2 id="color-scheme-heading" className="text-lg font-semibold text-content">
        Colour Scheme
      </h2>
      <p className="mt-1 text-sm text-muted">
        Driven by <code>@media (prefers-color-scheme)</code> via <code>window.matchMedia</code>.
      </p>
      <p className="mt-4 text-sm text-content">
        Current scheme:{' '}
        <strong aria-live="polite" data-testid="color-scheme-label">
          {label}
        </strong>
      </p>
    </section>
  );
}

// Reduced-motion panel
function MotionPanel() {
  const [label, setLabel] = useState('');

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setLabel(mq.matches ? 'Reduced' : 'Motion on');
    const handler = (e: MediaQueryListEvent) => setLabel(e.matches ? 'Reduced' : 'Motion on');
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return (
    <section
      aria-labelledby="motion-heading"
      className="rounded-lg border border-edge bg-surface p-6"
    >
      <h2 id="motion-heading" className="text-lg font-semibold text-content">
        Reduced Motion
      </h2>
      <p className="mt-1 text-sm text-muted">
        Driven by <code>@media (prefers-reduced-motion)</code>.
      </p>
      <div
        aria-hidden="true"
        className="mt-4 h-6 w-6 rounded-full bg-brand-500"
        style={label === 'Motion on' ? { animation: 'spin 1s linear infinite' } : undefined}
      />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <p className="mt-3 text-sm text-content">
        Motion preference:{' '}
        <strong aria-live="polite" data-testid="motion-label">
          {label}
        </strong>
      </p>
    </section>
  );
}

// Print-media panel — visible only when @media print is active
function PrintPanel() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('print');
    setVisible(mq.matches);
    const handler = (e: MediaQueryListEvent) => setVisible(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return (
    <section
      aria-labelledby="print-heading"
      className="rounded-lg border border-edge bg-surface p-6"
    >
      <h2 id="print-heading" className="text-lg font-semibold text-content">
        Print Media
      </h2>
      <p className="mt-1 text-sm text-muted">
        The banner below is only visible when <code>@media print</code> is active.
      </p>
      {visible && (
        <p
          data-testid="print-banner"
          className="mt-4 rounded border border-edge bg-canvas px-3 py-2 text-sm text-content"
        >
          Print layout active
        </p>
      )}
      {!visible && (
        <p className="mt-4 text-sm text-muted italic">(Emulate print media to see the banner.)</p>
      )}
    </section>
  );
}

// Date & currency panel — uses browser locale, no hardcoded locale string
function LocalePanel() {
  const now = new Date(2026, 4, 21); // fixed date for predictable assertions
  const dateStr = new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(now);

  const currencyStr = new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'EUR',
  }).format(1234.56);

  return (
    <section
      aria-labelledby="locale-heading"
      className="rounded-lg border border-edge bg-surface p-6"
    >
      <h2 id="locale-heading" className="text-lg font-semibold text-content">
        Locale & Timezone
      </h2>
      <p className="mt-1 text-sm text-muted">
        Uses <code>Intl.DateTimeFormat</code> and <code>Intl.NumberFormat</code> with the
        browser&apos;s current locale.
      </p>
      <dl className="mt-4 space-y-2 text-sm">
        <div className="flex gap-2">
          <dt className="text-muted">Date:</dt>
          <dd data-testid="locale-date" className="font-medium text-content">
            {dateStr}
          </dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-muted">Currency:</dt>
          <dd data-testid="locale-currency" className="font-medium text-content">
            {currencyStr}
          </dd>
        </div>
      </dl>
    </section>
  );
}

export function MediaLocale() {
  return (
    <div className="mx-auto max-w-2xl space-y-8 p-6">
      <LabHeader lab={lab} />
      <ColorSchemePanel />
      <MotionPanel />
      <PrintPanel />
      <LocalePanel />
    </div>
  );
}
