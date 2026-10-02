// The app shell: header with navigation, the current page, and the footer notice Etsy's
// API Terms require. Pages are chosen by URL path; the server answers every non-API path
// with the app, so reloading any page works.
import { type MouseEvent, type ReactNode, useEffect, useState } from 'react';
import { Connect } from './pages/Connect.tsx';
import { Settings } from './pages/Settings.tsx';

const PAGES: ReadonlyArray<{ path: string; title: string; render: () => ReactNode }> = [
  { path: '/', title: 'Shop', render: () => <Connect /> },
  { path: '/settings', title: 'Settings', render: () => <Settings /> },
];

function usePath(): [string, (path: string) => void] {
  const [path, setPath] = useState(window.location.pathname);
  useEffect(() => {
    const onPop = (): void => setPath(window.location.pathname);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  const navigate = (to: string): void => {
    window.history.pushState(null, '', to);
    setPath(to);
  };
  return [path, navigate];
}

export function App() {
  const [path, navigate] = usePath();
  const page = PAGES.find((p) => p.path === path);

  const follow = (event: MouseEvent<HTMLAnchorElement>, to: string): void => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return; // let the browser open a new tab
    event.preventDefault();
    navigate(to);
  };

  return (
    <div className="shell">
      <header className="header">
        <h1>Etsy Listing Assistant</h1>
        <nav aria-label="Main">
          {PAGES.map((p) => (
            <a key={p.path} href={p.path} aria-current={p === page ? 'page' : undefined} onClick={(e) => follow(e, p.path)}>
              {p.title}
            </a>
          ))}
        </nav>
      </header>
      <main className="main">{page ? page.render() : <p>Page not found.</p>}</main>
      <footer className="footer">
        The term 'Etsy' is a trademark of Etsy, Inc. This application uses the Etsy API but is not endorsed or certified by
        Etsy, Inc.
      </footer>
    </div>
  );
}
