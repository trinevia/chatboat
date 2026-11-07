import { describe, expect, it } from 'vitest';
import { guardMongoQuery, UnsafeQueryError } from '../src/data/mongo-guard';
import { flattenDoc, hostOf } from '../src/data/mongo';

const allowed = new Set(['orders', 'products']);
const q = (collection: string, pipeline: unknown[]) => ({ collection, pipeline });

describe('MongoDB pipeline guard', () => {
  it('allows read-only aggregations on allowed collections', () => {
    expect(() =>
      guardMongoQuery(
        q('orders', [
          { $match: { status: 'delivered' } },
          { $unwind: '$items' },
          { $group: { _id: '$customer.city', total: { $sum: '$total' } } },
          { $sort: { total: -1 } },
        ]),
        allowed
      )
    ).not.toThrow();
    expect(() => guardMongoQuery(JSON.stringify(q('orders', [{ $count: 'n' }])), allowed)).not.toThrow();
  });

  it.each([
    ['other collection', q('staff', [{ $match: {} }])],
    ['$out', q('orders', [{ $out: 'copy' }])],
    ['$merge', q('orders', [{ $merge: { into: 'x' } }])],
    ['$function in an expression', q('orders', [{ $addFields: { x: { $function: { body: 'return 1', args: [], lang: 'js' } } } }])],
    ['$where in $match', q('orders', [{ $match: { $where: 'sleep(10000)' } }])],
    ['$lookup into a forbidden collection', q('orders', [{ $lookup: { from: 'staff', localField: 'a', foreignField: 'b', as: 'c' } }])],
    ['$unionWith a forbidden collection', q('orders', [{ $unionWith: 'staff' }])],
    ['$facet hiding $out', q('orders', [{ $facet: { a: [{ $out: 'x' }] } }])],
    ['unknown stage', q('orders', [{ $currentOp: {} }])],
    ['two operators in one stage', q('orders', [{ $match: {}, $sort: { a: 1 } }])],
    ['not JSON', 'select * from orders'],
  ])('rejects %s', (_label, query) => {
    expect(() => guardMongoQuery(query, allowed)).toThrow(UnsafeQueryError);
  });
});

describe('MongoDB results', () => {
  it('flattens nested documents into chart-friendly columns', () => {
    const row = flattenDoc({ _id: 'Pune', customer: { city: 'Pune', vip: true }, total: 12.5, at: new Date('2025-03-01T00:00:00Z'), tags: ['a'] });
    expect(row).toEqual({ _id: 'Pune', 'customer.city': 'Pune', 'customer.vip': 'true', total: 12.5, at: '2025-03-01', tags: '["a"]' });
  });

  it('shows only the host of a connection string', () => {
    expect(hostOf('mongodb+srv://user:secret@cluster0.ab.mongodb.net/?retryWrites=true')).toBe('cluster0.ab.mongodb.net');
    expect(hostOf('mongodb://reader:pw@db1:27017,db2:27017/shop')).toBe('db1:27017,db2:27017');
  });
});

describe('MongoDB extended JSON', () => {
  it('turns {"$date": ...} into a real Date before the query runs', async () => {
    const { BSON } = await import('mongodb');
    const [stage] = BSON.EJSON.deserialize([{ $match: { createdAt: { $gte: { $date: '2025-01-01T00:00:00Z' } } } }], { relaxed: true }) as {
      $match: { createdAt: { $gte: unknown } };
    }[];
    expect(stage.$match.createdAt.$gte).toBeInstanceOf(Date);
  });
});
