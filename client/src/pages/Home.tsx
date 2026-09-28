import type { ReactNode } from 'react';
import { labs } from '../labs';
import { LabCard } from '../components/LabCard';
import { useLabProgress } from '../lib/useLabProgress';

function SectionHeading({ children }: { children: ReactNode }) {
  return (
    <div className="mb-6 flex items-center gap-5">
      <h2 className="shrink-0 font-mono text-xs font-medium uppercase tracking-[0.16em] text-muted">
        {children}
      </h2>
      <div aria-hidden="true" className="h-px flex-1 bg-edge" />
    </div>
  );
}

export function Home() {
  const { isCompleted } = useLabProgress();
  const readyLabs = labs.filter((l) => l.status === 'ready');
  const comingSoonLabs = labs.filter((l) => l.status === 'coming-soon');
  const completedCount = readyLabs.filter((l) => isCompleted(l.slug)).length;
  const progressPercent = readyLabs.length ? (completedCount / readyLabs.length) * 100 : 0;

  return (
    <div>
      <div className="mb-14 flex flex-col gap-8 lg:mb-16 lg:flex-row lg:items-end lg:justify-between lg:gap-16">
        <div>
          <span className="block font-mono text-xs uppercase tracking-[0.16em] text-accent sm:text-[13px]">
            Playwright practice labs
          </span>
          <h1 className="mt-5 font-display text-7xl leading-[0.88] tracking-[-0.035em] text-content sm:text-8xl xl:text-[8.5rem]">
            Practice <em className="italic text-accent">Labs</em>
          </h1>
        </div>

        <div className="max-w-md lg:shrink-0 lg:pb-2">
          <p className="text-base leading-relaxed text-muted sm:text-[17px]">
            Interactive Playwright challenges. Read the lab, interact with the UI, then write your
            own tests in a separate project — no spoilers here.
          </p>
          <div className="mt-7">
            <div className="flex justify-between font-mono text-xs sm:text-[13px]">
              <span className="text-muted">Your progress</span>
              <span className="text-content">
                {completedCount} of {readyLabs.length} complete
              </span>
            </div>
            <div
              aria-hidden="true"
              className="mt-2.5 h-1 overflow-hidden rounded-full bg-surface-raised"
            >
              <div
                className="h-full rounded-full bg-accent transition-[width] duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      <section className="mb-14" aria-label="Ready labs">
        <SectionHeading>Ready — {readyLabs.length} labs</SectionHeading>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {readyLabs.map((lab, i) => (
            <LabCard key={lab.slug} lab={lab} number={i + 1} completed={isCompleted(lab.slug)} />
          ))}
        </div>
      </section>

      <section aria-label="Coming soon labs">
        <SectionHeading>Coming soon — {comingSoonLabs.length} labs</SectionHeading>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {comingSoonLabs.map((lab) => (
            <LabCard key={lab.slug} lab={lab} />
          ))}
        </div>
      </section>
    </div>
  );
}
