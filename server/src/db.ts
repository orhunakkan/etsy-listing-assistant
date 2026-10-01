// Opens the SQLite database and brings its schema up to date. Migrations are
// numbered by their position in MIGRATIONS and tracked with PRAGMA user_version,
// so later changes are new entries appended to the list, never edits to old ones.
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

export const DB_PATH = fileURLToPath(new URL('../../data/app.db', import.meta.url)); // git-ignored

// Timestamps are Unix epoch milliseconds. Every table is STRICT, so a value of the
// wrong type is an error instead of being stored as-is.
export const MIGRATIONS: readonly string[] = [
  `
  CREATE TABLE shop (
    id                 INTEGER PRIMARY KEY CHECK (id = 1), -- one shop only (SPEC D1)
    etsy_shop_id       INTEGER NOT NULL,
    etsy_user_id       INTEGER NOT NULL,
    name               TEXT    NOT NULL,
    access_token       TEXT    NOT NULL,
    refresh_token      TEXT    NOT NULL,
    access_expires_at  INTEGER NOT NULL,
    refresh_expires_at INTEGER NOT NULL,
    scopes             TEXT    NOT NULL,
    connected_at       INTEGER NOT NULL
  ) STRICT;

  CREATE TABLE settings (
    id            INTEGER PRIMARY KEY CHECK (id = 1),
    settings_json TEXT    NOT NULL, -- zod-validated before it is written
    updated_at    INTEGER NOT NULL
  ) STRICT;

  CREATE TABLE batches (
    id         INTEGER PRIMARY KEY,
    name       TEXT    NOT NULL,
    created_at INTEGER NOT NULL
  ) STRICT;

  CREATE TABLE items (
    id              INTEGER PRIMARY KEY,
    batch_id        INTEGER NOT NULL REFERENCES batches (id) ON DELETE CASCADE,
    design_name     TEXT    NOT NULL,
    status          TEXT    NOT NULL, -- legal values and moves live in the item state machine
    content_json    TEXT,
    guard_json      TEXT,
    overrides_json  TEXT,
    etsy_listing_id INTEGER,
    push_started_at INTEGER,
    push_step       TEXT,             -- last finished step: created, image:<rank> or inventory
    last_error      TEXT,
    updated_at      INTEGER NOT NULL
  ) STRICT;
  CREATE INDEX items_batch_id ON items (batch_id);

  CREATE TABLE images (
    id            INTEGER PRIMARY KEY,
    item_id       INTEGER NOT NULL REFERENCES items (id) ON DELETE CASCADE,
    file_path     TEXT    NOT NULL,   -- server-generated, relative to data/uploads
    preview_path  TEXT,
    rank          INTEGER NOT NULL,   -- 1 is the primary photo
    alt_text      TEXT,
    etsy_image_id INTEGER
  ) STRICT;
  CREATE INDEX images_item_id ON images (item_id);

  CREATE TABLE etsy_calls (
    ts              INTEGER NOT NULL,
    method          TEXT    NOT NULL,
    path            TEXT    NOT NULL, -- never includes tokens
    status          INTEGER,          -- null when the request never got a response
    ms              INTEGER NOT NULL,
    remaining_today INTEGER
  ) STRICT;
  CREATE INDEX etsy_calls_ts ON etsy_calls (ts);
  `,
];

// Opens (creating if needed) the database at `path` and migrates it.
// Pass ':memory:' for a throwaway database in tests.
export function openDb(path: string = DB_PATH): DatabaseSync {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path, { enableForeignKeyConstraints: true });
  if (path !== ':memory:') db.exec('PRAGMA journal_mode = WAL');
  migrate(db);
  return db;
}

// Applies every migration past the stored user_version, each in its own transaction.
export function migrate(db: DatabaseSync, migrations: readonly string[] = MIGRATIONS): void {
  const current = Number(db.prepare('PRAGMA user_version').get()?.['user_version'] ?? 0);
  if (current > migrations.length) {
    throw new Error(`Database schema version ${current} is newer than this code (${migrations.length})`);
  }
  for (const [index, sql] of migrations.entries()) {
    const version = index + 1;
    if (version <= current) continue;
    db.exec('BEGIN');
    try {
      db.exec(sql);
      db.exec(`PRAGMA user_version = ${version}`);
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }
}
