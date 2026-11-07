import { BSON, MongoClient, type Document } from 'mongodb';
import type { Row } from '@chatboat/shared';
import { decrypt } from './crypto';
import { guardMongoQuery } from './mongo-guard';
import type { DataSource } from './sources';

const QUERY_TIMEOUT_MS = 5000;
const MAX_ROWS = 1000;

export interface MongoConfig {
  /** Host part only (no credentials), for display. */
  host: string;
  database: string;
}

export interface CollectionInfo {
  name: string;
  documents: number;
  /** "field.path" -> types seen in sampled documents */
  fields: Record<string, string[]>;
}

/** "mongodb+srv://user:pass@cluster0.x.net/?retryWrites=true" -> "cluster0.x.net" */
export function hostOf(uri: string) {
  const afterScheme = uri.replace(/^mongodb(\+srv)?:\/\//, '');
  return afterScheme.replace(/^[^@]*@/, '').split(/[/?]/)[0];
}

function client(uri: string) {
  return new MongoClient(uri, {
    serverSelectionTimeoutMS: 8000,
    connectTimeoutMS: 8000,
    maxPoolSize: 3,
    appName: 'chatboat',
  });
}

/** One client per source, rebuilt when the source is edited. */
const clients = new Map<number, { stamp: number; client: MongoClient }>();
function clientFor(source: DataSource) {
  const stamp = source.updatedAt.getTime();
  const hit = clients.get(source.id);
  if (hit?.stamp === stamp) return hit.client;
  void hit?.client.close();
  if (!source.secret) throw new Error(`Data source "${source.name}" has no connection string saved.`);
  const c = client(decrypt(source.secret));
  clients.set(source.id, { stamp, client: c });
  return c;
}

export function forgetMongoClient(sourceId: number) {
  void clients.get(sourceId)?.client.close();
  clients.delete(sourceId);
}

// ---- Turning documents into chart rows ----------------------------------------------------

function typeName(v: unknown): string {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  if (v instanceof Date) return 'date';
  const bson = (v as { _bsontype?: string })?._bsontype;
  if (bson) return bson === 'ObjectId' ? 'objectId' : bson.toLowerCase();
  return typeof v;
}

function scalar(v: unknown): string | number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number' || typeof v === 'string') return v;
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'bigint') return Number(v);
  if (v instanceof Date) {
    const iso = v.toISOString();
    return iso.endsWith('T00:00:00.000Z') ? iso.slice(0, 10) : iso.slice(0, 19).replace('T', ' ');
  }
  const bson = (v as { _bsontype?: string })._bsontype;
  if (bson === 'Decimal128' || bson === 'Long' || bson === 'Double' || bson === 'Int32') return Number(String(v));
  if (bson === 'ObjectId') return String(v);
  return JSON.stringify(v);
}

/** Nested objects become dotted columns (customer.city); arrays become JSON text. */
export function flattenDoc(doc: Document, prefix = '', out: Row = {}): Row {
  for (const [k, v] of Object.entries(doc)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date) && !(v as { _bsontype?: string })._bsontype) {
      flattenDoc(v as Document, key, out);
    } else {
      out[key] = scalar(v);
    }
  }
  return out;
}

function collectFields(doc: unknown, prefix: string, fields: Record<string, Set<string>>, depth = 0) {
  if (depth > 4 || !doc || typeof doc !== 'object') return;
  for (const [k, v] of Object.entries(doc as Document)) {
    const key = prefix ? `${prefix}.${k}` : k;
    const t = typeName(v);
    (fields[key] ??= new Set()).add(t);
    if (t === 'object') collectFields(v, key, fields, depth + 1);
    if (t === 'array') for (const item of (v as unknown[]).slice(0, 5)) {
      if (item && typeof item === 'object' && !Array.isArray(item)) collectFields(item, `${key}[]`, fields, depth + 1);
    }
  }
}

