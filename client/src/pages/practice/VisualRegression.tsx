import { LabHeader } from '../../components/LabHeader';
import { labs } from '../../labs';

const lab = labs.find((l) => l.slug === 'visual-regression')!;

const BUTTONS = [
  { label: 'Primary', className: 'bg-brand-600 text-white hover:bg-brand-700' },
  {
    label: 'Secondary',
    className:
      'border border-zinc-300 dark:border-edge text-zinc-700 dark:text-muted hover:bg-zinc-50 dark:hover:bg-canvas',
  },
  { label: 'Danger', className: 'bg-red-600 text-white hover:bg-red-700' },
  {
    label: 'Ghost',
    className: 'text-brand-700 hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-950',
  },
  {
    label: 'Disabled',
    className:
      'border border-zinc-200 dark:border-edge text-zinc-400 dark:text-muted cursor-not-allowed opacity-50',
  },
];

const COLORS = [
  { name: 'Indigo 600', hex: '#4f46e5', swatch: 'bg-indigo-600' },
  { name: 'Violet 600', hex: '#7c3aed', swatch: 'bg-violet-600' },
  { name: 'Sky 500', hex: '#0ea5e9', swatch: 'bg-sky-500' },
  { name: 'Emerald 500', hex: '#10b981', swatch: 'bg-emerald-500' },
  { name: 'Amber 400', hex: '#fbbf24', swatch: 'bg-amber-400' },
  { name: 'Rose 500', hex: '#f43f5e', swatch: 'bg-rose-500' },
];

const CARDS = [
  { title: 'Page views', value: '24,521', change: '+12%', up: true },
  { title: 'Unique users', value: '8,034', change: '+5%', up: true },
  { title: 'Bounce rate', value: '34.2%', change: '-3%', up: false },
];

// A simple CSS-only bar chart — no dynamic timestamps, stable for visual tests
const CHART_DATA = [65, 80, 45, 90, 70, 55, 85];
const CHART_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function VisualRegression() {
  return (
    <div>
      <LabHeader lab={lab} />

      <div className="space-y-10">
        {/* ── Button showcase ────────────────────────────────────────────── */}
        <section aria-labelledby="buttons-heading" data-testid="button-showcase">
          <h2 id="buttons-heading" className="mb-4 text-base font-semibold text-content">
            Button variants
          </h2>
          <div className="flex flex-wrap gap-3">
            {BUTTONS.map(({ label, className }) => (
              <button
                key={label}
                type="button"
                disabled={label === 'Disabled'}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${className}`}
              >
                {label}
              </button>
            ))}
          </div>
        </section>

        {/* ── Color palette ──────────────────────────────────────────────── */}
        <section aria-labelledby="colors-heading" data-testid="color-palette">
          <h2 id="colors-heading" className="mb-4 text-base font-semibold text-content">
            Color palette
          </h2>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
            {COLORS.map(({ name, hex, swatch }) => (
              <div key={name} className="flex flex-col items-center gap-1">
                <div
                  className={`h-12 w-full rounded-lg ${swatch}`}
                  role="img"
                  aria-label={`${name} color swatch`}
                />
                <p className="text-center text-xs text-muted">{name}</p>
                <p className="font-mono text-xs text-muted">{hex}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Metric cards ───────────────────────────────────────────────── */}
        <section aria-labelledby="cards-heading" data-testid="metric-cards">
          <h2 id="cards-heading" className="mb-4 text-base font-semibold text-content">
            Metric cards
          </h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {CARDS.map(({ title, value, change, up }) => (
              <div key={title} className="rounded-xl border border-edge bg-surface p-4">
                <p className="text-xs uppercase tracking-wider text-muted">{title}</p>
                <p className="mt-1 text-2xl font-bold text-content">{value}</p>
                <p
                  className={`mt-0.5 text-xs font-medium ${up ? 'text-emerald-800 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}
                >
                  {change} vs last week
                </p>
                {/* Dynamic region — mask this in visual tests */}
                <p
                  data-testid="dynamic-timestamp"
                  className="mt-2 text-xs text-muted"
                  aria-label="Last updated timestamp"
                >
                  Updated: {new Date().toLocaleTimeString()}
                </p>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted">
            Tip: mask{' '}
            <code className="rounded bg-surface-raised px-1">
              [data-testid=&quot;dynamic-timestamp&quot;]
            </code>{' '}
            to prevent timestamp drift from failing the screenshot.
          </p>
        </section>

        {/* ── Bar chart ──────────────────────────────────────────────────── */}
        <section aria-labelledby="chart-heading" data-testid="bar-chart">
          <h2 id="chart-heading" className="mb-4 text-base font-semibold text-content">
            Bar chart
          </h2>
          <div className="rounded-xl border border-edge bg-surface p-4">
            <p className="mb-4 text-xs font-medium text-muted">Weekly sessions</p>
            <div
              className="flex h-32 items-end gap-2"
              role="img"
              aria-label="Weekly sessions bar chart"
            >
              {CHART_DATA.map((pct, i) => (
                <div
                  key={i}
                  className="flex flex-1 flex-col items-center gap-1"
                  aria-label={`${CHART_DAYS[i]}: ${pct} sessions`}
                >
                  <div className="w-full rounded-t bg-brand-500" style={{ height: `${pct}%` }} />
                  <span className="text-xs text-muted">{CHART_DAYS[i]}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── ARIA snapshot comparison note ─────────────────────────────── */}
        <section aria-labelledby="aria-note-heading">
          <h2 id="aria-note-heading" className="mb-1 text-base font-semibold text-content">
            Visual vs ARIA snapshot
          </h2>
          <div className="rounded-xl border border-brand-100 bg-brand-50 p-4 text-sm text-brand-800 dark:border-brand-700 dark:bg-brand-950 dark:text-brand-300">
            <p>
              <strong>Use visual snapshots</strong> for catching pixel-level regressions (color,
              spacing, typography).
            </p>
            <p className="mt-2">
              <strong>Use ARIA snapshots</strong> (
              <code className="rounded bg-brand-100 px-1 text-xs dark:bg-brand-900">
                toMatchAriaSnapshot
              </code>
              ) for catching structural regressions (missing headings, changed roles, lost
              landmarks).
            </p>
            <p className="mt-2">
              See{' '}
              <code className="rounded bg-brand-100 px-1 text-xs dark:bg-brand-900">
                /practice/aria-snapshots
              </code>{' '}
              for the ARIA-focused lab.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
