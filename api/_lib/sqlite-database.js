import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const IDEMPOTENCY_CONSTRAINT = 'uq_control_actions_actor_idempotency';
const JSON_COLUMN = /_json$/;

function translateIntervals(sql) {
  return sql
    .replace(
      /CURRENT_TIMESTAMP\s*-\s*INTERVAL\s*'(\d+)\s+minutes?'/gi,
      (_, amount) => `datetime(CURRENT_TIMESTAMP, '-${amount} minutes')`,
    )
    .replace(
      /CURRENT_TIMESTAMP\s*-\s*INTERVAL\s*'(\d+)\s+seconds?'/gi,
      (_, amount) => `datetime(CURRENT_TIMESTAMP, '-${amount} seconds')`,
    );
}

export function translateSqliteQuery(sql) {
  return translateIntervals(sql)
    .replace(/::jsonb?\b/gi, '')
    .replace(/::timestamptz\b/gi, '')
    .replace(
      new RegExp(`ON\\s+CONFLICT\\s+ON\\s+CONSTRAINT\\s+${IDEMPOTENCY_CONSTRAINT}`, 'gi'),
      'ON CONFLICT(guild_id, actor_id, idempotency_key)',
    );
}

function sqliteValue(value) {
  if (value === undefined || value === null) return null;
  if (value instanceof Date) return value.toISOString().replace('T', ' ').replace('Z', '');
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (['string', 'number', 'bigint'].includes(typeof value)) return value;
  if (ArrayBuffer.isView(value)) return value;
  throw new TypeError(`Unsupported SQLite bind value: ${Object.prototype.toString.call(value)}`);
}

function decodedValue(key, value) {
  if (typeof value === 'bigint') return value.toString();
  if (!JSON_COLUMN.test(key) || typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function decodedRow(row) {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [key, decodedValue(key, value)]),
  );
}

function taggedQuery(strings, values) {
  let query = strings[0];
  for (let index = 0; index < values.length; index += 1) {
    query += `?${strings[index + 1]}`;
  }
  return translateSqliteQuery(query);
}

export function createSqliteTaggedClient(databasePath) {
  const path = resolve(String(databasePath || '').trim());
  if (!databasePath || !String(databasePath).trim()) {
    throw new TypeError('CONTROL_SQLITE_PATH must not be empty.');
  }

  const database = new DatabaseSync(path);
  database.exec('PRAGMA foreign_keys = ON');
  database.exec('PRAGMA busy_timeout = 5000');

  return async function sql(strings, ...values) {
    if (!Array.isArray(strings) || !Object.hasOwn(strings, 'raw')) {
      throw new TypeError('SQLite control queries must use the tagged-template interface.');
    }

    const query = taggedQuery(strings, values);
    const statement = database.prepare(query);
    statement.setReadBigInts(true);
    const bindings = values.map(sqliteValue);
    const returnsRows = /^\s*(?:SELECT|PRAGMA|WITH)\b/i.test(query) || /\bRETURNING\b/i.test(query);

    if (!returnsRows) {
      statement.run(...bindings);
      return [];
    }
    return statement.all(...bindings).map(decodedRow);
  };
}
