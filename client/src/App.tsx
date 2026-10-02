// The app shell: header, the current page, and the footer notice Etsy's API Terms require.
import { Connect } from './pages/Connect.tsx';

export function App() {
  return (
    <div className="shell">
      <header className="header">
        <h1>Etsy Listing Assistant</h1>
      </header>
      <main className="main">
        <Connect />
      </main>
      <footer className="footer">
        The term 'Etsy' is a trademark of Etsy, Inc. This application uses the Etsy API but is not endorsed or certified by
        Etsy, Inc.
      </footer>
    </div>
  );
}
