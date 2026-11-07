import type { ChartSpec } from '@chatboat/shared';

export const fileName = (title: string) =>
  title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'chart';

function cellText(v: unknown) {
  return v == null ? '' : String(v);
}

export function toCsv(spec: ChartSpec) {
  const esc = (v: unknown) => {
    const s = cellText(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [spec.columns.join(','), ...spec.rows.map(r => spec.columns.map(c => esc(r[c])).join(','))].join('\n');
}

/** Tab-separated, so pasting into Excel or Google Sheets fills cells. */
export function toTsv(spec: ChartSpec) {
  const clean = (v: unknown) => cellText(v).replace(/[\t\n]/g, ' ');
  return [spec.columns.join('\t'), ...spec.rows.map(r => spec.columns.map(c => clean(r[c])).join('\t'))].join('\n');
}

export function download(name: string, href: string) {
  const a = document.createElement('a');
  a.href = href;
  a.download = name;
  a.click();
}

export function downloadCsv(spec: ChartSpec) {
  const url = URL.createObjectURL(new Blob([toCsv(spec)], { type: 'text/csv' }));
  download(`${fileName(spec.title)}.csv`, url);
  URL.revokeObjectURL(url);
}

async function captureChart(node: HTMLElement) {
  const { toPng } = await import('html-to-image');
  const bg = getComputedStyle(document.body).getPropertyValue('--surface').trim() || '#ffffff';
  return toPng(node, { backgroundColor: bg, pixelRatio: 2 });
}

export async function downloadPng(node: HTMLElement, spec: ChartSpec) {
  download(`${fileName(spec.title)}.png`, await captureChart(node));
}

/** One-page landscape PDF: title, chart image, then the takeaway and how it was calculated. */
export async function downloadPdf(node: HTMLElement, spec: ChartSpec) {
  const [{ jsPDF }, img] = await Promise.all([import('jspdf'), captureChart(node)]);
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const pageW = pdf.internal.pageSize.getWidth();
  const margin = 40;
  const width = pageW - margin * 2;

  pdf.setFontSize(16);
  pdf.text(spec.title, margin, margin + 8);
  pdf.setFontSize(9);
  pdf.setTextColor(110);
  pdf.text(`Generated ${new Date().toLocaleString()}`, margin, margin + 24);

  const { width: w, height: h } = pdf.getImageProperties(img);
  const imgH = Math.min((h / w) * width, 330);
  pdf.addImage(img, 'PNG', margin, margin + 38, (w / h) * imgH, imgH);

  let y = margin + 38 + imgH + 24;
  pdf.setTextColor(30);
  pdf.setFontSize(10);
  for (const [label, text] of [
    ['Takeaway', spec.summary],
    ['How this was calculated', spec.explanation],
  ] as const) {
    if (!text) continue;
    pdf.setFont('helvetica', 'bold');
    pdf.text(label, margin, y);
    pdf.setFont('helvetica', 'normal');
    const lines = pdf.splitTextToSize(text, width);
    pdf.text(lines, margin, y + 14);
    y += 14 + lines.length * 12 + 10;
  }
  pdf.save(`${fileName(spec.title)}.pdf`);
}
