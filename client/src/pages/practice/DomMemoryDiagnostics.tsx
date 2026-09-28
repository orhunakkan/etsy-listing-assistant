import { useRef, useState } from 'react';
import { LabHeader } from '../../components/LabHeader';
import { labs } from '../../labs';

const lab = labs.find((l) => l.slug === 'dom-memory-diagnostics')!;

interface Toast {
  id: number;
  message: string;
}

const TOAST_LIFETIME_MS = 1500;
const SPAWN_COUNT = 50;

export function DomMemoryDiagnostics() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [graveyard, setGraveyard] = useState<Toast[]>([]);
  const nextId = useRef(0);

  const spawnToast = () => {
    const id = nextId.current++;
    const toast: Toast = { id, message: `Notification #${id}` };
    setToasts((prev) => [...prev, toast]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
      // Bug: dismissed toasts are archived here but never pruned, so retained
      // nodes keep growing even though nothing is visibly "leaking" anymore.
      setGraveyard((prev) => [...prev, toast]);
    }, TOAST_LIFETIME_MS);
  };

  const spawnFifty = () => {
    for (let i = 0; i < SPAWN_COUNT; i++) spawnToast();
  };

  const clearGraveyard = () => setGraveyard([]);

  return (
    <div>
      <LabHeader lab={lab} />

      <div className="max-w-lg space-y-6">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={spawnFifty}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
          >
            Spawn 50 toasts
          </button>
          <button
            type="button"
            onClick={clearGraveyard}
            className="rounded-lg border border-edge px-4 py-2 text-sm font-medium text-muted transition-colors hover:bg-canvas"
          >
            Clear leaked nodes
          </button>
        </div>

        <div className="rounded-xl border border-edge bg-surface p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">
            Active toasts
          </h2>
          <p className="mt-1 text-sm text-content" data-testid="active-toast-count">
            {toasts.length} active
          </p>
        </div>

        <div className="rounded-xl border border-edge bg-surface p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">
            Dismissed toast graveyard (the leak)
          </h2>
          <p className="mt-1 text-sm text-content" data-testid="graveyard-count">
            {graveyard.length} retained nodes
          </p>
          <ul
            aria-label="Leaked toast nodes"
            tabIndex={0}
            className="mt-2 max-h-40 space-y-1 overflow-y-auto text-xs text-muted"
          >
            {graveyard.map((toast) => (
              <li key={toast.id} data-testid="graveyard-item">
                {toast.message}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
