import { useState, useRef } from 'react';
import { LabHeader } from '../../components/LabHeader';
import { labs } from '../../labs';

const lab = labs.find((l) => l.slug === 'touch-gestures')!;

const SLIDES = [
  { id: 1, title: 'Slide 1 — Tap', colour: 'bg-brand-500', emoji: '👆' },
  { id: 2, title: 'Slide 2 — Swipe', colour: 'bg-emerald-600', emoji: '👈' },
  { id: 3, title: 'Slide 3 — Pinch', colour: 'bg-rose-500', emoji: '🤏' },
];

// ---------------------------------------------------------------------------
// Tap counter — only increments on `touch` events (not mouse click)
// ---------------------------------------------------------------------------
function TapCounter() {
  const [count, setCount] = useState(0);

  function handleTouchStart(e: React.TouchEvent) {
    e.preventDefault();
    setCount((c) => c + 1);
  }

  return (
    <section aria-labelledby="tap-heading" className="rounded-lg border border-edge bg-surface p-6">
      <h2 id="tap-heading" className="text-lg font-semibold text-content">
        Tap Counter
      </h2>
      <p className="mt-1 text-sm text-muted">
        This button responds only to <strong>touch</strong> events, not mouse clicks. Use{' '}
        <code className="rounded bg-surface-raised px-1 font-mono text-xs">locator.tap()</code> to
        increment it.
      </p>
      <button
        type="button"
        aria-label="Tap target"
        onTouchStart={handleTouchStart}
        className="mt-4 flex h-20 w-20 items-center justify-center rounded-full bg-brand-600 text-2xl text-white shadow-md select-none touch-none focus:outline-none focus:ring-2 focus:ring-brand-400"
      >
        👆
      </button>
      <p className="mt-3 text-sm text-content">
        Tap count:{' '}
        <strong aria-label="Tap count" data-testid="tap-count">
          {count}
        </strong>
      </p>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Swipe carousel
// ---------------------------------------------------------------------------
function SwipeCarousel() {
  const [current, setCurrent] = useState(0);
  const startXRef = useRef<number | null>(null);

  function handleTouchStart(e: React.TouchEvent) {
    startXRef.current = e.touches[0]?.clientX ?? null;
  }

  function handleTouchEnd(e: React.TouchEvent) {
    if (startXRef.current === null) return;
    const deltaX = (e.changedTouches[0]?.clientX ?? 0) - startXRef.current;
    startXRef.current = null;
    if (deltaX < -30) {
      setCurrent((c) => Math.min(c + 1, SLIDES.length - 1));
    } else if (deltaX > 30) {
      setCurrent((c) => Math.max(c - 1, 0));
    }
  }

  // Keyboard fallback for accessibility
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowRight') setCurrent((c) => Math.min(c + 1, SLIDES.length - 1));
    if (e.key === 'ArrowLeft') setCurrent((c) => Math.max(c - 1, 0));
  }

  const slide = SLIDES[current]!;

  return (
    <section
      aria-labelledby="carousel-heading"
      className="rounded-lg border border-edge bg-surface p-6"
    >
      <h2 id="carousel-heading" className="text-lg font-semibold text-content">
        Swipe Carousel
      </h2>
      <p className="mt-1 text-sm text-muted">
        Swipe left/right to change slides. Use{' '}
        <code className="rounded bg-surface-raised px-1 font-mono text-xs">page.touchscreen</code>{' '}
        or pointer events to drive the gesture in a test.
      </p>

      {/* Slide display */}
      <div
        role="region"
        aria-label="Carousel"
        aria-roledescription="carousel"
        className="mt-4 overflow-hidden rounded-xl"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onKeyDown={handleKeyDown}
        tabIndex={0}
      >
        <div
          aria-label={slide.title}
          aria-live="polite"
          className={`flex h-36 items-center justify-center ${slide.colour} rounded-xl text-white transition-colors duration-200`}
        >
          <span className="text-4xl">{slide.emoji}</span>
          <span className="ml-4 text-xl font-bold">{slide.title}</span>
        </div>
      </div>

      {/* Dot indicators */}
      <div className="mt-3 flex justify-center gap-2" aria-label="Slide indicators">
        {SLIDES.map((s, i) => (
          <button
            key={s.id}
            type="button"
            aria-label={`Go to ${s.title}`}
            aria-current={i === current ? 'true' : undefined}
            onClick={() => setCurrent(i)}
            className={`h-2.5 w-2.5 rounded-full transition-colors ${
              i === current ? 'bg-brand-600' : 'bg-gray-300'
            }`}
          />
        ))}
      </div>

      {/* Keyboard navigation controls for a11y */}
      <div className="mt-3 flex justify-center gap-3">
        <button
          type="button"
          aria-label="Previous slide"
          onClick={() => setCurrent((c) => Math.max(c - 1, 0))}
          disabled={current === 0}
          className="rounded-md border border-edge px-3 py-1 text-sm disabled:opacity-40"
        >
          ← Prev
        </button>
        <button
          type="button"
          aria-label="Next slide"
          onClick={() => setCurrent((c) => Math.min(c + 1, SLIDES.length - 1))}
          disabled={current === SLIDES.length - 1}
          className="rounded-md border border-edge px-3 py-1 text-sm disabled:opacity-40"
        >
          Next →
        </button>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Touch-points info panel
// ---------------------------------------------------------------------------
function TouchInfo() {
  const [info, setInfo] = useState<string | null>(null);

  function inspect() {
    const maxTouch = navigator.maxTouchPoints;
    setInfo(`maxTouchPoints: ${maxTouch}`);
  }

  return (
    <section
      aria-labelledby="touch-info-heading"
      className="rounded-lg border border-edge bg-surface p-6"
    >
      <h2 id="touch-info-heading" className="text-lg font-semibold text-content">
        Device Touch Info
      </h2>
      <p className="mt-1 text-sm text-muted">
        Use{' '}
        <code className="rounded bg-surface-raised px-1 font-mono text-xs">
          devices["iPhone 15"]
        </code>{' '}
        in your browser context and compare{' '}
        <code className="rounded bg-surface-raised px-1 font-mono text-xs">
          navigator.maxTouchPoints
        </code>
        .
      </p>
      <button
        type="button"
        onClick={inspect}
        className="mt-4 rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
      >
        Inspect Touch Points
      </button>
      {info && (
        <p className="mt-3 text-sm text-content" aria-label="Touch info result">
          {info}
        </p>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Lab component
// ---------------------------------------------------------------------------
export function TouchGestures() {
  return (
    <div className="mx-auto max-w-2xl space-y-8 p-6">
      <LabHeader lab={lab} />
      <TapCounter />
      <SwipeCarousel />
      <TouchInfo />
    </div>
  );
}
