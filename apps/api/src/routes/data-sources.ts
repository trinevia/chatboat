import { zValidator } from '@hono/zod-validator';
import { generateText } from 'ai';
import { and, eq, ne } from 'drizzle-orm';
import { Hono } from 'hono';
import { db, schema } from '@chatboat/db';
import {
  createDataSourceInput,
  glossaryInput,
  pgConnectionInput,
  updateDataSourceInput,
  type DataSourceInfo,
} from '@chatboat/shared';
import { getModel } from '../ai/model';
import { requireAdmin, requireUser, type AppEnv } from '../context';
import { encrypt } from '../data/crypto';
import { checkConnection, forgetSchema, schemaDocFor, tablesFor } from '../data/introspect';
import { forgetPool, poolFor, type DataSource, type PgConfig } from '../data/sources';
import { dropUploadedTable, MAX_UPLOAD_BYTES, parseSpreadsheet, storeTable } from '../data/uploads';
import { getSetting, setSetting } from '../settings';
import type { GlossaryTerm } from '../ai/prompt';

const { dataSource } = schema;

const info = (s: DataSource): DataSourceInfo => {
  const cfg = s.config as Partial<PgConfig>;
  return {
    id: s.id,
    name: s.name,
    kind: s.kind,
    isActive: s.isActive,
    config: { host: cfg.host, port: cfg.port, database: cfg.database, user: cfg.user, ssl: cfg.ssl },
    allowedTables: s.allowedTables,
    notes: s.notes,
    updatedAt: s.updatedAt.toISOString(),
  };
};

async function getSource(id: number) {
  const [row] = await db.select().from(dataSource).where(eq(dataSource.id, id));
  return row;
}

/** Bump updatedAt so cached pools and schema text are rebuilt. */
async function touch(id: number, patch: Partial<typeof dataSource.$inferInsert> = {}) {
  forgetPool(id);
  forgetSchema(id);
  const [row] = await db.update(dataSource).set({ ...patch, updatedAt: new Date() }).where(eq(dataSource.id, id)).returning();
  return row;
}

/** Ask the model for example questions that fit these tables (shown on the home page). */
async function generateSuggestions(source: DataSource) {
  try {
    const doc = await schemaDocFor(source, () => poolFor(source));
    if (!doc.trim()) return;
    const { text } = await generateText({
      model: getModel().model,
      prompt: `Here are the tables of a company's database:\n\n${doc}\n\nWrite 4 short, specific business questions a manager could ask about this data (each answerable with one SQL query). One question per line, no numbering, no extra text.`,
      maxRetries: 2,
    });
    const questions = text
      .split('\n')
      .map(l => l.replace(/^[-*\d.)\s]+/, '').trim())
      .filter(l => l.length > 8 && l.length < 160)
      .slice(0, 4);
    if (questions.length) await db.update(dataSource).set({ suggestions: questions }).where(eq(dataSource.id, source.id));
  } catch (e) {
    console.error('[data-sources] could not generate suggestions:', (e as Error).message);
  }
}

async function activate(id: number) {
  await db.transaction(async tx => {
    await tx.update(dataSource).set({ isActive: false }).where(and(eq(dataSource.isActive, true), ne(dataSource.id, id)));
    await tx.update(dataSource).set({ isActive: true }).where(eq(dataSource.id, id));
  });
  const source = await getSource(id);
  if (source && source.kind !== 'sample') void generateSuggestions(source);
}

/** The single "Uploaded files" source, created on first upload. */
async function uploadSource() {
  const [existing] = await db.select().from(dataSource).where(eq(dataSource.kind, 'upload'));
  if (existing) return existing;
  const [created] = await db.insert(dataSource).values({ name: 'Uploaded files', kind: 'upload' }).returning();
  return created;
}

