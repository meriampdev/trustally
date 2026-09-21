export interface ExportColumn<T> { label: string; value: (row: T) => unknown }

export function exportCsv<T>(title: string, filename: string, rows: T[], columns: ExportColumn<T>[], totals?: Array<[string, unknown]>) {
  downloadBlob(new Blob([buildCsv(title, rows, columns, totals)], { type: "text/csv;charset=utf-8" }), filename);
}

export function printReport<T>(title: string, rows: T[], columns: ExportColumn<T>[], totals?: Array<[string, unknown]>) {
  const popup = window.open("", "_blank", "noopener,noreferrer");
  if (!popup) throw new Error("Allow pop-ups to open the printable report.");
  const totalHtml = totals?.map(([label, value]) => `<div><strong>${escapeHtml(label)}:</strong> ${escapeHtml(formatExportValue(value))}</div>`).join("") ?? "";
  const header = columns.map((column) => `<th>${escapeHtml(column.label)}</th>`).join("");
  const body = rows.map((row) => `<tr>${columns.map((column) => `<td>${escapeHtml(formatExportValue(column.value(row)))}</td>`).join("")}</tr>`).join("");
  popup.document.write(`<!doctype html><html><head><title>${escapeHtml(title)}</title><style>body{font:13px system-ui;margin:32px;color:#172133}h1{margin:0 0 4px}p{color:#526071}table{border-collapse:collapse;width:100%;margin-top:20px}th,td{border:1px solid #ccd3dc;padding:8px;text-align:left;vertical-align:top}th{background:#edf3f7}@media print{body{margin:12mm}}</style></head><body><h1>${escapeHtml(title)}</h1><p>Exported ${escapeHtml(new Date().toLocaleString("en-PH"))}</p>${totalHtml}<table><thead><tr>${header}</tr></thead><tbody>${body}</tbody></table><script>window.onload=()=>window.print()<\/script></body></html>`);
  popup.document.close();
}

export function exportZip(filename: string, files: Array<{ name: string; content: string }>) {
  const encoder = new TextEncoder(); const localParts: Uint8Array[] = []; const centralParts: Uint8Array[] = []; let offset = 0;
  files.forEach((file) => {
    const name = encoder.encode(file.name), data = encoder.encode(file.content), crc = crc32(data);
    const local = new Uint8Array(30 + name.length + data.length), localView = new DataView(local.buffer);
    localView.setUint32(0, 0x04034b50, true); localView.setUint16(4, 20, true); localView.setUint16(6, 0, true); localView.setUint16(8, 0, true);
    localView.setUint16(10, 0, true); localView.setUint16(12, 0, true); localView.setUint32(14, crc, true); localView.setUint32(18, data.length, true);
    localView.setUint32(22, data.length, true); localView.setUint16(26, name.length, true); localView.setUint16(28, 0, true);
    local.set(name, 30); local.set(data, 30 + name.length); localParts.push(local);
    const central = new Uint8Array(46 + name.length), centralView = new DataView(central.buffer);
    centralView.setUint32(0, 0x02014b50, true); centralView.setUint16(4, 20, true); centralView.setUint16(6, 20, true); centralView.setUint16(8, 0, true);
    centralView.setUint16(10, 0, true); centralView.setUint16(12, 0, true); centralView.setUint16(14, 0, true); centralView.setUint32(16, crc, true);
    centralView.setUint32(20, data.length, true); centralView.setUint32(24, data.length, true); centralView.setUint16(28, name.length, true);
    centralView.setUint16(30, 0, true); centralView.setUint16(32, 0, true); centralView.setUint16(34, 0, true); centralView.setUint16(36, 0, true);
    centralView.setUint32(38, 0, true); centralView.setUint32(42, offset, true); central.set(name, 46); centralParts.push(central); offset += local.length;
  });
  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0), end = new Uint8Array(22), endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true); endView.setUint16(4, 0, true); endView.setUint16(6, 0, true); endView.setUint16(8, files.length, true);
  endView.setUint16(10, files.length, true); endView.setUint32(12, centralSize, true); endView.setUint32(16, offset, true); endView.setUint16(20, 0, true);
  const blobParts: BlobPart[] = [...localParts, ...centralParts, end].map((part) => part.slice().buffer as ArrayBuffer);
  downloadBlob(new Blob(blobParts, { type: "application/zip" }), filename);
}

export function buildCsv<T>(title: string, rows: T[], columns: ExportColumn<T>[], totals?: Array<[string, unknown]>) {
  const lines = [[title], [`Exported ${new Date().toLocaleString("en-PH")}`], []];
  totals?.forEach(([label, value]) => lines.push([label, formatExportValue(value)]));
  if (totals?.length) lines.push([]);
  lines.push(columns.map((column) => column.label));
  rows.forEach((row) => lines.push(columns.map((column) => formatExportValue(column.value(row)))));
  return `\ufeff${lines.map((line) => line.map(csvCell).join(",")).join("\r\n")}`;
}

function formatExportValue(value: unknown) { if (value == null) return "Missing cost data"; if (typeof value === "boolean") return value ? "Yes" : "No"; return String(value); }
function csvCell(value: string) { return `"${value.replace(/"/g, '""')}"`; }
function escapeHtml(value: string) { return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ?? character); }
function downloadBlob(blob: Blob, filename: string) { const url = URL.createObjectURL(blob), anchor = document.createElement("a"); anchor.href = url; anchor.download = filename; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
function crc32(bytes: Uint8Array) { let crc = 0xffffffff; for (const byte of bytes) { crc ^= byte; for (let index = 0; index < 8; index += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1)); } return (crc ^ 0xffffffff) >>> 0; }
