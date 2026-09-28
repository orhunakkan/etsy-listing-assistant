import { useState } from 'react';
import { LabHeader } from '../../components/LabHeader';
import { labs } from '../../labs';

const lab = labs.find((l) => l.slug === 'client-storage-partitioning')!;

type ThemePref = 'system' | 'dark' | 'light';
const THEME_FLOW: ThemePref[] = ['system', 'dark', 'light'];
const THEME_KEY = 'labTheme';
const DRAFT_KEY = 'labDraftNote';
const WIDGET_COOKIE = 'widget_partitioned';

function readThemePref(): ThemePref {
  const stored = localStorage.getItem(THEME_KEY);
  return stored === 'dark' || stored === 'light' ? stored : 'system';
}

function readDraftNote(): string {
  return sessionStorage.getItem(DRAFT_KEY) ?? '';
}

function hasWidgetCookie(): boolean {
  return document.cookie.split('; ').some((entry) => entry.startsWith(`${WIDGET_COOKIE}=`));
}

export function ClientStoragePartitioning() {
  const [themePref, setThemePref] = useState<ThemePref>(readThemePref);
  const [draftNote, setDraftNote] = useState<string>(readDraftNote);
  const [widgetUnlocked, setWidgetUnlocked] = useState<boolean>(hasWidgetCookie);

  const cycleThemePref = () => {
    const next = THEME_FLOW[(THEME_FLOW.indexOf(themePref) + 1) % THEME_FLOW.length]!;
    localStorage.setItem(THEME_KEY, next);
    setThemePref(next);
  };

  const updateDraftNote = (value: string) => {
    sessionStorage.setItem(DRAFT_KEY, value);
    setDraftNote(value);
  };

  const recheckCookie = () => setWidgetUnlocked(hasWidgetCookie());

  return (
    <div>
      <LabHeader lab={lab} />

      <div className="max-w-md space-y-6">
        <section className="rounded-xl border border-edge bg-surface p-4">
          <h2 className="text-sm font-semibold text-content">Theme preference</h2>
          <p className="mt-1 text-sm text-muted" data-testid="theme-pref-value">
            Stored preference: <strong>{themePref}</strong>
          </p>
          <button
            type="button"
            onClick={cycleThemePref}
            className="mt-3 rounded-lg border border-edge px-3 py-1.5 text-sm font-medium text-muted transition-colors hover:bg-canvas"
          >
            Toggle theme preference
          </button>
        </section>

        <section className="rounded-xl border border-edge bg-surface p-4">
          <h2 className="text-sm font-semibold text-content">Draft note</h2>
          <label htmlFor="draft-note" className="sr-only">
            Draft note
          </label>
          <textarea
            id="draft-note"
            value={draftNote}
            onChange={(e) => updateDraftNote(e.target.value)}
            rows={3}
            className="mt-2 w-full rounded-lg border border-edge bg-canvas p-2 text-sm text-content focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </section>

        <section className="rounded-xl border border-edge bg-surface p-4">
          <h2 className="text-sm font-semibold text-content">Embedded widget</h2>
          <p className="mt-1 text-sm text-muted" data-testid="widget-status">
            {widgetUnlocked
              ? 'Widget content unlocked.'
              : `Widget locked — set the "${WIDGET_COOKIE}" cookie to unlock.`}
          </p>
          <button
            type="button"
            onClick={recheckCookie}
            className="mt-3 rounded-lg border border-edge px-3 py-1.5 text-sm font-medium text-muted transition-colors hover:bg-canvas"
          >
            Re-check cookie
          </button>
        </section>
      </div>
    </div>
  );
}
