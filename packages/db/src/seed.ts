import { faker } from '@faker-js/faker';
import { sql as rawSql } from 'drizzle-orm';
import { db, sql } from './index';
import {
  customers,
  inventory,
  invoiceItems,
  invoices,
  payments,
  products,
  regions,
  salesReps,
} from './schema/biz';

faker.seed(42);

const REGION_STATES: Record<string, string[]> = {
  West: ['California', 'Washington', 'Oregon', 'Nevada', 'Arizona'],
  East: ['New York', 'Massachusetts', 'New Jersey', 'Pennsylvania'],
  Central: ['Illinois', 'Ohio', 'Michigan', 'Minnesota'],
  South: ['Texas', 'Florida', 'Georgia', 'North Carolina'],
};
const INDUSTRIES = ['Retail', 'Manufacturing', 'Healthcare', 'Technology', 'Hospitality', 'Logistics', 'Education'];
const SEGMENTS = ['SMB', 'Mid-Market', 'Enterprise'] as const;
const CATEGORIES: Record<string, [number, number]> = {
  Electronics: [120, 1800],
  'Office Supplies': [5, 80],
  Furniture: [150, 1500],
  Software: [300, 5000],
  Networking: [80, 2500],
};
const WAREHOUSES = ['Oakland CA', 'Dallas TX', 'Newark NJ'];

async function insertChunks<T>(rows: T[], insert: (chunk: T[]) => Promise<unknown>, size = 1000) {
  for (let i = 0; i < rows.length; i += size) await insert(rows.slice(i, i + size));
}
const money = (n: number) => n.toFixed(2);
const iso = (d: Date) => d.toISOString().slice(0, 10);

