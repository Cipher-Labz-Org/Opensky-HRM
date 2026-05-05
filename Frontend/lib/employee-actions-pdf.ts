/**
 * PDF export for Employee Actions (jsPDF + autotable).
 * Appends an ASCII backup block so the same file can be re-imported on this page.
 */

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

/** Must stay in sync with markers used when parsing. */
const BACKUP_START = "\n%OpenSky-Employee-Actions-Backup-v1%\n";
const BACKUP_END = "\n%End-OpenSky-Backup-v1%\n";

function indexOfBytes(haystack: Uint8Array, needle: Uint8Array): number {
  if (needle.length === 0) return 0;
  for (let i = 0; i <= haystack.length - needle.length; i++) {
    let match = true;
    for (let j = 0; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) {
        match = false;
        break;
      }
    }
    if (match) return i;
  }
  return -1;
}

function utf8ToBase64(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    const sub = bytes.subarray(i, i + chunk);
    bin += String.fromCharCode.apply(null, sub as unknown as number[]);
  }
  return btoa(bin);
}

function base64ToUtf8(b64: string): string {
  const bin = atob(b64.trim());
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(out);
}

export type EmployeeActionPdfRecord = {
  id: string;
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  actionType: string;
  effectiveDate: string;
  title: string;
  details: string;
  createdAt: string;
  createdByUsername: string | null;
};

export async function buildEmployeeActionsPdfBlob(records: ReadonlyArray<EmployeeActionPdfRecord>): Promise<Blob> {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  doc.setProperties({
    title: "Employee Actions",
    subject: "OpenSky HRM — Employee actions",
    keywords: "OpenSky,HRM,Employee Actions",
    creator: "OpenSky HRM",
  });

  doc.setFontSize(16);
  doc.text("Employee Actions", 14, 14);
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  doc.text(`Generated ${new Date().toLocaleString()} · ${records.length} record(s)`, 14, 20);
  doc.setTextColor(0, 0, 0);

  autoTable(doc, {
    startY: 24,
    head: [["Effective", "Employee", "Code", "Type", "Title", "Details", "Logged"]],
    body: records.map((r) => [
      r.effectiveDate.split("T")[0] ?? r.effectiveDate,
      r.employeeName,
      r.employeeCode,
      r.actionType,
      r.title,
      (r.details || "").replace(/\s+/g, " ").slice(0, 240),
      `${(r.createdAt || "").split("T")[0] ?? ""}${r.createdByUsername ? ` @${r.createdByUsername}` : ""}`,
    ]),
    styles: { fontSize: 7, cellPadding: 1.2, overflow: "linebreak" },
    headStyles: { fillColor: [43, 125, 233], textColor: 255 },
    columnStyles: {
      1: { cellWidth: 32 },
      4: { cellWidth: 36 },
      5: { cellWidth: 62 },
    },
    margin: { left: 14, right: 14 },
    horizontalPageBreak: true,
    showHead: "everyPage",
  });

  type DocWithTable = jsPDF & { lastAutoTable?: { finalY: number } };
  const tableEndY = (doc as DocWithTable).lastAutoTable?.finalY;
  if (typeof tableEndY === "number") {
    doc.setFontSize(7);
    doc.setTextColor(120, 120, 120);
    doc.text(
      "Tip: Use Import PDF on this page to restore records from a file exported here (includes a hidden backup block).",
      14,
      Math.min(tableEndY + 8, doc.internal.pageSize.getHeight() - 10)
    );
  }

  const buf = doc.output("arraybuffer") as ArrayBuffer;
  const json = JSON.stringify(records);
  const b64 = utf8ToBase64(json);
  const enc = new TextEncoder();
  const start = enc.encode(BACKUP_START);
  const mid = enc.encode(b64);
  const end = enc.encode(BACKUP_END);
  const out = new Uint8Array(buf.byteLength + start.length + mid.length + end.length);
  out.set(new Uint8Array(buf), 0);
  let o = buf.byteLength;
  out.set(start, o);
  o += start.length;
  out.set(mid, o);
  o += mid.length;
  out.set(end, o);
  return new Blob([out], { type: "application/pdf" });
}

/**
 * Reads the backup block appended by {@link buildEmployeeActionsPdfBlob}.
 * Returns `null` if this is not an OpenSky export (or backup was stripped).
 */
export function extractRecordsArrayFromEmployeeActionsPdf(buf: ArrayBuffer): unknown[] | null {
  const bytes = new Uint8Array(buf);
  const startEnc = new TextEncoder().encode(BACKUP_START);
  const endEnc = new TextEncoder().encode(BACKUP_END);

  const startIdx = indexOfBytes(bytes, startEnc);
  if (startIdx === -1) return null;

  const afterStart = startIdx + startEnc.length;
  const tail = bytes.subarray(afterStart);
  const endRel = indexOfBytes(tail, endEnc);
  if (endRel === -1) return null;

  const b64Ascii = new TextDecoder("utf-8").decode(tail.subarray(0, endRel));
  let json: string;
  try {
    json = base64ToUtf8(b64Ascii);
  } catch {
    return null;
  }
  try {
    const data = JSON.parse(json) as unknown;
    return Array.isArray(data) ? data : null;
  } catch {
    return null;
  }
}
