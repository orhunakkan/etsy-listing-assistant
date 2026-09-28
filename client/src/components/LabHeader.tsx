import { useLabProgress } from '../lib/useLabProgress';
import { labs } from '../labs';
import type { Lab } from '../labs';

interface LabHeaderProps {
  lab: Lab;
}

export function LabHeader({ lab }: LabHeaderProps) {
  const { isCompleted, toggle } = useLabProgress();
  const done = isCompleted(lab.slug);
  // Same numbering as the Home page cards ("No. 03").
  const position = labs.filter((l) => l.status === 'ready').findIndex((l) => l.slug === lab.slug);
  const guidance = lab.guidance ?? [];
  const hasGuidance = guidance.length > 0;

  return (
    <div className="mb-10 border-b border-edge pb-10 lg:mb-12 lg:pb-12">
      <div
        className={
          hasGuidance
            ? 'grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:gap-16 xl:grid-cols-[minmax(0,1fr)_minmax(0,29rem)]'
            : undefined
        }
      >
        <div>
          {position >= 0 && (
            <span className="block font-mono text-xs uppercase tracking-[0.16em] text-accent sm:text-[13px]">
              Lab No. {String(position + 1).padStart(2, '0')}
            </span>
          )}
          <h1 className="mt-4 font-display text-5xl leading-[0.95] tracking-[-0.03em] text-content sm:text-6xl xl:text-7xl">
            {lab.title}
          </h1>
          <p className="mt-4 text-lg text-muted">{lab.topic}</p>

          <div className="mt-5 flex flex-wrap gap-2">
            {lab.apis.map((api) => (
              <span
                key={api}
                className="rounded-sm bg-brand-50 px-2.5 py-1 font-mono text-xs text-brand-800 dark:bg-brand-950 dark:text-brand-300"
              >
                {api}
              </span>
            ))}
          </div>

          {lab.goal && (
            <p className="mt-6 max-w-2xl text-base leading-relaxed text-content sm:text-[17px]">
              {lab.goal}
            </p>
          )}

          <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-3">
            <button
              type="button"
              onClick={() => toggle(lab.slug)}
              aria-pressed={done}
              className={[
                'inline-flex h-11 shrink-0 items-center rounded-full border px-5 text-sm font-medium transition-colors',
                done
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 dark:hover:bg-emerald-900'
                  : 'border-content bg-surface text-content hover:border-accent hover:text-accent',
              ].join(' ')}
            >
              {done ? '✓ Completed' : 'Mark complete'}
            </button>
            {lab.docsUrl && (
              <a
                href={lab.docsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm font-medium text-accent underline-offset-4 hover:underline"
              >
                Playwright Docs
                <span aria-hidden="true">↗</span>
              </a>
            )}
          </div>
        </div>

        {hasGuidance && (
          <aside className="self-start rounded-md border border-edge bg-surface p-6 sm:p-8">
            <h2 className="font-mono text-xs font-medium uppercase tracking-[0.16em] text-muted">
              Guidance
            </h2>
            <ol className="mt-5 space-y-4 [counter-reset:hint]">
              {guidance.map((hint, i) => (
                <li
                  key={i}
                  className="relative pl-9 text-sm leading-relaxed text-muted [counter-increment:hint] before:absolute before:left-0 before:top-0 before:font-display before:text-[28px] before:leading-[0.9] before:text-accent before:content-[counter(hint)]"
                >
                  {hint}
                </li>
              ))}
            </ol>
          </aside>
        )}
      </div>
    </div>
  );
}
