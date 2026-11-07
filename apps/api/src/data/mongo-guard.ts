/**
 * Safety check for AI-written MongoDB aggregation pipelines. Pure (no driver), so
 * it's easy to test. The company's read-only Mongo user is the real boundary; this
 * keeps queries to read-only stages over the collections the admin allowed.
 */
export class UnsafeQueryError extends Error {}

export const MAX_STAGES = 30;

/** Read-only stages the AI may use. Anything else ($out, $merge, $currentOp, …) is refused. */
const ALLOWED_STAGES = new Set([
  '$match', '$group', '$project', '$addFields', '$set', '$unset', '$sort', '$limit', '$skip',
  '$unwind', '$lookup', '$count', '$facet', '$bucket', '$bucketAuto', '$sortByCount',
  '$replaceRoot', '$replaceWith', '$sample', '$densify', '$fill', '$setWindowFields',
  '$unionWith', '$graphLookup', '$redact',
]);

/** Operators that run code or write, refused anywhere in the pipeline. */
const FORBIDDEN_KEYS = new Set(['$function', '$accumulator', '$where', '$out', '$merge', '$eval']);

export interface MongoQuery {
  collection: string;
  pipeline: Record<string, unknown>[];
}

function checkValue(value: unknown, allowed: Set<string>, depth: number): void {
  if (depth > 40) throw new UnsafeQueryError('The query is nested too deeply.');
  if (Array.isArray(value)) {
    value.forEach(v => checkValue(v, allowed, depth + 1));
    return;
  }
  if (value && typeof value === 'object') {
    for (const [key, v] of Object.entries(value)) {
      if (FORBIDDEN_KEYS.has(key)) throw new UnsafeQueryError(`"${key}" is not allowed in queries.`);
      checkValue(v, allowed, depth + 1);
    }
  }
}

function checkCollection(name: unknown, allowed: Set<string>) {
  if (typeof name !== 'string' || !allowed.has(name)) {
    throw new UnsafeQueryError(`Collection "${String(name)}" is not allowed. Use only the collections listed.`);
  }
}

function checkPipeline(pipeline: unknown, allowed: Set<string>, depth = 0): void {
  if (!Array.isArray(pipeline)) throw new UnsafeQueryError('pipeline must be an array of stages.');
  if (pipeline.length > MAX_STAGES) throw new UnsafeQueryError(`Use at most ${MAX_STAGES} stages.`);
  for (const stage of pipeline) {
    if (!stage || typeof stage !== 'object' || Array.isArray(stage)) throw new UnsafeQueryError('Each stage must be an object.');
    const keys = Object.keys(stage);
    if (keys.length !== 1) throw new UnsafeQueryError('Each stage must have exactly one operator, e.g. { "$match": … }.');
    const [op] = keys;
    if (!ALLOWED_STAGES.has(op)) throw new UnsafeQueryError(`Stage "${op}" is not allowed. Only read-only stages can be used.`);
    const body = (stage as Record<string, unknown>)[op] as Record<string, unknown>;

    // Stages that read other collections must stay inside the allow-list, including nested pipelines.
    if (op === '$lookup' || op === '$graphLookup') {
      if (body.from !== undefined) checkCollection(body.from, allowed);
      if (body.pipeline !== undefined) checkPipeline(body.pipeline, allowed, depth + 1);
    }
    if (op === '$unionWith') {
      const coll = typeof body === 'string' ? body : body.coll;
      checkCollection(coll, allowed);
      if (typeof body === 'object' && body.pipeline !== undefined) checkPipeline(body.pipeline, allowed, depth + 1);
    }
    if (op === '$facet') {
      for (const sub of Object.values(body ?? {})) checkPipeline(sub, allowed, depth + 1);
    }
    checkValue(body, allowed, depth);
  }
}

/** Parse and validate the stored/AI query. Accepts an object or its JSON text. */
export function guardMongoQuery(input: unknown, allowedCollections: Set<string>): MongoQuery {
  let q: unknown = input;
  if (typeof input === 'string') {
    try {
      q = JSON.parse(input);
    } catch {
      throw new UnsafeQueryError('The query is not valid JSON.');
    }
  }
  if (!q || typeof q !== 'object') throw new UnsafeQueryError('Expected { collection, pipeline }.');
  const { collection, pipeline } = q as Partial<MongoQuery>;
  checkCollection(collection, allowedCollections);
  checkPipeline(pipeline, allowedCollections);
  return { collection: collection as string, pipeline: pipeline as Record<string, unknown>[] };
}
