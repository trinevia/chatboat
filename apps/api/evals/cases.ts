/**
 * Accuracy test set. Each question names its period explicitly so the right answer
 * doesn't depend on what day the eval runs. `sql` is the reference answer, run
 * against the same database; the model passes when the numbers it returns match.
 */
export interface EvalCase {
  id: string;
  question: string;
  sql: string;
  /** "Which X had the most…" questions: listing every row is fine if the right one is there. */
  allowExtraRows?: boolean;
}

const SALES = `i.status <> 'void'`;
const Y2025 = `i.issue_date >= '2025-01-01' AND i.issue_date < '2026-01-01'`;

export const CASES: EvalCase[] = [
  {
    id: 'total-sales-2025',
    question: 'What were total sales in 2025?',
    sql: `SELECT SUM(total_amount) FROM biz.invoices i WHERE ${SALES} AND ${Y2025}`,
  },
  {
    id: 'invoice-count-2025',
    question: 'How many invoices were issued in 2025, excluding void invoices?',
    sql: `SELECT COUNT(*) FROM biz.invoices i WHERE ${SALES} AND ${Y2025}`,
  },
  {
    id: 'overdue-total',
    question: 'What is the total amount of invoices with status overdue?',
    sql: `SELECT SUM(total_amount) FROM biz.invoices WHERE status = 'overdue'`,
  },
  {
    id: 'sales-by-region-2025',
    question: 'Show total sales by region for 2025.',
    sql: `SELECT r.name, SUM(i.total_amount) FROM biz.invoices i JOIN biz.customers c ON c.id = i.customer_id
          JOIN biz.regions r ON r.id = c.region_id WHERE ${SALES} AND ${Y2025} GROUP BY r.name`,
  },
  {
    id: 'sales-by-segment-2025',
    question: 'Break down 2025 sales by customer segment.',
    sql: `SELECT c.segment, SUM(i.total_amount) FROM biz.invoices i JOIN biz.customers c ON c.id = i.customer_id
          WHERE ${SALES} AND ${Y2025} GROUP BY c.segment`,
  },
  {
    id: 'top5-customers-2025',
    question: 'Who were the top 5 customers by sales in 2025?',
    sql: `SELECT c.name, SUM(i.total_amount) AS s FROM biz.invoices i JOIN biz.customers c ON c.id = i.customer_id
          WHERE ${SALES} AND ${Y2025} GROUP BY c.id, c.name ORDER BY s DESC LIMIT 5`,
  },
  {
    id: 'monthly-sales-2025',
    question: 'Show monthly sales for each month of 2025.',
    sql: `SELECT date_trunc('month', issue_date), SUM(total_amount) FROM biz.invoices i
          WHERE ${SALES} AND ${Y2025} GROUP BY 1`,
  },
  {
    id: 'california-2025',
    question: 'What were total sales to customers in California in 2025?',
    sql: `SELECT SUM(i.total_amount) FROM biz.invoices i JOIN biz.customers c ON c.id = i.customer_id
          JOIN biz.regions r ON r.id = c.region_id WHERE r.state = 'California' AND ${SALES} AND ${Y2025}`,
  },
  {
    id: 'customers-per-industry',
    question: 'How many customers do we have in each industry?',
    sql: `SELECT industry, COUNT(*) FROM biz.customers GROUP BY industry`,
  },
  {
    id: 'avg-invoice-2025',
    question: 'What was the average invoice amount in 2025, excluding void invoices?',
    sql: `SELECT AVG(total_amount) FROM biz.invoices i WHERE ${SALES} AND ${Y2025}`,
  },
  {
    id: 'category-sales-2025',
    question: 'Show 2025 sales by product category, using invoice line totals.',
    sql: `SELECT p.category, SUM(ii.line_total) FROM biz.invoice_items ii JOIN biz.invoices i ON i.id = ii.invoice_id
          JOIN biz.products p ON p.id = ii.product_id WHERE ${SALES} AND ${Y2025} GROUP BY p.category`,
  },
  {
    id: 'top3-products-units-2025',
    question: 'Which 3 products sold the most units in 2025?',
    sql: `SELECT p.name, SUM(ii.quantity) AS u FROM biz.invoice_items ii JOIN biz.invoices i ON i.id = ii.invoice_id
          JOIN biz.products p ON p.id = ii.product_id WHERE ${SALES} AND ${Y2025} GROUP BY p.id, p.name ORDER BY u DESC LIMIT 3`,
  },
  {
    id: 'stock-by-warehouse',
    question: 'How many units are on hand in each warehouse?',
    sql: `SELECT warehouse, SUM(quantity_on_hand) FROM biz.inventory GROUP BY warehouse`,
  },
  {
    id: 'below-reorder-count',
    question: 'How many inventory records (product and warehouse) are below their reorder level?',
    sql: `SELECT COUNT(*) FROM biz.inventory WHERE quantity_on_hand < reorder_level`,
  },
  {
    id: 'payments-by-method-2025',
    question: 'For each payment method, what was the total amount of payments received in 2025? (Use the payment date to decide the year.)',
    sql: `SELECT method, SUM(amount) FROM biz.payments WHERE paid_on >= '2025-01-01' AND paid_on < '2026-01-01' GROUP BY method`,
  },
  {
    id: 'overdue-count-by-segment',
    question: 'How many overdue invoices does each customer segment have?',
    sql: `SELECT c.segment, COUNT(*) FROM biz.invoices i JOIN biz.customers c ON c.id = i.customer_id
          WHERE i.status = 'overdue' GROUP BY c.segment`,
  },
  {
    id: 'top-rep-2025',
    question: 'Which sales rep had the highest sales in 2025, and how much?',
    sql: `SELECT s.name, SUM(i.total_amount) AS t FROM biz.invoices i JOIN biz.sales_reps s ON s.id = i.sales_rep_id
          WHERE ${SALES} AND ${Y2025} GROUP BY s.id, s.name ORDER BY t DESC LIMIT 1`,
    allowExtraRows: true,
  },
  {
    id: 'margin-by-category-2025',
    question:
      'Gross margin by product category in 2025, where margin = line total minus quantity times product unit cost.',
    sql: `SELECT p.category, SUM(ii.line_total - ii.quantity * p.unit_cost) FROM biz.invoice_items ii
          JOIN biz.invoices i ON i.id = ii.invoice_id JOIN biz.products p ON p.id = ii.product_id
          WHERE ${SALES} AND ${Y2025} GROUP BY p.category`,
  },
  {
    id: 'new-customers-per-year',
    question: 'How many new customers were created each year?',
    // Year as text: it's a label, only the counts are compared.
    sql: `SELECT to_char(created_on, 'YYYY'), COUNT(*) FROM biz.customers GROUP BY 1`,
  },
  {
    id: 'q4-2025-by-region',
    question: 'Show Q4 2025 (October to December) sales by region.',
    sql: `SELECT r.name, SUM(i.total_amount) FROM biz.invoices i JOIN biz.customers c ON c.id = i.customer_id
          JOIN biz.regions r ON r.id = c.region_id WHERE ${SALES}
          AND i.issue_date >= '2025-10-01' AND i.issue_date < '2026-01-01' GROUP BY r.name`,
  },
  {
    id: 'void-count-2025',
    question: 'How many invoices issued in 2025 were voided?',
    sql: `SELECT COUNT(*) FROM biz.invoices i WHERE status = 'void' AND ${Y2025}`,
  },
  {
    id: 'texas-vs-california-2025',
    question: 'Compare total 2025 sales in Texas and California.',
    sql: `SELECT r.state, SUM(i.total_amount) FROM biz.invoices i JOIN biz.customers c ON c.id = i.customer_id
          JOIN biz.regions r ON r.id = c.region_id WHERE r.state IN ('Texas', 'California') AND ${SALES} AND ${Y2025}
          GROUP BY r.state`,
  },
  {
    id: 'best-month-2025',
    question: 'Which month of 2025 had the highest sales, and what was the total?',
    sql: `SELECT date_trunc('month', issue_date), SUM(total_amount) AS t FROM biz.invoices i
          WHERE ${SALES} AND ${Y2025} GROUP BY 1 ORDER BY t DESC LIMIT 1`,
    allowExtraRows: true,
  },
  {
    id: 'stock-value-at-cost',
    question: 'What is the total value of inventory on hand at unit cost?',
    sql: `SELECT SUM(v.quantity_on_hand * p.unit_cost) FROM biz.inventory v JOIN biz.products p ON p.id = v.product_id`,
  },
  {
    id: 'enterprise-customers-west',
    question: 'How many Enterprise customers are in the West region?',
    sql: `SELECT COUNT(*) FROM biz.customers c JOIN biz.regions r ON r.id = c.region_id
          WHERE c.segment = 'Enterprise' AND r.name = 'West'`,
  },
];
