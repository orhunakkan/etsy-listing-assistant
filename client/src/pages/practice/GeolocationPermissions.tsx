import { useState, useCallback } from 'react';
import { LabHeader } from '../../components/LabHeader';
import { labs } from '../../labs';

const lab = labs.find((l) => l.slug === 'geolocation-permissions')!;

interface Cafe {
  id: number;
  name: string;
  distance: string;
}

const MOCK_CAFES: Cafe[] = [
  { id: 1, name: 'Beanstalk Coffee', distance: '0.2 km' },
  { id: 2, name: 'The Roasted Owl', distance: '0.5 km' },
  { id: 3, name: 'Third Wave House', distance: '0.8 km' },
  { id: 4, name: 'Crema & Co.', distance: '1.1 km' },
];

type GeoState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'resolved'; lat: number; lng: number }
  | { status: 'denied'; message: string };

type ClipboardState =
  | { status: 'idle' }
  | { status: 'copied' }
  | { status: 'pasted'; text: string }
  | { status: 'error'; message: string };

export function GeolocationPermissions() {
  const [geo, setGeo] = useState<GeoState>({ status: 'idle' });
  const [clipboard, setClipboard] = useState<ClipboardState>({ status: 'idle' });
  const [pasteBox, setPasteBox] = useState('');

  const findCafes = useCallback(() => {
    setGeo({ status: 'loading' });
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeo({
          status: 'resolved',
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
      },
      (err) => {
        setGeo({ status: 'denied', message: err.message || 'Location access denied.' });
      },
    );
  }, []);

  const copyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setClipboard({ status: 'copied' });
    } catch {
      setClipboard({ status: 'error', message: 'Clipboard write blocked.' });
    }
  }, []);

  const pasteLink = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      setPasteBox(text);
      setClipboard({ status: 'pasted', text });
    } catch {
      setClipboard({ status: 'error', message: 'Clipboard read blocked.' });
    }
  }, []);

  return (
    <div className="mx-auto max-w-2xl space-y-8 p-6">
      <LabHeader lab={lab} />

      {/* Geolocation panel */}
      <section
        aria-labelledby="geo-heading"
        className="rounded-lg border border-edge bg-surface p-6"
      >
        <h2 id="geo-heading" className="text-lg font-semibold text-content">
          Find Nearby Cafés
        </h2>
        <p className="mt-1 text-sm text-muted">
          Grants the geolocation permission, resolves your coordinates, and lists nearby cafés.
        </p>

        <button
          type="button"
          onClick={findCafes}
          className="mt-4 rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          Find Cafés Near Me
        </button>

        {geo.status === 'loading' && (
          <p className="mt-3 text-sm text-muted">Requesting location…</p>
        )}

        {geo.status === 'resolved' && (
          <div className="mt-4 space-y-3">
            <p className="text-sm text-content" data-testid="coords">
              Latitude: <strong>{geo.lat.toFixed(4)}</strong> · Longitude:{' '}
              <strong>{geo.lng.toFixed(4)}</strong>
            </p>
            <ul
              aria-label="Nearby cafés"
              className="divide-y divide-edge rounded-md border border-edge"
            >
              {MOCK_CAFES.map((cafe) => (
                <li key={cafe.id} className="flex justify-between px-4 py-2 text-sm">
                  <span>{cafe.name}</span>
                  <span className="text-muted">{cafe.distance}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {geo.status === 'denied' && (
          <p role="alert" className="mt-3 text-sm text-red-700 dark:text-red-400">
            {geo.message}
          </p>
        )}
      </section>

      {/* Clipboard panel */}
      <section
        aria-labelledby="clipboard-heading"
        className="rounded-lg border border-edge bg-surface p-6"
      >
        <h2 id="clipboard-heading" className="text-lg font-semibold text-content">
          Share Link via Clipboard
        </h2>
        <p className="mt-1 text-sm text-muted">
          Tests the clipboard-write and clipboard-read permissions.
        </p>

        <div className="mt-4 flex gap-3">
          <button
            type="button"
            onClick={copyLink}
            className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            Copy Share Link
          </button>
          <button
            type="button"
            onClick={pasteLink}
            className="rounded-md border border-edge bg-surface px-4 py-2 text-sm font-medium text-content hover:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            Paste
          </button>
        </div>

        {clipboard.status === 'copied' && (
          <p role="status" className="mt-3 text-sm text-emerald-700 dark:text-emerald-300">
            Link copied to clipboard!
          </p>
        )}

        {clipboard.status === 'pasted' && (
          <div className="mt-3 space-y-1">
            <p role="status" className="text-sm text-emerald-700 dark:text-emerald-300">
              Pasted successfully.
            </p>
            <input
              readOnly
              aria-label="Pasted URL"
              value={pasteBox}
              className="w-full rounded border border-edge bg-canvas px-3 py-1.5 text-sm text-content font-mono"
            />
          </div>
        )}

        {clipboard.status === 'error' && (
          <p role="alert" className="mt-3 text-sm text-red-700 dark:text-red-400">
            {clipboard.message}
          </p>
        )}
      </section>
    </div>
  );
}
