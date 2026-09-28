import { useState } from 'react';
import { LabHeader } from '../../components/LabHeader';
import { labs } from '../../labs';

const lab = labs.find((l) => l.slug === 'accessibility-scanning')!;

// ── Broken form (default state) ───────────────────────────────────────────────
// Intentional violations detectable by axe-core:
//   1. Input with no associated label (aria-label / for+id)
//   2. Button with insufficient colour contrast
//   3. Image with no alt attribute
function BrokenForm() {
  return (
    <div id="form-region">
      {/* Violation 1: input missing label */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Your name"
          className="w-full rounded border border-edge bg-canvas px-3 py-2 text-sm text-content focus:outline-none"
        />
      </div>

      {/* Control group — correctly labelled */}
      <div className="mb-4">
        <label htmlFor="email-broken" className="mb-1 block text-sm font-medium text-content">
          Email
        </label>
        <input
          id="email-broken"
          type="email"
          className="w-full rounded border border-edge bg-canvas px-3 py-2 text-sm text-content focus:outline-none"
        />
      </div>

      {/* Violation 2: very low-contrast button (light grey text on white) */}
      <button
        type="button"
        style={{ color: '#aaa', backgroundColor: '#fff', border: '1px solid #ddd' }}
        className="mb-4 rounded px-4 py-2 text-sm"
      >
        Submit Form
      </button>

      {/* Violation 3: image missing alt */}
      {/* eslint-disable-next-line jsx-a11y/alt-text */}
      <img
        src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='40'%3E%3Crect width='80' height='40' fill='%234f46e5'/%3E%3C/svg%3E"
        width={80}
        height={40}
        className="block"
      />
    </div>
  );
}

// ── Accessible form (toggled state) ──────────────────────────────────────────
function AccessibleForm() {
  return (
    <div id="form-region">
      {/* Fixed 1: input with label */}
      <div className="mb-4">
        <label htmlFor="name-accessible" className="mb-1 block text-sm font-medium text-content">
          Your Name
        </label>
        <input
          id="name-accessible"
          type="text"
          className="w-full rounded border border-edge bg-canvas px-3 py-2 text-sm text-content focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
      </div>

      {/* Control group */}
      <div className="mb-4">
        <label htmlFor="email-accessible" className="mb-1 block text-sm font-medium text-content">
          Email
        </label>
        <input
          id="email-accessible"
          type="email"
          className="w-full rounded border border-edge bg-canvas px-3 py-2 text-sm text-content focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
      </div>

      {/* Fixed 2: sufficient contrast */}
      <button
        type="button"
        className="mb-4 rounded bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500"
      >
        Submit Form
      </button>

      {/* Fixed 3: image with descriptive alt */}
      <img
        src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='40'%3E%3Crect width='80' height='40' fill='%234f46e5'/%3E%3C/svg%3E"
        alt="Indigo decorative bar"
        width={80}
        height={40}
        className="block"
      />
    </div>
  );
}

export function AccessibilityScanning() {
  const [accessible, setAccessible] = useState(false);

  return (
    <div className="mx-auto max-w-2xl space-y-8 p-6">
      <LabHeader lab={lab} />

      {/* Toggle */}
      <div className="flex items-center gap-3 rounded-lg border border-edge bg-surface p-4">
        <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-content select-none">
          <input
            type="checkbox"
            checked={accessible}
            onChange={(e) => setAccessible(e.target.checked)}
            className="h-4 w-4 rounded border-edge text-brand-600 focus:ring-brand-500"
            aria-label="Show accessible controls"
          />
          Show accessible controls
        </label>
        <span
          className={[
            'rounded px-2 py-0.5 text-xs font-medium',
            accessible
              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
              : 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
          ].join(' ')}
        >
          {accessible ? 'Accessible' : 'Has violations'}
        </span>
      </div>

      {/* Form panel */}
      <section
        aria-labelledby="form-heading"
        className="rounded-lg border border-edge bg-surface p-6"
      >
        <h2 id="form-heading" className="mb-4 text-lg font-semibold text-content">
          Settings Form
        </h2>
        {accessible ? <AccessibleForm /> : <BrokenForm />}
      </section>
    </div>
  );
}
