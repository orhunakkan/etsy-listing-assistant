import { useEffect, useRef } from 'react';
import { LabHeader } from '../../components/LabHeader';
import { labs } from '../../labs';

const lab = labs.find((l) => l.slug === 'shadow-dom')!;

type RatingWidgetElement = HTMLElement & { value: number };
type LabelledInputElement = HTMLElement & { inputValue: string };

// ---------------------------------------------------------------------------
// Custom element: star-rating widget
// Renders 5 radio-like stars inside an open shadow root.
// Host exposes a `value` attribute that reflects the selected rating.
// ---------------------------------------------------------------------------
function defineRatingWidget() {
  if (customElements.get('rating-widget')) return;

  class RatingWidget extends HTMLElement {
    static get observedAttributes() {
      return ['value'];
    }

    private shadow: ShadowRoot;
    private _value = 0;

    constructor() {
      super();
      this.shadow = this.attachShadow({ mode: 'open' });
    }

    connectedCallback() {
      this._render();
    }

    attributeChangedCallback(_name: string, _old: string | null, next: string | null) {
      this._value = parseInt(next ?? '0', 10) || 0;
      this._render();
    }

    get value() {
      return this._value;
    }

    set value(v: number) {
      this._value = v;
      this.setAttribute('value', String(v));
    }

    private _render() {
      this.shadow.innerHTML = `
        <style>
          :host { display: inline-flex; gap: 4px; }
          button {
            background: none; border: none; cursor: pointer;
            font-size: 1.5rem; line-height: 1; padding: 2px;
            color: #d1d5db;
          }
          button[data-filled="true"] { color: #f59e0b; }
          button:focus-visible {
            outline: 2px solid #6366f1; outline-offset: 2px; border-radius: 2px;
          }
        </style>
        <div role="radiogroup" aria-label="Star rating">
          ${[1, 2, 3, 4, 5]
            .map(
              (n) =>
                `<button type="button" role="radio" aria-label="${n} star${n > 1 ? 's' : ''}"
                  aria-checked="${n === this._value}" data-filled="${n <= this._value}" data-value="${n}">★</button>`,
            )
            .join('')}
        </div>
      `;

      this.shadow.querySelectorAll('button').forEach((btn) => {
        btn.addEventListener('click', () => {
          const v = parseInt((btn as HTMLElement).dataset.value ?? '0', 10);
          this.value = v;
        });
      });
    }
  }

  customElements.define('rating-widget', RatingWidget);
}

// ---------------------------------------------------------------------------
// Custom element: labelled input
// Wraps a native <input> inside an open shadow root with a visible <label>.
// ---------------------------------------------------------------------------
function defineLabelledInput() {
  if (customElements.get('labelled-input')) return;

  class LabelledInput extends HTMLElement {
    private shadow: ShadowRoot;

    constructor() {
      super();
      this.shadow = this.attachShadow({ mode: 'open' });
    }

    connectedCallback() {
      const labelText = this.getAttribute('label') ?? 'Input';
      const placeholder = this.getAttribute('placeholder') ?? '';
      const inputId = 'inner-input';

      this.shadow.innerHTML = `
        <style>
          :host { display: flex; flex-direction: column; gap: 4px; }
          label { font-size: 0.875rem; font-weight: 500; color: #374151; }
          input {
            border: 1px solid #d1d5db; border-radius: 6px;
            padding: 6px 10px; font-size: 0.875rem; outline: none;
          }
          input:focus { border-color: #6366f1; box-shadow: 0 0 0 2px rgba(99,102,241,.2); }
        </style>
        <label for="${inputId}">${labelText}</label>
        <input id="${inputId}" type="text" placeholder="${placeholder}" aria-label="${labelText}" />
      `;
    }

    get inputValue() {
      return (this.shadow.querySelector('input') as HTMLInputElement | null)?.value ?? '';
    }
  }

  customElements.define('labelled-input', LabelledInput);
}

function formatReviewResult(rating: number, input: string): string {
  if (!rating || !input) {
    return 'Please choose a rating and enter a name.';
  }

  const starLabel = rating === 1 ? 'star' : 'stars';
  return `You rated "${input}" ${rating} ${starLabel}.`;
}

// ---------------------------------------------------------------------------
// Lab component
// ---------------------------------------------------------------------------
export function ShadowDom() {
  const ratingRef = useRef<HTMLElement>(null);
  const inputRef = useRef<HTMLElement>(null);
  const resultRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    defineRatingWidget();
    defineLabelledInput();
  }, []);

  function handleSubmit() {
    if (!resultRef.current) {
      return;
    }

    const rating = (ratingRef.current as RatingWidgetElement | null)?.value ?? 0;
    const input = (inputRef.current as LabelledInputElement | null)?.inputValue ?? '';
    resultRef.current.textContent = formatReviewResult(rating, input);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8 p-6">
      <LabHeader lab={lab} />

      {/* ── Star Rating Widget ─────────────────────────────────────────── */}
      <section
        aria-labelledby="rating-heading"
        className="rounded-lg border border-edge bg-surface p-6"
      >
        <h2 id="rating-heading" className="text-lg font-semibold text-content">
          Star Rating Widget
        </h2>
        <p className="mt-1 text-sm text-muted">
          A native custom element with an <strong>open</strong> shadow root. Playwright locators
          pierce it automatically — try{' '}
          <code className="rounded bg-surface-raised px-1 text-xs">getByRole("radio")</code>.
        </p>

        <div className="mt-4 space-y-4">
          <p className="text-sm text-content">Rate this lab:</p>
          {/* @ts-expect-error – custom element not in JSX types */}
          <rating-widget ref={ratingRef} value="0" aria-label="Lab rating" />
          <p className="text-xs text-muted">
            Click a star. The host element's{' '}
            <code className="rounded bg-surface-raised px-1">value</code> attribute reflects your
            selection.
          </p>
        </div>
      </section>

      {/* ── Labelled Input Widget ──────────────────────────────────────── */}
      <section
        aria-labelledby="input-heading"
        className="rounded-lg border border-edge bg-surface p-6"
      >
        <h2 id="input-heading" className="text-lg font-semibold text-content">
          Labelled Input Widget
        </h2>
        <p className="mt-1 text-sm text-muted">
          A custom element that wraps a native{' '}
          <code className="rounded bg-surface-raised px-1 text-xs">&lt;input&gt;</code> inside its
          shadow root. Use{' '}
          <code className="rounded bg-surface-raised px-1 text-xs">getByLabel</code> to reach it.
        </p>

        <div className="mt-4 space-y-4">
          {/* @ts-expect-error – custom element not in JSX types */}
          <labelled-input ref={inputRef} label="Your name" placeholder="e.g. Alice" />
        </div>
      </section>

      {/* ── Submit & Result ────────────────────────────────────────────── */}
      <section
        aria-labelledby="result-heading"
        className="rounded-lg border border-edge bg-surface p-6"
      >
        <h2 id="result-heading" className="text-lg font-semibold text-content">
          Submit Review
        </h2>
        <button
          type="button"
          onClick={handleSubmit}
          className="mt-3 rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          Submit
        </button>
        <p ref={resultRef} role="status" aria-live="polite" className="mt-3 text-sm text-content" />
      </section>
    </div>
  );
}
