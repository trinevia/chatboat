import { Resvg } from '@resvg/resvg-js';
import { toWide, type ChartSpec } from '@chatboat/shared';

/**
 * Renders a chart to PNG for email. Email clients don't run JavaScript or show SVG
 * reliably, so we draw a simple static SVG and rasterise it with resvg.
 */
const W = 640;
const H = 300;
const PAD = { top: 16, right: 16, bottom: 44, left: 64 };
const COLORS = ['#4f46e5', '#0ea5e9', '#f59e0b', '#10b981', '#ec4899', '#8b5cf6'];
const FONT = 'font-family="Arial, Helvetica, sans-serif"';

const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const label = (v: unknown, max = 12) => {
  const s = String(v ?? '');
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
};

function axes(maxY: number) {
  const plotH = H - PAD.top - PAD.bottom;
  let out = '';
  for (let i = 0; i <= 4; i++) {
    const y = PAD.top + plotH - (plotH * i) / 4;
    out += `<line x1="${PAD.left}" x2="${W - PAD.right}" y1="${y}" y2="${y}" stroke="#e5e7eb"/>`;
    out += `<text x="${PAD.left - 8}" y="${y + 4}" text-anchor="end" font-size="11" fill="#6b7280" ${FONT}>${compact.format((maxY * i) / 4)}</text>`;
  }
  return out;
}

function xLabels(xs: unknown[], xAt: (i: number) => number) {
  const step = Math.max(1, Math.ceil(xs.length / 8));
  return xs
    .map((x, i) =>
      i % step === 0
        ? `<text x="${xAt(i)}" y="${H - PAD.bottom + 18}" text-anchor="middle" font-size="11" fill="#6b7280" ${FONT}>${esc(label(x))}</text>`
        : ''
    )
    .join('');
}

function legend(keys: string[]) {
  if (keys.length < 2) return '';
  return keys
    .slice(0, 6)
    .map(
      (k, i) =>
        `<rect x="${PAD.left + i * 100}" y="${H - 14}" width="10" height="10" fill="${COLORS[i % COLORS.length]}"/>` +
        `<text x="${PAD.left + i * 100 + 14}" y="${H - 5}" font-size="11" fill="#374151" ${FONT}>${esc(label(k, 13))}</text>`
    )
    .join('');
}

function svgFor(spec: ChartSpec): string | null {
  const { rows, yKeys } = toWide(spec);
  if (!rows.length || spec.type === 'table' || spec.type === 'kpi') return null;
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const xs = rows.map(r => r[spec.xKey]);
  let body = '';

  if (spec.type === 'pie') {
    const y = yKeys[0];
    const total = rows.reduce((s, r) => s + Math.max(0, num(r[y])), 0) || 1;
    const cx = 160, cy = H / 2, r = 110;
    let a0 = -Math.PI / 2;
    rows.slice(0, 8).forEach((row, i) => {
      const a1 = a0 + (Math.max(0, num(row[y])) / total) * Math.PI * 2;
      const large = a1 - a0 > Math.PI ? 1 : 0;
      body += `<path d="M${cx},${cy} L${cx + r * Math.cos(a0)},${cy + r * Math.sin(a0)} A${r},${r} 0 ${large} 1 ${cx + r * Math.cos(a1)},${cy + r * Math.sin(a1)} Z" fill="${COLORS[i % COLORS.length]}" stroke="#fff" stroke-width="2"/>`;
      body += `<rect x="320" y="${40 + i * 26}" width="12" height="12" fill="${COLORS[i % COLORS.length]}"/>`;
      body += `<text x="340" y="${51 + i * 26}" font-size="13" fill="#374151" ${FONT}>${esc(label(row[spec.xKey], 22))} · ${compact.format(num(row[y]))}</text>`;
      a0 = a1;
    });
    return body;
  }

  const stacked = spec.type === 'stacked';
  const line = spec.type === 'line' || spec.type === 'multi_line';
  const maxY =
    Math.max(
      ...rows.map(r => (stacked ? yKeys.reduce((s, k) => s + Math.max(0, num(r[k])), 0) : Math.max(...yKeys.map(k => num(r[k]))))),
      1
    ) * 1.1;
  const yAt = (v: number) => PAD.top + plotH - (Math.max(0, v) / maxY) * plotH;
  body += axes(maxY);

  if (line) {
    const xAt = (i: number) => PAD.left + (rows.length === 1 ? plotW / 2 : (plotW * i) / (rows.length - 1));
    yKeys.forEach((k, s) => {
      const pts = rows.map((r, i) => `${xAt(i)},${yAt(num(r[k]))}`).join(' ');
      body += `<polyline points="${pts}" fill="none" stroke="${COLORS[s % COLORS.length]}" stroke-width="2.5"/>`;
    });
    body += xLabels(xs, xAt);
  } else {
    const band = plotW / rows.length;
    const groups = stacked ? 1 : yKeys.length;
    const barW = Math.min(48, (band * 0.7) / groups);
    const xAt = (i: number) => PAD.left + band * i + band / 2;
    rows.forEach((r, i) => {
      let base = 0;
      yKeys.forEach((k, s) => {
        const v = Math.max(0, num(r[k]));
        const x = stacked ? xAt(i) - barW / 2 : xAt(i) - (barW * groups) / 2 + s * barW;
        const top = yAt(stacked ? base + v : v);
        const bottom = yAt(stacked ? base : 0);
        body += `<rect x="${x}" y="${top}" width="${barW - (stacked ? 0 : 2)}" height="${Math.max(0, bottom - top)}" fill="${COLORS[s % COLORS.length]}"/>`;
        base += v;
      });
    });
    body += xLabels(xs, xAt);
  }
  return body + legend(yKeys);
}

export function renderChartPng(spec: ChartSpec): Buffer | null {
  const body = svgFor(spec);
  if (!body) return null;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="#ffffff"/>${body}</svg>`;
  return new Resvg(svg, {
    fitTo: { mode: 'width', value: W * 2 },
    font: { loadSystemFonts: true, defaultFontFamily: 'Arial' },
  })
    .render()
    .asPng();
}
