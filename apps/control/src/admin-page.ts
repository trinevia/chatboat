import { decodeLicenceUnverified, PLANS, isPlanId } from '@chatboat/licence';
import { html, raw } from 'hono/html';
import type { Customer } from './schema';

const fmtDate = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : '—');

const statusTone: Record<string, string> = {
  active: 'good',
  trialing: 'good',
  past_due: 'warn',
  unpaid: 'warn',
  canceled: 'danger',
  incomplete_expired: 'danger',
};

/** Same tokens as apps/web so our tools look like the product. */
const styles = raw(`
:root{--bg:#f7f7f9;--surface:#fff;--surface-2:#f1f2f5;--border:#e3e5ea;--text:#16181d;--muted:#5d6370;--brand:#4f46e5;--brand-fg:#fff;--good:#059669;--warn:#d97706;--danger:#dc2626;color-scheme:light}
@media (prefers-color-scheme:dark){:root{--bg:#0e0f13;--surface:#16181e;--surface-2:#1d2028;--border:#2a2e38;--text:#eceef3;--muted:#9aa1ae;--brand:#818cf8;--brand-fg:#0e0f13;--good:#34d399;--warn:#fbbf24;--danger:#f87171;color-scheme:dark}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:14px/1.5 ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif}
main{max-width:1200px;margin:0 auto;padding:24px 16px}h1{font-size:20px;margin:0 0 4px}p.sub{color:var(--muted);margin:0 0 20px}
.card{background:var(--surface);border:1px solid var(--border);border-radius:12px;overflow-x:auto}
table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:10px 12px;border-bottom:1px solid var(--border);vertical-align:top}
th{font-size:12px;font-weight:600;color:var(--muted);background:var(--surface-2)}tr:last-child td{border-bottom:0}
.muted{color:var(--muted);font-size:12px}.pill{display:inline-block;padding:1px 8px;border-radius:999px;font-size:12px;font-weight:600;border:1px solid currentColor}
.good{color:var(--good)}.warn{color:var(--warn)}.danger{color:var(--danger)}
button,.btn{font:inherit;font-size:12px;padding:4px 10px;border-radius:8px;border:1px solid var(--border);background:var(--surface);color:var(--text);cursor:pointer;text-decoration:none;white-space:nowrap}
button.primary{background:var(--brand);color:var(--brand-fg);border-color:var(--brand)}
input{font:inherit;font-size:12px;padding:4px 8px;border-radius:8px;border:1px solid var(--border);background:var(--bg);color:var(--text);width:180px}
form{display:inline-flex;gap:6px;margin:0}.row{display:flex;gap:6px;flex-wrap:wrap;align-items:center}
code{font-size:11px;word-break:break-all}.empty{padding:40px;text-align:center;color:var(--muted)}
`);

const script = raw(`
document.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-copy]');
  if (!btn) return;
  await navigator.clipboard.writeText(btn.dataset.copy);
  const label = btn.textContent; btn.textContent = 'Copied'; setTimeout(() => (btn.textContent = label), 1200);
});
`);

function customerRow(c: Customer) {
  const payload = c.licence ? decodeLicenceUnverified(c.licence) : null;
  const planName = isPlanId(c.plan) ? PLANS[c.plan].name : c.plan;
  return html`<tr>
    <td><strong>${c.company}</strong><div class="muted">${c.email}</div><div class="muted">${c.id}</div></td>
    <td>${planName}<div class="muted">${c.billingInterval ? `per ${c.billingInterval}` : ''}</div></td>
    <td><span class="pill ${statusTone[c.status] ?? ''}">${c.status.replace('_', ' ')}</span>
      <div class="muted">period ends ${fmtDate(c.currentPeriodEnd)}</div></td>
    <td>
      <form method="post" action="/admin/customers/${c.id}/install-url">
        <input name="installUrl" type="url" placeholder="https://data.acme.com" value="${c.installUrl ?? ''}" aria-label="Install URL" />
        <button>Save</button>
      </form>
    </td>
    <td>
      ${
        c.licence
          ? html`<div class="row">
              <button class="primary" data-copy="${c.licence}">Copy licence</button>
              <form method="post" action="/admin/customers/${c.id}/reissue"><button>Re-issue</button></form>
            </div>
            <div class="muted">expires ${fmtDate(c.licenceExpiresAt)} · issued ${fmtDate(c.licenceIssuedAt)}</div>
            ${payload ? html`<div class="muted"><code>${payload.id}</code></div>` : ''}`
          : html`<span class="muted">none yet</span>
            <form method="post" action="/admin/customers/${c.id}/reissue"><button>Issue</button></form>`
      }
    </td>
    <td>
      <form method="post" action="/admin/customers/${c.id}/portal"><button>Billing portal</button></form>
      <div class="muted"><a class="muted" href="https://dashboard.stripe.com/test/customers/${c.stripeCustomerId}" target="_blank" rel="noreferrer">${c.stripeCustomerId}</a></div>
    </td>
  </tr>`;
}

export function adminPage(customers: Customer[], flash?: string) {
  return html`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Chatboat control</title><meta name="robots" content="noindex" />
<style>${styles}</style>
</head>
<body><main>
  <h1>Customers</h1>
  <p class="sub">${customers.length} customer${customers.length === 1 ? '' : 's'} · licences are signed with our Ed25519 key${flash ? html` · <strong>${flash}</strong>` : ''}</p>
  <div class="card">
    ${
      customers.length
        ? html`<table>
            <thead><tr><th>Company</th><th>Plan</th><th>Status</th><th>Install URL</th><th>Licence</th><th>Stripe</th></tr></thead>
            <tbody>${customers.map(customerRow)}</tbody>
          </table>`
        : html`<div class="empty">No customers yet. They appear here after a Stripe checkout completes.</div>`
    }
  </div>
</main>
<script>${script}</script>
</body></html>`;
}