async function main() {
  await db.execute(
    rawSql`TRUNCATE biz.payments, biz.invoice_items, biz.invoices, biz.inventory, biz.products, biz.customers, biz.sales_reps, biz.regions RESTART IDENTITY CASCADE`
  );

  const regionRows = Object.entries(REGION_STATES).flatMap(([name, states]) =>
    states.map(state => ({ name, state }))
  );
  const insertedRegions = await db.insert(regions).values(regionRows).returning();

  const repRows = insertedRegions.flatMap(r =>
    Array.from({ length: r.state === 'California' || r.state === 'Texas' ? 2 : 1 }, () => {
      const name = faker.person.fullName();
      return { name, email: faker.internet.email({ firstName: name.split(' ')[0] }).toLowerCase(), regionId: r.id };
    })
  );
  const insertedReps = await db.insert(salesReps).values(repRows).returning();

  // Bigger states get more customers so the data looks realistic.
  const weight = (state: string) => ({ California: 6, Texas: 5, 'New York': 5, Florida: 4 } as Record<string, number>)[state] ?? 2;
  const customerRows = insertedRegions.flatMap(r =>
    Array.from({ length: weight(r.state) * 8 }, () => ({
      name: faker.company.name(),
      industry: faker.helpers.arrayElement(INDUSTRIES),
      segment: faker.helpers.weightedArrayElement([
        { value: SEGMENTS[0], weight: 6 },
        { value: SEGMENTS[1], weight: 3 },
        { value: SEGMENTS[2], weight: 1 },
      ]),
      regionId: r.id,
      city: faker.location.city(),
      createdOn: iso(faker.date.past({ years: 4 })),
    }))
  );
  const insertedCustomers = await db.insert(customers).values(customerRows).returning();

  const productRows = Object.entries(CATEGORIES).flatMap(([category, [min, max]]) =>
    Array.from({ length: 8 }, (_, i) => {
      const price = faker.number.float({ min, max, fractionDigits: 2 });
      return {
        sku: `${category.slice(0, 3).toUpperCase()}-${1000 + i}`,
        name: `${faker.commerce.productAdjective()} ${faker.commerce.product()}`,
        category,
        unitPrice: money(price),
        unitCost: money(price * faker.number.float({ min: 0.45, max: 0.75 })),
      };
    })
  );
  const insertedProducts = await db.insert(products).values(productRows).returning();

  // ~2 years of invoices with growth + Q4 seasonality.
  const today = new Date();
  const start = new Date(today.getFullYear() - 2, today.getMonth(), 1);
  const invoiceRows: (typeof invoices.$inferInsert)[] = [];
  const itemRows: { invoiceIdx: number; productId: number; quantity: number; unitPrice: string; lineTotal: string }[] = [];
  let n = 0;
  for (let m = new Date(start); m <= today; m = new Date(m.getFullYear(), m.getMonth() + 1, 1)) {
    const monthsIn = (m.getFullYear() - start.getFullYear()) * 12 + m.getMonth() - start.getMonth();
    const seasonal = m.getMonth() >= 9 ? 1.35 : m.getMonth() <= 1 ? 0.85 : 1;
    const count = Math.round((180 + monthsIn * 6) * seasonal);
    for (let i = 0; i < count; i++) {
      const customer = faker.helpers.arrayElement(insertedCustomers);
      const reps = insertedReps.filter(r => r.regionId === customer.regionId);
      const rep = faker.helpers.arrayElement(reps.length ? reps : insertedReps);
      const issue = faker.date.between({ from: m, to: new Date(Math.min(+new Date(m.getFullYear(), m.getMonth() + 1, 0), +today)) });
      const due = new Date(issue.getTime() + 30 * 864e5);
      const lines = faker.number.int({ min: 1, max: 4 });
      let total = 0;
      const idx = invoiceRows.length;
      for (let l = 0; l < lines; l++) {
        const p = faker.helpers.arrayElement(insertedProducts);
        const qtyMax = customer.segment === 'Enterprise' ? 40 : customer.segment === 'Mid-Market' ? 15 : 5;
        const quantity = faker.number.int({ min: 1, max: qtyMax });
        const lineTotal = quantity * Number(p.unitPrice);
        total += lineTotal;
        itemRows.push({ invoiceIdx: idx, productId: p.id, quantity, unitPrice: p.unitPrice, lineTotal: money(lineTotal) });
      }
      const ageDays = (+today - +due) / 864e5;
      const status =
        faker.number.float() < 0.02
          ? 'void'
          : ageDays < 0
            ? faker.helpers.arrayElement(['open', 'paid'])
            : faker.number.float() < 0.9
              ? 'paid'
              : 'overdue';
      invoiceRows.push({
        invoiceNumber: `INV-${String(++n).padStart(6, '0')}`,
        customerId: customer.id,
        salesRepId: rep.id,
        issueDate: iso(issue),
        dueDate: iso(due),
        status,
        totalAmount: money(total),
      });
    }
  }

  const invoiceIds: number[] = [];
  await insertChunks(invoiceRows, async chunk => {
    const res = await db.insert(invoices).values(chunk).returning({ id: invoices.id });
    invoiceIds.push(...res.map(r => r.id));
  });
  await insertChunks(
    itemRows.map(({ invoiceIdx, ...r }) => ({ ...r, invoiceId: invoiceIds[invoiceIdx] })),
    chunk => db.insert(invoiceItems).values(chunk)
  );

  const paymentRows = invoiceRows.flatMap((inv, i) =>
    inv.status === 'paid'
      ? [{
          invoiceId: invoiceIds[i],
          paidOn: iso(new Date(new Date(inv.issueDate as string).getTime() + faker.number.int({ min: 3, max: 45 }) * 864e5)),
          amount: inv.totalAmount,
          method: faker.helpers.arrayElement(['card', 'ach', 'wire', 'check']),
        }]
      : []
  );
  await insertChunks(paymentRows, chunk => db.insert(payments).values(chunk));

  await db.insert(inventory).values(
    insertedProducts.flatMap(p =>
      WAREHOUSES.map(warehouse => ({
        productId: p.id,
        warehouse,
        quantityOnHand: faker.number.int({ min: 0, max: 600 }),
        reorderLevel: faker.number.int({ min: 40, max: 120 }),
      }))
    )
  );

  console.log(
    `Seeded ${insertedRegions.length} regions, ${insertedReps.length} reps, ${insertedCustomers.length} customers, ` +
      `${insertedProducts.length} products, ${invoiceRows.length} invoices, ${itemRows.length} line items, ${paymentRows.length} payments.`
  );
  await sql.end();
}

main().catch(async e => {
  console.error(e);
  await sql.end();
  process.exit(1);
});
