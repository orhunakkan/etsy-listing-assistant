import { useState, useLayoutEffect, useRef } from 'react';
import { LabHeader } from '../../components/LabHeader';
import { labs } from '../../labs';

const lab = labs.find((l) => l.slug === 'emulation-input')!;

const COMMANDS = [
  { id: 1, label: 'New file', shortcut: 'N' },
  { id: 2, label: 'Open file', shortcut: 'O' },
  { id: 3, label: 'Save', shortcut: 'S' },
  { id: 4, label: 'Close tab', shortcut: 'W' },
  { id: 5, label: 'Toggle sidebar', shortcut: 'B' },
  { id: 6, label: 'Find in files', shortcut: 'F' },
  { id: 7, label: 'Run tests', shortcut: 'T' },
  { id: 8, label: 'Open terminal', shortcut: '`' },
];

export function EmulationInput() {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [lastCommand, setLastCommand] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Keyboard: Ctrl+K opens palette; Escape closes; arrows navigate; Enter selects
  useLayoutEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((o) => !o);
        setSelectedIdx(0);
        return;
      }
      if (!paletteOpen) return;
      if (e.key === 'Escape') {
        setPaletteOpen(false);
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIdx((i) => Math.min(i + 1, COMMANDS.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIdx((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        setLastCommand(COMMANDS[selectedIdx]?.label ?? null);
        setPaletteOpen(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [paletteOpen, selectedIdx]);

  const handleScroll = () => {
    if (scrollRef.current) {
      setScrolled(scrollRef.current.scrollTop > 40);
    }
  };

  return (
    <div>
      <LabHeader lab={lab} />

      <div className="space-y-10">
        {/* ── Command palette ────────────────────────────────────────────── */}
        <section aria-labelledby="keyboard-heading">
          <h2 id="keyboard-heading" className="mb-1 text-base font-semibold text-content">
            Keyboard — Command palette
          </h2>
          <p className="mb-4 text-sm text-muted">
            Press{' '}
            <kbd className="rounded border border-edge bg-surface-raised px-1.5 py-0.5 text-xs font-mono">
              Ctrl+K
            </kbd>{' '}
            to open the palette. Navigate with{' '}
            <kbd className="rounded border border-edge bg-surface-raised px-1.5 py-0.5 text-xs font-mono">
              ↑↓
            </kbd>
            , confirm with{' '}
            <kbd className="rounded border border-edge bg-surface-raised px-1.5 py-0.5 text-xs font-mono">
              Enter
            </kbd>
            , dismiss with{' '}
            <kbd className="rounded border border-edge bg-surface-raised px-1.5 py-0.5 text-xs font-mono">
              Esc
            </kbd>
            .
          </p>
          <button
            type="button"
            onClick={() => {
              setPaletteOpen(true);
              setSelectedIdx(0);
            }}
            className="rounded-lg border border-edge bg-surface px-4 py-2 text-sm font-medium text-muted hover:bg-canvas"
          >
            Open command palette
          </button>

          {lastCommand && (
            <p role="status" aria-live="polite" className="mt-3 text-sm text-muted">
              Executed: <strong>{lastCommand}</strong>
            </p>
          )}

          {/* Palette overlay */}
          {paletteOpen && (
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Command palette"
              className="fixed inset-0 z-50 flex items-start justify-center pt-24"
              onClick={() => setPaletteOpen(false)}
            >
              <div
                className="w-full max-w-md rounded-xl border border-edge bg-surface shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="border-b border-edge px-4 py-3 text-xs font-medium text-muted">
                  Command Palette
                </div>
                <ul
                  role="listbox"
                  aria-label="Commands"
                  className="max-h-64 overflow-y-auto py-1"
                  tabIndex={0}
                >
                  {COMMANDS.map((cmd, idx) => (
                    <li
                      key={cmd.id}
                      role="option"
                      aria-selected={idx === selectedIdx}
                      onClick={() => {
                        setLastCommand(cmd.label);
                        setPaletteOpen(false);
                      }}
                      className={[
                        'flex cursor-pointer items-center justify-between px-4 py-2 text-sm',
                        idx === selectedIdx
                          ? 'bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300'
                          : 'text-muted hover:bg-canvas',
                      ].join(' ')}
                    >
                      {cmd.label}
                      <kbd className="text-xs text-muted">⌘{cmd.shortcut}</kbd>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </section>

        {/* ── Hover tooltip ──────────────────────────────────────────────── */}
        <section aria-labelledby="mouse-heading">
          <h2 id="mouse-heading" className="mb-1 text-base font-semibold text-content">
            Mouse — Hover tooltip
          </h2>
          <p className="mb-4 text-sm text-muted">
            Use <code className="rounded bg-surface-raised px-1 text-xs">page.mouse.move()</code> or{' '}
            <code className="rounded bg-surface-raised px-1 text-xs">locator.hover()</code> to
            trigger hover states. Assert that the tooltip becomes visible.
          </p>
          <div className="relative inline-block">
            <button
              type="button"
              onMouseEnter={() => setTooltip(true)}
              onMouseLeave={() => setTooltip(false)}
              onFocus={() => setTooltip(true)}
              onBlur={() => setTooltip(false)}
              aria-describedby="hover-tooltip"
              className="rounded-lg border border-edge bg-surface px-4 py-2 text-sm font-medium text-muted"
            >
              Hover over me
            </button>
            {tooltip && (
              <div
                id="hover-tooltip"
                role="tooltip"
                className="absolute bottom-full left-1/2 mb-2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-content px-3 py-1.5 text-xs text-canvas shadow-lg"
              >
                You found the tooltip! 🎉
              </div>
            )}
          </div>
        </section>

        {/* ── Viewport / responsive ──────────────────────────────────────── */}
        <section aria-labelledby="viewport-heading">
          <h2 id="viewport-heading" className="mb-1 text-base font-semibold text-content">
            Viewport — Responsive layout
          </h2>
          <p className="mb-4 text-sm text-muted">
            Use{' '}
            <code className="rounded bg-surface-raised px-1 text-xs">page.setViewportSize()</code>{' '}
            or Playwright&apos;s{' '}
            <code className="rounded bg-surface-raised px-1 text-xs">devices</code> to emulate
            different screen sizes. This card changes its layout at different widths.
          </p>
          <div
            data-testid="responsive-card"
            className="rounded-xl border border-edge bg-surface p-4 sm:flex sm:items-center sm:gap-4"
          >
            <div className="mb-3 flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-brand-100 dark:bg-brand-950 sm:mb-0">
              <span className="text-xl">🎭</span>
            </div>
            <div>
              <p className="font-semibold text-content">Responsive component</p>
              <p className="mt-0.5 text-sm text-muted sm:hidden">Mobile layout (stacked)</p>
              <p className="mt-0.5 hidden text-sm text-muted sm:block">
                Wide layout (side-by-side)
              </p>
            </div>
          </div>
        </section>

        {/* ── Scroll ─────────────────────────────────────────────────────── */}
        <section aria-labelledby="scroll-heading">
          <h2 id="scroll-heading" className="mb-1 text-base font-semibold text-content">
            Scroll — Sticky action
          </h2>
          <p className="mb-4 text-sm text-muted">
            Use <code className="rounded bg-surface-raised px-1 text-xs">page.mouse.wheel()</code>{' '}
            to scroll the scrollable container below. The &quot;Scroll to top&quot; button appears
            only after scrolling down.
          </p>
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            data-testid="scroll-container"
            className="relative h-40 overflow-y-auto rounded-xl border border-edge bg-canvas p-4"
            tabIndex={0}
            aria-label="Scrollable content"
          >
            {Array.from({ length: 12 }, (_, i) => (
              <p key={i} className="mb-2 text-xs text-muted">
                Line {i + 1} — scroll down to reveal the action button.
              </p>
            ))}
            {scrolled && (
              <button
                type="button"
                onClick={() => scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
                className="sticky bottom-2 left-full block rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white"
              >
                ↑ Scroll to top
              </button>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
