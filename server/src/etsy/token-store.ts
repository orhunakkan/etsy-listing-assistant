// Stores the connected shop and its OAuth tokens. The TokenStore interface keeps
// the rest of the code off the shop table, so hosted storage (encrypted, or a KMS)
// can replace it later (SPEC.md → Future expansion). Tokens are never logged.
import type { DatabaseSync } from 'node:sqlite';

export type ShopConnection = {
  etsyShopId: number;
  etsyUserId: number;
  name: string;
  accessToken: string;
  refreshToken: string;
  accessExpiresAt: number; // epoch ms
  refreshExpiresAt: number; // epoch ms
  scopes: string; // space-separated, as Etsy grants them
  connectedAt: number; // epoch ms
};

export interface TokenStore {
  get(): ShopConnection | undefined;
  // Inserts the one shop row, or replaces it. Callers check the shop id first (see oauth.ts).
  save(connection: ShopConnection): void;
}

export function createSqliteTokenStore(db: DatabaseSync): TokenStore {
  const select = db.prepare(
    `SELECT etsy_shop_id, etsy_user_id, name, access_token, refresh_token,
            access_expires_at, refresh_expires_at, scopes, connected_at
     FROM shop WHERE id = 1`,
  );
  const upsert = db.prepare(
    `INSERT INTO shop (id, etsy_shop_id, etsy_user_id, name, access_token, refresh_token,
                       access_expires_at, refresh_expires_at, scopes, connected_at)
     VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (id) DO UPDATE SET
       etsy_shop_id = excluded.etsy_shop_id, etsy_user_id = excluded.etsy_user_id, name = excluded.name,
       access_token = excluded.access_token, refresh_token = excluded.refresh_token,
       access_expires_at = excluded.access_expires_at, refresh_expires_at = excluded.refresh_expires_at,
       scopes = excluded.scopes, connected_at = excluded.connected_at`,
  );

  return {
    get() {
      const row = select.get();
      if (row === undefined) return undefined;
      return {
        etsyShopId: Number(row['etsy_shop_id']),
        etsyUserId: Number(row['etsy_user_id']),
        name: String(row['name']),
        accessToken: String(row['access_token']),
        refreshToken: String(row['refresh_token']),
        accessExpiresAt: Number(row['access_expires_at']),
        refreshExpiresAt: Number(row['refresh_expires_at']),
        scopes: String(row['scopes']),
        connectedAt: Number(row['connected_at']),
      };
    },
    save(c) {
      upsert.run(
        c.etsyShopId,
        c.etsyUserId,
        c.name,
        c.accessToken,
        c.refreshToken,
        c.accessExpiresAt,
        c.refreshExpiresAt,
        c.scopes,
        c.connectedAt,
      );
    },
  };
}
