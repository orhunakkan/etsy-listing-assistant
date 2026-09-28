import { Link } from 'react-router';
import type { Lab } from '../labs';

interface LabCardProps {
  lab: Lab;
  completed?: boolean;
  /** 1-based position in the curriculum, shown as "No. 01". */
  number?: number;
}

export function LabCard({ lab, completed = false, number }: LabCardProps) {
  const isReady = lab.status === 'ready';

  const inner = (
    <article
      className={[
        'group flex h-full flex-col rounded-md border p-6 transition-all duration-200',
        isReady
          ? 'border-edge bg-surface hover:border-accent hover:shadow-[0_12px_32px_rgb(60_40_20/0.10)] dark:hover:shadow-[0_12px_32px_rgb(0_0_0/0.45)] cursor-pointer'
          : 'border-edge/50 bg-canvas/60',
      ].join(' ')}
    >
      <div className="flex min-h-6 items-center justify-between gap-2">
        {number !== undefined && (
          <span className="text-xs font-medium tabular-nums uppercase tracking-[0.12em] text-muted">
            No. {String(number).padStart(2, '0')}
          </span>
        )}

        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          {completed && (
            <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
              ✓ Done
            </span>
          )}
          <span
            className={[
              'rounded-full px-2.5 py-0.5 text-xs font-medium',
              isReady
                ? 'border border-brand-200 text-brand-700 dark:border-brand-900 dark:text-brand-300'
                : 'bg-surface-raised text-muted',
            ].join(' ')}
          >
            {isReady ? 'Ready' : 'Soon'}
          </span>
        </div>
      </div>

      <h2 className="mt-4 font-display text-[28px] leading-[1.05] tracking-tight text-content">
        {lab.title}
      </h2>

      <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">{lab.topic}</p>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {lab.apis.slice(0, 3).map((api) => (
          <span
            key={api}
            className="rounded-sm bg-surface-raised px-2 py-0.5 font-mono text-[11px] text-content leading-normal"
          >
            {api}
          </span>
        ))}
        {lab.apis.length > 3 && (
          <span className="rounded-sm border border-edge px-2 py-0.5 font-mono text-[11px] text-muted leading-normal">
            +{lab.apis.length - 3}
          </span>
        )}
      </div>

      {lab.requiresBackend && (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-muted">
          <svg
            aria-hidden="true"
            className="h-3.5 w-3.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          >
            <polygon points="12 3 19.8 7.5 19.8 16.5 12 21 4.2 16.5 4.2 7.5" />
          </svg>
          Requires backend
        </p>
      )}
    </article>
  );

  if (!isReady) return inner;

  return (
    <Link
      to={`/practice/${lab.slug}`}
      aria-label={lab.title}
      className="flex flex-col h-full rounded-md no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      {inner}
    </Link>
  );
}
