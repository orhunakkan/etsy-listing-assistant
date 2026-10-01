import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { after, describe, it } from 'node:test';
import { migrate, MIGRATIONS, openDb } from './db.ts';

function tableNames(db: DatabaseSync): string[] {
  return db
    .prepare("SELECT name FROM sqlite_schema WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
    .all()
    .map((row) => String(row['name']));
}

function userVersion(db: DatabaseSync): unknown {
  return db.prepare('PRAGMA user_version').get()?.['user_version'];
}

const shopRow = [1, 2, 'Shop', 'access', 'refresh', 0, 0, 'listings_r', 0];
const insertShop =
  'INSERT INTO shop (id, etsy_shop_id, etsy_user_id, name, access_token, refresh_token, access_expires_at, refresh_expires_at, scopes, connected_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';

describe('openDb', () => {
  it('creates every spec table and sets user_version', () => {
    const db = openDb(':memory:');
    assert.deepEqual(tableNames(db), ['batches', 'etsy_calls', 'images', 'items', 'settings', 'shop']);
    assert.equal(userVersion(db), MIGRATIONS.length);
    db.close();
  });

  it('allows one shop row and rejects a second', () => {
    const db = openDb(':memory:');
    db.prepare(insertShop).run(1, ...shopRow);
    assert.throws(() => db.prepare(insertShop).run(2, ...shopRow), /CHECK constraint failed/);
    assert.throws(() => db.prepare(insertShop).run(1, ...shopRow), /UNIQUE constraint failed/);
    db.close();
  });

  it('allows one settings row and rejects a second', () => {
    const db = openDb(':memory:');
    const insert = db.prepare('INSERT INTO settings (id, settings_json, updated_at) VALUES (?, ?, ?)');
    insert.run(1, '{}', 0);
    assert.throws(() => insert.run(2, '{}', 0), /CHECK constraint failed/);
    db.close();
  });

  it('rejects a value of the wrong type (STRICT tables)', () => {
    const db = openDb(':memory:');
    assert.throws(
      () => db.prepare('INSERT INTO batches (name, created_at) VALUES (?, ?)').run('b', 'not a number'),
      /cannot store TEXT value in INTEGER column/,
    );
    db.close();
  });

  it('enforces foreign keys and cascades deletes from batches to images', () => {
    const db = openDb(':memory:');
    assert.throws(
      () => db.prepare("INSERT INTO items (batch_id, design_name, status, updated_at) VALUES (99, 'd', 'new', 0)").run(),
      /FOREIGN KEY constraint failed/,
    );
    const batchId = db.prepare("INSERT INTO batches (name, created_at) VALUES ('b', 0)").run().lastInsertRowid;
    const itemId = db
      .prepare("INSERT INTO items (batch_id, design_name, status, updated_at) VALUES (?, 'd', 'new', 0)")
      .run(batchId).lastInsertRowid;
    db.prepare("INSERT INTO images (item_id, file_path, rank) VALUES (?, 'f.png', 1)").run(itemId);
    db.prepare('DELETE FROM batches WHERE id = ?').run(batchId);
    assert.equal(db.prepare('SELECT count(*) AS n FROM images').get()?.['n'], 0);
    db.close();
  });
});

describe('migrate', () => {
  it('is a no-op when run a second time', () => {
    const db = openDb(':memory:');
    db.prepare("INSERT INTO batches (name, created_at) VALUES ('kept', 0)").run();
    migrate(db);
    assert.equal(userVersion(db), MIGRATIONS.length);
    assert.equal(db.prepare('SELECT name FROM batches').get()?.['name'], 'kept');
    db.close();
  });

  it('rolls back a failing migration and leaves user_version unchanged', () => {
    const db = openDb(':memory:');
    const broken = [...MIGRATIONS, "CREATE TABLE extra (id INTEGER) STRICT; INSERT INTO extra VALUES ('x');"];
    assert.throws(() => migrate(db, broken));
    assert.equal(userVersion(db), MIGRATIONS.length);
    assert.ok(!tableNames(db).includes('extra'));
    db.close();
  });

  it('refuses a database newer than this code', () => {
    const db = openDb(':memory:');
    db.exec(`PRAGMA user_version = ${MIGRATIONS.length + 1}`);
    assert.throws(() => migrate(db), /newer than this code/);
    db.close();
  });
});

describe('openDb on disk', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ela-db-'));
  after(() => rmSync(dir, { recursive: true, force: true }));

  it('creates the missing parent folder and the file', () => {
    const file = join(dir, 'nested', 'app.db');
    const db = openDb(file);
    db.close();
    assert.ok(existsSync(file));
    const reopened = openDb(file);
    assert.equal(userVersion(reopened), MIGRATIONS.length);
    reopened.close();
  });
});