export const dataSourceRoutes = new Hono<AppEnv>()
  .use('/admin/data-sources/*', requireUser, requireAdmin)
  .use('/admin/data-sources', requireUser, requireAdmin)
  .use('/admin/uploads/*', requireUser, requireAdmin)
  .use('/admin/uploads', requireUser, requireAdmin)
  .use('/admin/glossary', requireUser, requireAdmin)

  .get('/admin/data-sources', async c => {
    const rows = await db.select().from(dataSource).orderBy(dataSource.id);
    return c.json(rows.map(info));
  })

  /** Try a connection without saving it; lists the tables the login can read. */
  .post('/admin/data-sources/check', zValidator('json', pgConnectionInput), async c => {
    const { password, ...cfg } = c.req.valid('json');
    return c.json(await checkConnection(cfg, password));
  })

  .post('/admin/data-sources', zValidator('json', createDataSourceInput), async c => {
    const { name, connection, allowedTables } = c.req.valid('json');
    const { password, ...cfg } = connection;
    const check = await checkConnection(cfg, password);
    if (!check.ok) return c.json({ error: check.error }, 400);
    const [row] = await db
      .insert(dataSource)
      .values({ name, kind: 'postgres', config: cfg, secret: encrypt(password), allowedTables, lastCheckedAt: new Date() })
      .returning();
    return c.json(info(row), 201);
  })

  .patch('/admin/data-sources/:id', zValidator('json', updateDataSourceInput), async c => {
    const source = await getSource(Number(c.req.param('id')));
    if (!source) return c.json({ error: 'Not found' }, 404);
    const { connection, ...rest } = c.req.valid('json');
    const patch: Partial<typeof dataSource.$inferInsert> = { ...rest };
    if (connection && source.kind === 'postgres') {
      const { password, ...cfg } = connection;
      patch.config = { ...(source.config as PgConfig), ...cfg };
      if (password) patch.secret = encrypt(password);
    }
    const row = await touch(source.id, patch);
    return c.json(info(row));
  })

  .post('/admin/data-sources/:id/activate', async c => {
    const source = await getSource(Number(c.req.param('id')));
    if (!source) return c.json({ error: 'Not found' }, 404);
    await activate(source.id);
    return c.json(info((await getSource(source.id))!));
  })

  .delete('/admin/data-sources/:id', async c => {
    const source = await getSource(Number(c.req.param('id')));
    if (!source) return c.json({ error: 'Not found' }, 404);
    if (source.kind === 'sample') return c.json({ error: 'The sample data cannot be removed.' }, 400);
    if (source.isActive) {
      const [sample] = await db.select().from(dataSource).where(eq(dataSource.kind, 'sample'));
      await activate(sample.id);
    }
    forgetPool(source.id);
    forgetSchema(source.id);
    await db.delete(dataSource).where(eq(dataSource.id, source.id));
    return c.body(null, 204);
  })

  /** Exactly what the AI is told about this source's tables. */
  .get('/admin/data-sources/:id/schema', async c => {
    const source = await getSource(Number(c.req.param('id')));
    if (!source) return c.json({ error: 'Not found' }, 404);
    try {
      const [doc, tables] = await Promise.all([
        schemaDocFor(source, () => poolFor(source)),
        tablesFor(source, () => poolFor(source)),
      ]);
      return c.json({ doc, tables });
    } catch (e) {
      return c.json({ error: (e as Error).message }, 502);
    }
  })

  // ---- Spreadsheet uploads ----
  .post('/admin/uploads', async c => {
    const body = await c.req.parseBody();
    const file = body.file;
    if (!(file instanceof File)) return c.json({ error: 'Attach a file in the "file" field.' }, 400);
    if (file.size > MAX_UPLOAD_BYTES) return c.json({ error: 'Files must be under 20 MB.' }, 413);
    try {
      const parsed = parseSpreadsheet(Buffer.from(await file.arrayBuffer()), file.name);
      const tables = [];
      for (const t of parsed) tables.push(await storeTable(t));
      const source = await uploadSource();
      await touch(source.id);
      return c.json({ sourceId: source.id, tables }, 201);
    } catch (e) {
      return c.json({ error: (e as Error).message }, 400);
    }
  })

  .delete('/admin/uploads/:table', async c => {
    await dropUploadedTable(c.req.param('table'));
    const source = await uploadSource();
    await touch(source.id);
    return c.body(null, 204);
  })

  // ---- Glossary (install-wide) ----
  .get('/admin/glossary', async c => c.json({ terms: (await getSetting<GlossaryTerm[]>('glossary')) ?? [] }))
  .put('/admin/glossary', zValidator('json', glossaryInput), async c => {
    await setSetting('glossary', c.req.valid('json').terms);
    return c.json({ terms: c.req.valid('json').terms });
  });
