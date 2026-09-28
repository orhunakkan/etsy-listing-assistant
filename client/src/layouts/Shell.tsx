import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Outlet, Link, useLocation, useSearchParams } from 'react-router';

function resolveInitialTheme(searchParams: URLSearchParams): boolean {
  const param = searchParams.get('theme');
  if (param === 'dark') return true;
  if (param === 'light') return false;

  const stored = localStorage.getItem('stagecraft:theme');
  if (stored === 'dark') return true;
  if (stored === 'light') return false;

  return window.matchMedia?.('(prefers-color-scheme: dark)')?.matches ?? false;
}

function SunIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="4" />
      <line x1="12" y1="2" x2="12" y2="6" />
      <line x1="12" y1="18" x2="12" y2="22" />
      <line x1="4.22" y1="4.22" x2="7.05" y2="7.05" />
      <line x1="16.95" y1="16.95" x2="19.78" y2="19.78" />
      <line x1="2" y1="12" x2="6" y2="12" />
      <line x1="18" y1="12" x2="22" y2="12" />
      <line x1="4.22" y1="19.78" x2="7.05" y2="16.95" />
      <line x1="16.95" y1="7.05" x2="19.78" y2="4.22" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4 flex-shrink-0"
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.1 3.29 9.42 7.86 10.96.57.1.79-.25.79-.55 0-.27-.01-1.16-.02-2.11-3.2.7-3.87-1.36-3.87-1.36-.53-1.33-1.29-1.69-1.29-1.69-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.71 1.26 3.37.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.68 0-1.25.45-2.28 1.19-3.08-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11.1 11.1 0 0 1 5.79 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.8 1.19 1.83 1.19 3.08 0 4.41-2.69 5.38-5.25 5.67.41.36.78 1.06.78 2.14 0 1.55-.01 2.79-.01 3.17 0 .3.21.66.79.55A10.52 10.52 0 0 0 23.5 12c0-6.35-5.15-11.5-11.5-11.5z" />
    </svg>
  );
}

function AboutAuthorButton() {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsOpen(false);
    }

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        className="rounded-full px-2.5 py-2 text-sm font-medium text-muted hover:text-content transition-colors sm:px-4"
      >
        About the Author
      </button>

      {isOpen && (
        <div
          role="dialog"
          aria-label="About the author"
          className="absolute right-0 top-full z-20 mt-3 w-[34rem] max-w-[calc(100vw-2rem)] rounded-md border border-edge bg-surface p-6 shadow-xl"
        >
          <div className="flex items-start gap-4">
            <img
              src="/profile-picture.jpg"
              alt="Orhun Akkan"
              className="h-14 w-14 rounded-full object-cover flex-shrink-0 ring-2 ring-edge"
            />
            <div>
              <p className="font-display text-2xl leading-tight text-content">Orhun Akkan</p>
              <p className="text-sm text-muted mb-2">
                Senior QA Engineer · 8+ years in test automation
              </p>
              <p className="text-sm text-muted">
                Built Stagecraft to provide realistic, hands-on Playwright challenges. Expert in
                Playwright, Cypress, and Selenium WebDriver — currently a Test Automation Engineer
                at Northern Trust.
              </p>
              <a
                href="https://www.linkedin.com/in/orhun-akkan"
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex items-center gap-1.5 text-sm text-accent hover:underline"
              >
                <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.447 20.452H17.02v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.607V9h3.274v1.561h.046c.455-.861 1.566-1.769 3.224-1.769 3.449 0 4.086 2.27 4.086 5.222v6.438zM5.337 7.433a1.9 1.9 0 1 1 0-3.8 1.9 1.9 0 0 1 0 3.8zm1.638 13.019H3.7V9h3.275v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                </svg>
                linkedin.com/in/orhun-akkan
              </a>
              <a
                href="https://github.com/orhunakkan/stagecraft"
                target="_blank"
                rel="noreferrer"
                className="mt-2 flex items-center gap-1.5 text-sm text-accent hover:underline"
              >
                <GitHubIcon />
                github.com/orhunakkan/stagecraft
              </a>
              <a
                href="https://github.com/orhunakkan/playwright-typescript"
                target="_blank"
                rel="noreferrer"
                className="mt-2 flex items-center gap-1.5 text-sm text-accent hover:underline"
              >
                <GitHubIcon />
                github.com/orhunakkan/playwright-typescript
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function Shell() {
  const { pathname } = useLocation();
  const [searchParams] = useSearchParams();
  const isHome = pathname === '/';

  const [isDark, setIsDark] = useState(() => resolveInitialTheme(searchParams));

  useLayoutEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
    localStorage.setItem('stagecraft:theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  return (
    <div className="min-h-screen bg-canvas text-content">
      <header className="sticky top-0 z-10 border-b border-edge bg-surface/90 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-screen-2xl items-center justify-between gap-2 px-4 sm:px-6 lg:px-10">
          <div className="flex min-w-0 items-center gap-3 sm:gap-5">
            <Link
              to="/"
              className="flex items-center gap-2.5 text-content hover:text-accent transition-colors"
            >
              <svg
                aria-hidden="true"
                className="h-6 w-6 shrink-0 text-accent sm:h-7 sm:w-7"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinejoin="round"
              >
                <polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5" />
                <line x1="12" y1="22" x2="12" y2="15.5" />
                <polyline points="22 8.5 12 15.5 2 8.5" />
              </svg>
              <span className="font-display text-2xl leading-none tracking-tight sm:text-[28px]">
                Stagecraft
              </span>
            </Link>

            {!isHome && (
              <>
                <span aria-hidden="true" className="hidden h-6 w-px bg-edge sm:block" />
                <Link
                  to="/"
                  className="rounded-full px-2 py-2 text-sm font-medium text-muted hover:text-content transition-colors sm:px-0"
                >
                  ←<span className="sr-only sm:not-sr-only"> All labs</span>
                </Link>
              </>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            <AboutAuthorButton />
            <button
              type="button"
              onClick={() => setIsDark((d) => !d)}
              aria-label="Toggle dark mode"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-edge text-content hover:border-accent hover:text-accent transition-colors"
            >
              {isDark ? <SunIcon /> : <MoonIcon />}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-screen-2xl px-4 py-10 sm:px-6 lg:px-10 lg:py-16">
        <Outlet />
      </main>
    </div>
  );
}
