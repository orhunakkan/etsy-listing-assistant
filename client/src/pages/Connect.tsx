// Shows whether the Etsy shop is connected, when it must be reconnected, and today's
// Etsy call count. Connecting is a full-page visit to /oauth/start (Etsy's consent page).
import { useEffect, useState } from 'react';
import { ApiError, ETSY_DAILY_LIMIT, getShop, type ShopStatus } from '../api.ts';

type State = { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'ready'; shop: ShopStatus };

const dateTime = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });
const date = new Intl.DateTimeFormat(undefined, { dateStyle: 'long' });

function errorMessage(error: unknown): string {
  if (error instanceof ApiError && error.status === 503) {
    return 'Etsy is not configured. Set ETSY_KEYSTRING and ETSY_SHARED_SECRET in .env, then restart the server.';
  }
  return 'Could not reach the server. Is it running?';
}

export function Connect() {
  const [state, setState] = useState<State>({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;
    getShop().then(
      (shop) => !cancelled && setState({ kind: 'ready', shop }),
      (error: unknown) => !cancelled && setState({ kind: 'error', message: errorMessage(error) }),
    );
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section aria-labelledby="connect-title">
      <h2 id="connect-title">Etsy shop</h2>
      {state.kind === 'loading' && <p className="muted">Checking the connection…</p>}
      {state.kind === 'error' && <p className="notice notice-error" role="alert">{state.message}</p>}
      {state.kind === 'ready' && <ShopDetails shop={state.shop} />}
    </section>
  );
}

function ShopDetails({ shop }: { shop: ShopStatus }) {
  const calls = (
    <div>
      <dt>Etsy calls, last 24 hours</dt>
      <dd>
        {shop.callsLast24h.toLocaleString()} of {ETSY_DAILY_LIMIT.toLocaleString()}
      </dd>
    </div>
  );

  if (!shop.connected) {
    return (
      <>
        <p>No Etsy shop is connected yet. Connecting opens Etsy, where you approve access to your listings.</p>
        <a className="button" href="/oauth/start">Connect Etsy shop</a>
        <dl className="facts">{calls}</dl>
      </>
    );
  }

  return (
    <>
      <p>
        Connected to <strong>{shop.name}</strong>.
      </p>
      {shop.reconnectSoon && (
        <div className="notice notice-warning" role="status">
          <p>
            The connection expires on {date.format(shop.refreshExpiresAt)}. Reconnect before then to keep pushing drafts.
          </p>
          <a className="button" href="/oauth/start">Reconnect</a>
        </div>
      )}
      <dl className="facts">
        <div>
          <dt>Reconnect needed by</dt>
          <dd>{date.format(shop.refreshExpiresAt)}</dd>
        </div>
        <div>
          <dt>Access token</dt>
          <dd>
            {shop.accessExpiresAt > Date.now()
              ? `Renews automatically (current one valid until ${dateTime.format(shop.accessExpiresAt)})`
              : 'Renews automatically on the next Etsy call'}
          </dd>
        </div>
        {calls}
      </dl>
    </>
  );
}
