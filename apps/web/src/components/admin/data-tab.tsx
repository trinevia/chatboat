'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Database,
  FileSpreadsheet,
  Leaf,
  Plus,
  Sparkles,
  Table2,
  Trash2,
  Upload,
} from 'lucide-react';
import type { ConnectionCheckResult, DataSourceInfo, PgConnectionInput, TableSummary } from '@chatboat/shared';
import { api, ApiError } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Dialog, useDialogs } from '@/components/ui/dialog';
import { Input, Label } from '@/components/ui/input';

const errMsg = (e: unknown, fallback: string) => (e instanceof ApiError ? e.message : fallback);
const KIND_LABEL = { sample: 'Sample data', postgres: 'PostgreSQL', upload: 'Uploaded files', mongodb: 'MongoDB' } as const;
const KIND_ICON = { sample: Sparkles, postgres: Database, upload: FileSpreadsheet, mongodb: Leaf } as const;

function useInvalidate() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ['data-sources'] });
    qc.invalidateQueries({ queryKey: ['source-schema'] });
    qc.invalidateQueries({ queryKey: ['suggestions'] });
    qc.invalidateQueries({ queryKey: ['insights'] });
  };
}

// ---- Connect a PostgreSQL database -------------------------------------------------------

function TablePicker({
  tables,
  selected,
  onChange,
  documents = false,
}: {
  tables: TableSummary[];
  selected: Set<string>;
  onChange: (s: Set<string>) => void;
  /** MongoDB: say fields/docs instead of cols/rows. */
  documents?: boolean;
}) {
  const bySchema = useMemo(() => {
    const m = new Map<string, TableSummary[]>();
    for (const t of tables) m.set(t.schema, [...(m.get(t.schema) ?? []), t]);
    return [...m.entries()];
  }, [tables]);
  const toggle = (key: string) => {
    const next = new Set(selected);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onChange(next);
  };
  return (
    <div className='max-h-64 overflow-y-auto rounded-lg border border-border'>
      {bySchema.map(([schema, list]) => (
        <div key={schema}>
          <div className='sticky top-0 flex items-center justify-between bg-surface-2 px-3 py-1.5 text-xs font-medium text-muted'>
            <span>{schema}</span>
            <button
              type='button'
              className='cursor-pointer hover:text-text'
              onClick={() => {
                const keys = list.map(t => `${t.schema}.${t.table}`);
                const all = keys.every(k => selected.has(k));
                const next = new Set(selected);
                keys.forEach(k => (all ? next.delete(k) : next.add(k)));
                onChange(next);
              }}
            >
              {list.every(t => selected.has(`${t.schema}.${t.table}`)) ? 'None' : 'All'}
            </button>
          </div>
          {list.map(t => {
            const key = `${t.schema}.${t.table}`;
            return (
              <label key={key} className='flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm hover:bg-surface-2'>
                <input type='checkbox' checked={selected.has(key)} onChange={() => toggle(key)} className='accent-[var(--brand)]' />
                <span className='flex-1 truncate'>{t.table}</span>
                <span className='text-xs text-muted'>
                  {t.columns.length} {documents ? 'fields' : 'cols'} · ~{t.rows.toLocaleString()} {documents ? 'docs' : 'rows'}
                </span>
              </label>
            );
          })}
        </div>
      ))}
    </div>
  );
}

type DbKind = 'postgres' | 'mongodb';

function ConnectDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const invalidate = useInvalidate();
  const [kind, setKind] = useState<DbKind>('postgres');
  const [conn, setConn] = useState<PgConnectionInput>({ host: '', port: 5432, database: '', user: '', password: '', ssl: true });
  const [mongo, setMongo] = useState({ uri: '', database: '' });
  const [name, setName] = useState('');
  const [check, setCheck] = useState<ConnectionCheckResult | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (open) {
      setCheck(null);
      setSelected(new Set());
    }
  }, [open]);
  const reset = () => setCheck(null);
  const dbName = kind === 'postgres' ? conn.database : mongo.database;
  const noun = kind === 'postgres' ? 'table' : 'collection';

  const test = useMutation({
    mutationFn: () => (kind === 'postgres' ? api.checkConnection(conn) : api.checkMongo(mongo)),
    onSuccess: r => {
      setCheck(r);
      if (r.ok) {
        // Nothing is shared with the AI until the admin ticks it.
        setSelected(new Set());
        if (!name) setName(dbName);
      }
    },
    onError: e => setCheck({ ok: false, error: errMsg(e, 'Could not test the connection.') }),
  });
  const save = useMutation({
    mutationFn: () => {
      const label = name.trim() || dbName;
      if (kind === 'postgres') return api.createDataSource({ name: label, connection: conn, allowedTables: [...selected] });
      // The picker keys are "database.collection"; Mongo sources store collection names.
      return api.createMongoSource({ name: label, connection: mongo, collections: [...selected].map(k => k.slice(k.indexOf('.') + 1)) });
    },
    onSuccess: () => {
      invalidate();
      toast.success('Database connected. Choose “Use for questions” to switch to it.');
      onClose();
    },
    onError: e => toast.error(errMsg(e, 'Could not save the connection.')),
  });
  const field = (key: keyof PgConnectionInput) => (e: React.ChangeEvent<HTMLInputElement>) => {
    reset();
    setConn(c => ({ ...c, [key]: key === 'port' ? Number(e.target.value) : e.target.value }));
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title='Connect a database'
      description='Use a login that can only read. Chatboat also keeps every query read-only and stops it after 5 seconds.'
      className='w-[min(560px,calc(100vw-32px))]'
    >
      <div className='mb-4 grid grid-cols-2 gap-1 rounded-lg bg-surface-2 p-1' role='radiogroup' aria-label='Database type'>
        {(['postgres', 'mongodb'] as const).map(k => (
          <button
            key={k}
            type='button'
            role='radio'
            aria-checked={kind === k}
            onClick={() => {
              setKind(k);
              reset();
            }}
            className={cn(
              'flex cursor-pointer items-center justify-center gap-1.5 rounded-md py-1.5 text-sm',
              kind === k ? 'bg-surface font-medium shadow-sm' : 'text-muted hover:text-text'
            )}
          >
            {k === 'postgres' ? <Database className='h-4 w-4' /> : <Leaf className='h-4 w-4' />}
            {KIND_LABEL[k]}
          </button>
        ))}
      </div>

      <form
        className='space-y-3'
        onSubmit={e => {
          e.preventDefault();
          test.mutate();
        }}
      >
        {kind === 'postgres' ? (
          <>
            <div className='grid grid-cols-[1fr_96px] gap-3'>
              <div className='space-y-1.5'>
                <Label htmlFor='db-host'>Host</Label>
                <Input id='db-host' value={conn.host} onChange={field('host')} required placeholder='db.company.internal' />
              </div>
              <div className='space-y-1.5'>
                <Label htmlFor='db-port'>Port</Label>
                <Input id='db-port' type='number' value={conn.port} onChange={field('port')} required />
              </div>
            </div>
            <div className='grid grid-cols-3 gap-3'>
              <div className='space-y-1.5'>
                <Label htmlFor='db-name'>Database</Label>
                <Input id='db-name' value={conn.database} onChange={field('database')} required />
              </div>
              <div className='space-y-1.5'>
                <Label htmlFor='db-user'>User</Label>
                <Input id='db-user' value={conn.user} onChange={field('user')} required autoComplete='off' />
              </div>
              <div className='space-y-1.5'>
                <Label htmlFor='db-pass'>Password</Label>
                <Input id='db-pass' type='password' value={conn.password} onChange={field('password')} autoComplete='new-password' />
              </div>
            </div>
            <label className='flex items-center gap-2 text-sm'>
              <input
                type='checkbox'
                checked={conn.ssl}
                onChange={e => {
                  reset();
                  setConn(c => ({ ...c, ssl: e.target.checked }));
                }}
                className='accent-[var(--brand)]'
              />
              Require SSL (recommended unless the database is on the same private network)
            </label>
          </>
        ) : (
          <>
            <div className='space-y-1.5'>
              <Label htmlFor='mongo-uri'>Connection string</Label>
              <Input
                id='mongo-uri'
                type='password'
                value={mongo.uri}
                onChange={e => {
                  reset();
                  setMongo(m => ({ ...m, uri: e.target.value }));
                }}
                required
                autoComplete='off'
                placeholder='mongodb+srv://reader:password@cluster0.example.mongodb.net/'
              />
              <p className='text-xs text-muted'>
                Includes the password, so it’s hidden here and stored encrypted. Use a user with the built-in <code>read</code> role.
              </p>
            </div>
            <div className='space-y-1.5'>
              <Label htmlFor='mongo-db'>Database</Label>
              <Input
                id='mongo-db'
                value={mongo.database}
                onChange={e => {
                  reset();
                  setMongo(m => ({ ...m, database: e.target.value }));
                }}
                required
                placeholder='shop'
              />
            </div>
          </>
        )}
        <Button type='submit' variant='secondary' disabled={test.isPending}>
          {test.isPending ? 'Testing…' : 'Test connection'}
        </Button>
      </form>

      {check && !check.ok && (
        <p role='alert' className='mt-3 flex gap-2 rounded-lg border border-danger/30 bg-danger/5 p-3 text-sm text-danger'>
          <AlertTriangle className='mt-0.5 h-4 w-4 shrink-0' /> {check.error}
        </p>
      )}
      {check?.ok && (
        <div className='mt-4 space-y-3'>
          <p className='flex items-center gap-2 text-sm text-good'>
            <CheckCircle2 className='h-4 w-4' /> Connected. {check.tables?.length ?? 0} {noun}s visible to this login.
          </p>
          {(check.canWrite || check.isSuperuser) && (
            <p className='flex gap-2 rounded-lg border border-warn/40 bg-warn/10 p-3 text-sm'>
              <AlertTriangle className='mt-0.5 h-4 w-4 shrink-0 text-warn' />
              <span>
                This login can <strong>change data</strong>
                {check.isSuperuser ? ' (it is a superuser)' : ''}. Chatboat only ever runs read-only queries, but for safety
                create a separate read-only user.
              </span>
            </p>
          )}
          <div className='space-y-1.5'>
            <span className='text-sm font-medium'>{kind === 'postgres' ? 'Tables' : 'Collections'} the AI may use</span>
            <p className='text-xs text-muted'>
              Tick only what people should ask about. Leave out anything sensitive (salaries, passwords, personal data): the AI
              never sees unticked {noun}s.
            </p>
            {check.tables?.length ? (
              <TablePicker tables={check.tables} selected={selected} onChange={setSelected} documents={kind === 'mongodb'} />
            ) : (
              <p className='text-sm text-muted'>This login can’t read any {noun}s.</p>
            )}
          </div>
          <div className='space-y-1.5'>
            <Label htmlFor='db-label'>Name in Chatboat</Label>
            <Input id='db-label' value={name} onChange={e => setName(e.target.value)} maxLength={80} placeholder='Sales database' />
          </div>
          <div className='flex justify-end gap-2'>
            <Button type='button' variant='secondary' onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={() => save.mutate()} disabled={!selected.size || save.isPending}>
              {save.isPending ? 'Saving…' : `Save with ${selected.size} ${selected.size === 1 ? noun : `${noun}s`}`}
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  );
}

// ---- One source card ----------------------------------------------------------------------

function SourceCard({ source }: { source: DataSourceInfo }) {
  const invalidate = useInvalidate();
  const dialogs = useDialogs();
  const [open, setOpen] = useState(source.isActive);
  const [notes, setNotes] = useState(source.notes);
  useEffect(() => setNotes(source.notes), [source.notes]);
  const Icon = KIND_ICON[source.kind];

  const schema = useQuery({
    queryKey: ['source-schema', source.id, source.updatedAt],
    queryFn: () => api.dataSourceSchema(source.id),
    enabled: open,
  });
  const activate = useMutation({
    mutationFn: () => api.activateDataSource(source.id),
    onSuccess: () => {
      invalidate();
      toast.success(`New questions now use “${source.name}”.`);
    },
    onError: e => toast.error(errMsg(e, 'Could not switch data source.')),
  });
  const saveNotes = useMutation({
    mutationFn: () => api.updateDataSource(source.id, { notes }),
    onSuccess: () => {
      invalidate();
      toast.success('Notes saved');
    },
  });
  const remove = useMutation({
    mutationFn: () => api.deleteDataSource(source.id),
    onSuccess: () => {
      invalidate();
      toast.success('Data source removed');
    },
  });
  const dropTable = useMutation({
    mutationFn: api.deleteUploadedTable,
    onSuccess: () => {
      invalidate();
      toast.success('Table removed');
    },
  });

  return (
    <div className={cn('rounded-xl border bg-surface', source.isActive ? 'border-brand' : 'border-border')}>
      <div className='flex flex-wrap items-center gap-3 p-4'>
        <span className='grid h-9 w-9 place-items-center rounded-lg bg-surface-2 text-muted'>
          <Icon className='h-4 w-4' />
        </span>
        <div className='min-w-0 flex-1'>
          <div className='flex items-center gap-2'>
            <span className='truncate font-medium'>{source.name}</span>
            {source.isActive && <span className='rounded-full bg-brand-soft px-2 py-0.5 text-xs font-medium text-brand'>In use</span>}
          </div>
          <div className='text-xs text-muted'>
            {KIND_LABEL[source.kind]}
            {source.kind === 'postgres' &&
              ` · ${source.config.user}@${source.config.host}:${source.config.port}/${source.config.database} · ${source.allowedTables.length} tables allowed`}
            {source.kind === 'mongodb' &&
              ` · ${source.config.host}/${source.config.database} · ${source.allowedTables.length} collections allowed`}
          </div>
        </div>
        {!source.isActive && (
          <Button size='sm' onClick={() => activate.mutate()} disabled={activate.isPending}>
            Use for questions
          </Button>
        )}
        {source.kind !== 'sample' && (
          <Button
            size='icon'
            variant='ghost'
            aria-label={`Remove ${source.name}`}
            onClick={async () => {
              const ok = await dialogs.confirm({
                title: `Remove “${source.name}”?`,
                description:
                  source.kind === 'upload'
                    ? 'Chatboat stops using the uploaded files as a data source. Charts built on it can no longer refresh.'
                    : 'Chatboat forgets this connection. Your database is not touched. Charts built on it can no longer refresh.',
                confirmLabel: 'Remove',
                danger: true,
              });
              if (ok) remove.mutate();
            }}
          >
            <Trash2 className='h-4 w-4' />
          </Button>
        )}
        <Button size='icon' variant='ghost' aria-label='Show details' aria-expanded={open} onClick={() => setOpen(o => !o)}>
          <ChevronDown className={cn('h-4 w-4 transition-transform', open && 'rotate-180')} />
        </Button>
      </div>

      {open && (
        <div className='space-y-4 border-t border-border p-4'>
          {source.kind === 'upload' && schema.data && (
            <div className='space-y-1.5'>
              <span className='text-sm font-medium'>Uploaded tables</span>
              {schema.data.tables.length === 0 && <p className='text-sm text-muted'>No files uploaded yet.</p>}
              <ul className='divide-y divide-border rounded-lg border border-border'>
                {schema.data.tables.map(t => (
                  <li key={t.table} className='flex items-center gap-2 px-3 py-2 text-sm'>
                    <Table2 className='h-4 w-4 text-muted' />
                    <span className='flex-1'>{t.table}</span>
                    <span className='text-xs text-muted'>
                      {t.columns.length} columns · ~{t.rows.toLocaleString()} rows
                    </span>
                    <button
                      aria-label={`Delete table ${t.table}`}
                      onClick={async () => {
                        const ok = await dialogs.confirm({
                          title: `Delete “${t.table}”?`,
                          description: 'The uploaded rows are deleted. Upload the file again to restore them.',
                          confirmLabel: 'Delete',
                          danger: true,
                        });
                        if (ok) dropTable.mutate(t.table);
                      }}
                      className='cursor-pointer rounded p-1 text-muted hover:text-danger'
                    >
                      <Trash2 className='h-4 w-4' />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className='space-y-1.5'>
            <span className='text-sm font-medium'>What the AI is told about these tables</span>
            {schema.isLoading && <p className='text-sm text-muted'>Reading tables…</p>}
            {schema.error && <p className='text-sm text-danger'>{errMsg(schema.error, 'Could not read the tables.')}</p>}
            {schema.data && (
              <pre className='max-h-56 overflow-auto rounded-lg bg-surface-2 p-3 text-xs leading-relaxed'>
                {schema.data.doc || '(no tables)'}
              </pre>
            )}
          </div>

          {source.kind !== 'sample' && (
            <div className='space-y-1.5'>
              <Label htmlFor={`notes-${source.id}`}>Notes for the AI</Label>
              <textarea
                id={`notes-${source.id}`}
                rows={3}
                maxLength={4000}
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder='e.g. amounts are in INR; status "refunded" means the money was returned; ignore test customers with ids below 10'
                className='w-full resize-y rounded-lg border border-border bg-surface p-3 text-sm outline-none placeholder:text-muted focus:border-brand'
              />
              <Button size='sm' variant='secondary' disabled={notes === source.notes || saveNotes.isPending} onClick={() => saveNotes.mutate()}>
                Save notes
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---- Uploads, glossary, tab -------------------------------------------------------------------

function UploadCard() {
  const invalidate = useInvalidate();
  const upload = useMutation({
    mutationFn: api.uploadSpreadsheet,
    onSuccess: r => {
      invalidate();
      toast.success(`Uploaded ${r.tables.map(t => `${t.table} (${t.rows.toLocaleString()} rows)`).join(', ')}`);
    },
    onError: e => toast.error(errMsg(e, 'Upload failed.')),
  });
  return (
    <label
      className={cn(
        'flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-surface p-6 text-center hover:border-brand',
        upload.isPending && 'pointer-events-none opacity-60'
      )}
    >
      <Upload className='h-6 w-6 text-muted' />
      <span className='text-sm font-medium'>{upload.isPending ? 'Uploading…' : 'Upload a CSV or Excel file'}</span>
      <span className='text-xs text-muted'>
        Each sheet becomes a table (up to 20 MB). Uploading a file with the same name replaces its table.
      </span>
      <input
        type='file'
        accept='.csv,.xlsx,.xls'
        className='sr-only'
        onChange={e => {
          const file = e.target.files?.[0];
          if (file) upload.mutate(file);
          e.target.value = '';
        }}
      />
    </label>
  );
}

function GlossaryCard() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['glossary'], queryFn: api.glossary });
  const [terms, setTerms] = useState<{ term: string; definition: string }[]>([]);
  useEffect(() => {
    if (data) setTerms(data.terms);
  }, [data]);
  const save = useMutation({
    mutationFn: () => api.saveGlossary(terms.filter(t => t.term.trim() && t.definition.trim())),
    onSuccess: d => {
      qc.setQueryData(['glossary'], d);
      toast.success('Definitions saved. The AI uses them from the next question.');
    },
    onError: e => toast.error(errMsg(e, 'Could not save.')),
  });
  const set = (i: number, key: 'term' | 'definition', v: string) =>
    setTerms(ts => ts.map((t, j) => (j === i ? { ...t, [key]: v } : t)));

  return (
    <div className='rounded-xl border border-border bg-surface p-4'>
      <h3 className='text-sm font-semibold'>Company definitions</h3>
      <p className='mt-1 text-xs text-muted'>
        Tell the AI what your words mean, e.g. <em>Revenue</em> = paid orders minus refunds. Used for every data source.
      </p>
      <div className='mt-3 space-y-2'>
        {terms.map((t, i) => (
          <div key={i} className='flex gap-2'>
            <Input aria-label='Term' value={t.term} onChange={e => set(i, 'term', e.target.value)} placeholder='Revenue' className='w-40 shrink-0' />
            <Input
              aria-label='Definition'
              value={t.definition}
              onChange={e => set(i, 'definition', e.target.value)}
              placeholder='Sum of order amount where status is paid'
            />
            <Button size='icon' variant='ghost' aria-label='Remove definition' onClick={() => setTerms(ts => ts.filter((_, j) => j !== i))}>
              <Trash2 className='h-4 w-4' />
            </Button>
          </div>
        ))}
      </div>
      <div className='mt-3 flex gap-2'>
        <Button size='sm' variant='secondary' onClick={() => setTerms(ts => [...ts, { term: '', definition: '' }])}>
          <Plus className='h-4 w-4' /> Add definition
        </Button>
        <Button size='sm' onClick={() => save.mutate()} disabled={save.isPending}>
          Save definitions
        </Button>
      </div>
    </div>
  );
}

export function DataTab() {
  const { data: sources, isLoading } = useQuery({ queryKey: ['data-sources'], queryFn: api.dataSources });
  const [connectOpen, setConnectOpen] = useState(false);
  return (
    <div className='space-y-6'>
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <p className='text-sm text-muted'>Questions are answered from the source marked “In use”. Switch any time; existing charts keep their own source.</p>
        <Button onClick={() => setConnectOpen(true)}>
          <Database className='h-4 w-4' /> Connect a database
        </Button>
      </div>
      {isLoading && <p className='text-sm text-muted'>Loading…</p>}
      <div className='space-y-3'>
        {sources?.map(s => <SourceCard key={s.id} source={s} />)}
      </div>
      <UploadCard />
      <GlossaryCard />
      <ConnectDialog open={connectOpen} onClose={() => setConnectOpen(false)} />
    </div>
  );
}
