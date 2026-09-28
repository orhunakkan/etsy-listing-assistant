import { useState } from 'react';
import { LabHeader } from '../../components/LabHeader';
import { labs } from '../../labs';

const lab = labs.find((l) => l.slug === 'aria-snapshots')!;

const STEPS = ['Account', 'Profile', 'Preferences', 'Review'];

const ACCORDION_SECTIONS = [
  {
    id: 'what-is',
    title: 'What is an ARIA snapshot?',
    content:
      'An ARIA snapshot is a YAML representation of the full accessibility tree of a page or element. It captures roles, names, properties, and hierarchy — the information assistive technologies use to describe a UI to users.',
  },
  {
    id: 'when-to-use',
    title: 'When should I use toMatchAriaSnapshot?',
    content:
      'Use it to catch structural regressions: a heading that changed level, a button that became a link, a list that lost items, or a landmark that was removed. It complements visual regression tests by asserting semantics, not pixels.',
  },
  {
    id: 'vs-role',
    title: 'How is this different from getByRole?',
    content:
      'getByRole finds a single element by its ARIA role and accessible name. toMatchAriaSnapshot asserts the entire subtree structure — multiple elements, their nesting, and their relationships — in a single assertion.',
  },
];

type AccordionSection = (typeof ACCORDION_SECTIONS)[number];

export function AriaSnapshots() {
  const [openSection, setOpenSection] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [announcement, setAnnouncement] = useState('');

  const toggleSection = (section: AccordionSection) => {
    const isCurrentlyOpen = openSection === section.id;
    setOpenSection(isCurrentlyOpen ? null : section.id);
    setAnnouncement(`${section.title} ${isCurrentlyOpen ? 'collapsed' : 'expanded'}`);
  };

  return (
    <div>
      <LabHeader lab={lab} />

      {/* Live region for announcements */}
      <div role="status" aria-live="polite" className="sr-only">
        {announcement}
      </div>

      <div className="space-y-10">
        {/* ── Accordion ──────────────────────────────────────────────────── */}
        <section aria-labelledby="accordion-heading">
          <h2 id="accordion-heading" className="mb-1 text-base font-semibold text-content">
            Challenge 1 — Accordion
          </h2>
          <p className="mb-4 text-sm text-muted">
            Capture the ARIA snapshot of the accordion. Open different sections and assert that the
            tree updates correctly — expanded sections reveal child content nodes. Try{' '}
            <code className="rounded bg-surface-raised px-1 text-xs">/children: equal</code> for
            strict matching.
          </p>

          <div className="divide-y divide-edge rounded-xl border border-edge bg-surface">
            {ACCORDION_SECTIONS.map((section) => {
              const isOpen = openSection === section.id;
              return (
                <div key={section.id}>
                  <h3>
                    <button
                      type="button"
                      onClick={() => toggleSection(section)}
                      aria-expanded={isOpen}
                      aria-controls={`${section.id}-content`}
                      id={`${section.id}-btn`}
                      className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-content hover:bg-canvas"
                    >
                      {section.title}
                      <span aria-hidden="true" className="ml-2 shrink-0 text-muted">
                        {isOpen ? '▲' : '▼'}
                      </span>
                    </button>
                  </h3>
                  <div
                    id={`${section.id}-content`}
                    role="region"
                    aria-labelledby={`${section.id}-btn`}
                    hidden={!isOpen}
                    className="px-4 pb-4 pt-1 text-sm text-muted"
                  >
                    {section.content}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── Wizard / step indicator ───────────────────────────────────── */}
        <section aria-labelledby="wizard-heading">
          <h2 id="wizard-heading" className="mb-1 text-base font-semibold text-content">
            Challenge 2 — Step wizard
          </h2>
          <p className="mb-4 text-sm text-muted">
            Navigate through the wizard steps. Assert that the{' '}
            <code className="rounded bg-surface-raised px-1 text-xs">
              aria-current=&quot;step&quot;
            </code>{' '}
            attribute moves to the correct step. Capture before/after snapshots to verify structural
            transitions.
          </p>

          <nav aria-label="Registration wizard steps" className="mb-6">
            <ol className="flex gap-2">
              {STEPS.map((label, i) => (
                <li key={label}>
                  <button
                    type="button"
                    aria-current={i === step ? 'step' : undefined}
                    onClick={() => setStep(i)}
                    className={[
                      'rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
                      i === step
                        ? 'border-brand-500 bg-brand-700 text-white'
                        : i < step
                          ? 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                          : 'border-edge text-muted',
                    ].join(' ')}
                  >
                    {i + 1}. {label}
                  </button>
                </li>
              ))}
            </ol>
          </nav>

          <div
            role="form"
            aria-label={`${STEPS[step]} step`}
            className="rounded-xl border border-edge bg-surface p-4"
          >
            <h3 className="mb-3 text-sm font-semibold text-content">
              Step {step + 1}: {STEPS[step]}
            </h3>
            {step === 0 && (
              <div className="space-y-3">
                <label className="block text-xs text-muted">
                  Email
                  <input
                    type="email"
                    aria-label="Email address"
                    className="mt-1 block w-full rounded-lg border border-edge px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none"
                    placeholder="you@example.com"
                  />
                </label>
              </div>
            )}
            {step === 1 && (
              <div className="space-y-3">
                <label className="block text-xs text-muted">
                  Display name
                  <input
                    type="text"
                    aria-label="Display name"
                    className="mt-1 block w-full rounded-lg border border-edge px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none"
                    placeholder="Your name"
                  />
                </label>
              </div>
            )}
            {step === 2 && (
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm text-muted">
                  <input type="checkbox" aria-label="Email notifications" />
                  Email notifications
                </label>
                <label className="flex items-center gap-2 text-sm text-muted">
                  <input type="checkbox" aria-label="Dark mode" />
                  Dark mode
                </label>
              </div>
            )}
            {step === 3 && (
              <p className="text-sm text-muted">
                Review your details and submit. The accessibility tree at this step differs
                structurally from the others — assert it with a separate snapshot.
              </p>
            )}
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setStep((s) => Math.max(0, s - 1))}
                disabled={step === 0}
                className="rounded-lg border border-edge px-3 py-1.5 text-xs font-medium text-muted disabled:opacity-40"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
                disabled={step === STEPS.length - 1}
                className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </section>

        {/* ── Live region ───────────────────────────────────────────────── */}
        <section aria-labelledby="live-heading">
          <h2 id="live-heading" className="mb-1 text-base font-semibold text-content">
            Challenge 3 — Live region
          </h2>
          <p className="mb-4 text-sm text-muted">
            The announcement region updates when accordion sections are toggled. Capture a snapshot
            that includes the live region and verify its content changes predictably.
          </p>
          <div
            aria-label="Live announcements"
            aria-live="polite"
            className="min-h-[2.5rem] rounded-xl border border-dashed border-edge bg-canvas px-4 py-2 text-sm text-muted"
          >
            {announcement || <span className="text-muted">No announcement yet</span>}
          </div>
        </section>
      </div>
    </div>
  );
}