async function describeDb(c: MongoClient, database: string, only?: Set<string>): Promise<CollectionInfo[]> {
  const db = c.db(database);
  const names = (await db.listCollections({}, { nameOnly: true }).toArray())
    .map(x => x.name)
    .filter(n => !n.startsWith('system.') && (!only || only.has(n)))
    .sort();
  return Promise.all(
    names.map(async name => {
      const coll = db.collection(name);
      const [documents, sample] = await Promise.all([
        coll.estimatedDocumentCount(),
        coll.aggregate([{ $sample: { size: 50 } }], { maxTimeMS: QUERY_TIMEOUT_MS }).toArray(),
      ]);
      const fields: Record<string, Set<string>> = {};
      sample.forEach(d => collectFields(d, '', fields));
      return { name, documents, fields: Object.fromEntries(Object.entries(fields).map(([k, s]) => [k, [...s]])) };
    })
  );
}

/** Prompt-friendly text: one line per collection with its fields and types. */
export function describeCollections(infos: CollectionInfo[]) {
  return infos
    .map(c => {
      const fields = Object.entries(c.fields)
        .filter(([, t]) => !(t.length === 1 && t[0] === 'object'))
        .map(([k, t]) => `${k} ${t.filter(x => x !== 'null').join('|') || 'null'}`);
      return `${c.name} (~${c.documents.toLocaleString('en-US')} docs): ${fields.join(', ')}`;
    })
    .join('\n');
}

export interface MongoCheck {
  ok: boolean;
  error?: string;
  canWrite?: boolean;
  collections?: CollectionInfo[];
}

/** Try a connection string without saving it. */
export async function checkMongo(uri: string, database: string): Promise<MongoCheck> {
  if (!/^mongodb(\+srv)?:\/\//.test(uri)) return { ok: false, error: 'The connection string must start with mongodb:// or mongodb+srv://' };
  const c = client(uri);
  try {
    await c.connect();
    const status = await c.db('admin').command({ connectionStatus: 1, showPrivileges: true });
    const privileges = (status.authInfo?.authenticatedUserPrivileges ?? []) as { actions?: string[] }[];
    const writeActions = ['insert', 'update', 'remove', 'dropCollection', 'dropDatabase', 'createCollection', 'createIndex'];
    const users = status.authInfo?.authenticatedUsers ?? [];
    // No authentication at all means anyone on the network can write.
    const canWrite = users.length === 0 || privileges.some(p => p.actions?.some(a => writeActions.includes(a)));
    const collections = await describeDb(c, database);
    return { ok: true, canWrite, collections };
  } catch (e) {
    const m = (e as Error).message;
    if (/Authentication failed|auth/i.test(m)) return { ok: false, error: 'Wrong username or password in the connection string.' };
    if (/ENOTFOUND|querySrv/i.test(m)) return { ok: false, error: 'Host not found. Check the connection string.' };
    if (/timed out|Server selection/i.test(m)) return { ok: false, error: 'Could not reach the server. Check the host, port, firewall or IP allow-list.' };
    if (/not authorized/i.test(m)) return { ok: false, error: `This user can't read that database: ${m}` };
    return { ok: false, error: m };
  } finally {
    await c.close();
  }
}

/** Collections (with fields) the AI may use for this source. */
export async function mongoCollectionsFor(source: DataSource) {
  const cfg = source.config as MongoConfig;
  return describeDb(clientFor(source), cfg.database, new Set(source.allowedTables));
}

/** Validate and run one AI-written aggregation. Returns flat rows for charts. */
export async function runMongo(source: DataSource, rawQuery: string) {
  const cfg = source.config as MongoConfig;
  const query = guardMongoQuery(rawQuery, new Set(source.allowedTables));
  const docs = await clientFor(source)
    .db(cfg.database)
    .collection(query.collection)
    // Extended JSON turns {"$date": "..."} into real dates (and $oid, $numberDecimal, …).
    .aggregate([...(BSON.EJSON.deserialize(query.pipeline, { relaxed: true }) as Document[]), { $limit: MAX_ROWS }], {
      maxTimeMS: QUERY_TIMEOUT_MS,
      allowDiskUse: false,
    })
    .toArray();
  const rows = docs.map(d => flattenDoc(d));
  const columns = [...new Set(rows.flatMap(r => Object.keys(r)))];
  // Every row gets every column, so tables and charts line up.
  const filled = rows.map(r => Object.fromEntries(columns.map(c => [c, r[c] ?? null])) as Row);
  return { sql: JSON.stringify(query), columns, rows: filled };
}
