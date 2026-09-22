import { apiFetch } from "@/lib/api";

export interface AttendanceImportRowResult {
  row: number;
  employeeCode: string;
  date: string | null;
  status: string;
  errors: string[];
}

export interface AttendanceImportUploadResult {
  created: number;
  updated: number;
  skipped: number;
  totalRows: number;
  results: AttendanceImportRowResult[];
}

const STATUSES = ["Present", "Absent", "Late", "Half Day", "On Leave"] as const;

const COLUMN_ALIASES: Record<string, string[]> = {
  "Employee Code": [
    "Employee Code", "Emp Code", "EmployeeCode", "Employee ID", "Employee No", "Emp No",
    "Employee Number", "Emp Number", "Code", "EmpCode", "PIN", "Enroll Number", "Enroll No",
    "User ID", "AC-No", "AC No", "Badge", "Badge ID",
  ],
  Date: ["Date", "Attendance Date", "Work Date", "Att Date", "Day", "Punch Date", "Workday"],
  "Punch In": [
    "Punch In", "PunchIn", "In Time", "Time In", "Check In", "CheckIn", "In",
    "Punch In Time", "Start Time", "Start", "Clock In", "ClockIn", "First In",
  ],
  "Punch Out": [
    "Punch Out", "PunchOut", "Out Time", "Time Out", "Check Out", "CheckOut", "Out",
    "Punch Out Time", "End Time", "End", "Clock Out", "ClockOut", "Last Out",
  ],
  Status: ["Status", "Attendance Status", "Type", "Attendance Type", "Attendance"],
  Remarks: ["Remarks", "Notes", "Comment", "Comments", "Note"],
};

type SheetCell = string | number | boolean | Date | null | undefined;
type SheetGrid = SheetCell[][];

interface EmployeeRow {
  id: string;
  employeeCode?: string | null;
  fingerprintId?: string | null;
}

interface AttendanceRow {
  id: string;
  employeeId: string;
  date: string;
}

export function buildAttendanceImportTemplateCsv(): Blob {
  const header = "Employee Code,Date,Punch In,Punch Out,Status,Remarks";
  const sample = "EMP-0001,2026-07-01,08:30,17:30,Present,";
  return new Blob([`${header}\n${sample}\n`], { type: "text/csv;charset=utf-8" });
}

export async function importAttendanceFromWorkbook(
  file: File,
  onProgress?: (done: number, total: number) => void,
): Promise<AttendanceImportUploadResult> {
  const grid = await readWorkbookGrid(file);
  const layout = findLayout(grid);
  if (!layout) {
    throw new Error(
      "Could not find attendance data. Include Employee Code and Date column headers (optional: Punch In, Punch Out, Status, Remarks).",
    );
  }

  const parsed = parseRows(grid, layout);
  if (parsed.length === 0) {
    return { created: 0, updated: 0, skipped: 0, totalRows: 0, results: [] };
  }

  const employees = await loadAllEmployees();
  const employeeLookup = buildEmployeeLookup(employees);
  const dates = parsed
    .map((row) => row.date)
    .filter((d): d is Date => d != null)
    .sort((a, b) => a.getTime() - b.getTime());
  const existing = dates.length
    ? await loadAttendanceByRange(dates[0], dates[dates.length - 1])
    : new Map<string, string>();

  const results: AttendanceImportRowResult[] = [];
  let created = 0;
  let updated = 0;
  let skipped = 0;

  const work = parsed.map((row, index) => async () => {
    const errors: string[] = [];
    if (!row.employeeCode) errors.push("Employee code is required.");
    if (!row.date) errors.push("Date is required or invalid.");

    const employee = row.employeeCode ? resolveEmployee(employeeLookup, row.employeeCode) : undefined;
    if (row.employeeCode && !employee) errors.push("Employee not found.");

    const status = normalizeStatus(row.status);
    if (status == null) {
      errors.push(`Invalid status '${row.status}'. Use: ${STATUSES.join(", ")}.`);
    }

    let punchIn = row.date ? parseDateTime(row.date, row.punchIn) : null;
    let punchOut = row.date ? parseDateTime(row.date, row.punchOut) : null;
    // Overnight / next-day clock-out (same Date column as shift start).
    if (punchIn && punchOut && punchOut.getTime() < punchIn.getTime()) {
      punchOut = new Date(
        punchOut.getFullYear(),
        punchOut.getMonth(),
        punchOut.getDate() + 1,
        punchOut.getHours(),
        punchOut.getMinutes(),
        punchOut.getSeconds()
      );
    }
    if (punchIn && punchOut && punchOut.getTime() <= punchIn.getTime()) {
      errors.push("Punch Out must be after Punch In.");
    }

    if (errors.length > 0 || !employee || !row.date || !status) {
      skipped += 1;
      results[index] = {
        row: row.excelRow,
        employeeCode: row.employeeCode,
        date: row.date ? toIsoDate(row.date) : null,
        status: "Skipped",
        errors,
      };
      return;
    }

    const dateIso = toIsoDate(row.date);
    const key = `${employee.id}|${dateIso}`;
    const existingId = existing.get(key);
    try {
      if (existingId) {
        await apiFetch(`/api/attendance/${existingId}`, {
          method: "PUT",
          body: JSON.stringify({
            ...(punchIn ? { punchIn: toLocalIso(punchIn) } : {}),
            ...(punchOut ? { punchOut: toLocalIso(punchOut) } : {}),
            status,
            remarks: row.remarks || null,
          }),
        });
        updated += 1;
        results[index] = {
          row: row.excelRow,
          employeeCode: row.employeeCode,
          date: dateIso,
          status: "Updated",
          errors: [],
        };
      } else {
        await apiFetch("/api/attendance", {
          method: "POST",
          body: JSON.stringify({
            employeeId: employee.id,
            date: `${dateIso}T00:00:00`,
            punchIn: punchIn ? toLocalIso(punchIn) : null,
            punchOut: punchOut ? toLocalIso(punchOut) : null,
            status,
            remarks: row.remarks || null,
            source: "Import",
          }),
        });
        existing.set(key, "new");
        created += 1;
        results[index] = {
          row: row.excelRow,
          employeeCode: row.employeeCode,
          date: dateIso,
          status: "Created",
          errors: [],
        };
      }
    } catch (err) {
      skipped += 1;
      results[index] = {
        row: row.excelRow,
        employeeCode: row.employeeCode,
        date: dateIso,
        status: "Skipped",
        errors: [err instanceof Error ? err.message : "Could not save this row."],
      };
    }
  });

  await runPool(work, 6, onProgress);
  return { created, updated, skipped, totalRows: parsed.length, results };
}

async function readWorkbookGrid(file: File): Promise<SheetGrid> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".csv") || name.endsWith(".txt")) {
    return parseDelimitedText(await file.text());
  }

  const XLSX = await import("xlsx");
  const wb = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true, raw: false });
  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName];
    if (!sheet) continue;
    const rows = XLSX.utils.sheet_to_json<SheetCell[]>(sheet, {
      header: 1,
      raw: false,
      defval: "",
      blankrows: false,
    });
    if (rows.length > 0) return rows;
  }
  return [];
}

function parseDelimitedText(raw: string): SheetGrid {
  const lines = raw.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n")
    .split("\n")
    .filter((line) => line.trim().length > 0);
  if (lines.length === 0) return [];
  const delimiter = detectDelimiter(lines[0]);
  return lines.map((line) => splitDelimitedLine(line, delimiter));
}

function detectDelimiter(headerLine: string): string {
  const comma = (headerLine.match(/,/g) ?? []).length;
  const tab = (headerLine.match(/\t/g) ?? []).length;
  const semi = (headerLine.match(/;/g) ?? []).length;
  if (tab >= comma && tab >= semi && tab > 0) return "\t";
  if (semi >= comma && semi > 0) return ";";
  return ",";
}

function splitDelimitedLine(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      cells.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  cells.push(current.trim());
  return cells;
}

function findLayout(grid: SheetGrid): { headerRow: number; columns: Record<string, number> } | null {
  const scanTo = Math.min(grid.length, 20);
  for (let r = 0; r < scanTo; r++) {
    const headerMap = buildHeaderMap(grid[r] ?? []);
    const empCol = resolveColumn(headerMap, "Employee Code");
    const dateCol = resolveColumn(headerMap, "Date");
    if (empCol != null && dateCol != null) {
      return {
        headerRow: r,
        columns: {
          employeeCode: empCol,
          date: dateCol,
          punchIn: resolveColumn(headerMap, "Punch In") ?? -1,
          punchOut: resolveColumn(headerMap, "Punch Out") ?? -1,
          status: resolveColumn(headerMap, "Status") ?? -1,
          remarks: resolveColumn(headerMap, "Remarks") ?? -1,
        },
      };
    }
  }
  return null;
}

function buildHeaderMap(row: SheetCell[]): Map<string, number> {
  const map = new Map<string, number>();
  row.forEach((cell, index) => {
    const key = normalizeHeader(cell);
    if (key) map.set(key, index);
  });
  return map;
}

function resolveColumn(headerMap: Map<string, number>, logicalName: string): number | null {
  const aliases = COLUMN_ALIASES[logicalName] ?? [];
  for (const alias of aliases) {
    const key = normalizeHeader(alias);
    if (headerMap.has(key)) return headerMap.get(key)!;
  }
  for (const [key, col] of headerMap.entries()) {
    for (const alias of aliases) {
      const normalizedAlias = normalizeHeader(alias);
      if (normalizedAlias.length < 4) continue;
      if (key.includes(normalizedAlias) || normalizedAlias.includes(key)) return col;
    }
  }
  return null;
}

function parseRows(grid: SheetGrid, layout: { headerRow: number; columns: Record<string, number> }) {
  const rows: {
    excelRow: number;
    employeeCode: string;
    date: Date | null;
    punchIn: string;
    punchOut: string;
    status: string;
    remarks: string;
  }[] = [];

  for (let r = layout.headerRow + 1; r < grid.length; r++) {
    const row = grid[r] ?? [];
    const employeeCode = cellText(row[layout.columns.employeeCode]);
    const date = parseDateCell(row[layout.columns.date]);
    const punchIn = cellText(row[layout.columns.punchIn]);
    const punchOut = cellText(row[layout.columns.punchOut]);
    const status = cellText(row[layout.columns.status]);
    const remarks = cellText(row[layout.columns.remarks]);
    if (!employeeCode && !date && !punchIn && !punchOut && !status && !remarks) continue;
    rows.push({
      excelRow: r + 1,
      employeeCode,
      date,
      punchIn,
      punchOut,
      status,
      remarks,
    });
  }
  return rows;
}

function normalizeHeader(raw: SheetCell): string {
  return String(raw ?? "")
    .replace(/\uFEFF/g, "")
    .replace(/\u00A0/g, " ")
    .replace(/\u200B/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function cellText(value: SheetCell): string {
  if (value == null || value === "") return "";
  if (value instanceof Date) {
    const hh = String(value.getHours()).padStart(2, "0");
    const mm = String(value.getMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
  }
  return String(value).trim();
}

function parseDateCell(value: SheetCell): Date | null {
  if (value == null || value === "") return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return startOfDay(value);
  if (typeof value === "number" && value >= 1 && value < 2958466) {
    const utc = new Date(Math.round((value - 25569) * 86400 * 1000));
    return new Date(utc.getUTCFullYear(), utc.getUTCMonth(), utc.getUTCDate());
  }
  const text = String(value).trim();
  if (!text) return null;
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(text);
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  const dmy = /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/.exec(text);
  if (dmy) {
    const rawYear = Number(dmy[3]);
    const year = dmy[3].length === 2 ? (rawYear >= 70 ? 1900 + rawYear : 2000 + rawYear) : rawYear;
    const first = Number(dmy[1]);
    const second = Number(dmy[2]);
    const monthFirst = first <= 12 && second > 12;
    const day = monthFirst ? second : first;
    const month = monthFirst ? first : second;
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return new Date(year, month - 1, day);
    }
  }
  return null;
}

function parseDateTime(date: Date, raw: string): Date | null {
  if (!raw) return null;
  const s = raw.trim();

  const timeMatch = /(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?\s*$/i.exec(s);
  if (timeMatch) {
    let hours = Number(timeMatch[1]);
    const minutes = Number(timeMatch[2]);
    const ampm = timeMatch[4]?.toLowerCase();
    if (ampm === "pm" && hours < 12) hours += 12;
    if (ampm === "am" && hours === 12) hours = 0;
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), hours, minutes, Number(timeMatch[3] || 0));
  }

  const fraction = Number(s);
  if (Number.isFinite(fraction) && fraction >= 0 && fraction < 1) {
    const totalSeconds = Math.round(fraction * 24 * 60 * 60);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), hours, minutes, seconds);
  }

  return null;
}

function normalizeStatus(raw: string): string | null {
  if (!raw.trim()) return "Present";
  return STATUSES.find((s) => s.toLowerCase() === raw.trim().toLowerCase()) ?? null;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function toLocalIso(d: Date): string {
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${toIsoDate(d)}T${hh}:${mm}:${ss}`;
}

function employeeAliases(code: string | null | undefined): string[] {
  const trimmed = code?.trim();
  if (!trimmed) return [];
  const aliases = new Set<string>([trimmed.toLowerCase()]);
  const dash = trimmed.lastIndexOf("-");
  if (dash >= 0 && dash < trimmed.length - 1) {
    const suffix = trimmed.slice(dash + 1).trim();
    if (suffix) {
      aliases.add(suffix.toLowerCase());
      aliases.add(suffix.replace(/^0+/, "").toLowerCase());
    }
  }
  const digits = trimmed.replace(/\D/g, "");
  if (digits) {
    aliases.add(digits);
    aliases.add(digits.replace(/^0+/, ""));
  }
  return [...aliases].filter(Boolean);
}

function buildEmployeeLookup(employees: EmployeeRow[]): { codeMap: Map<string, EmployeeRow>; fingerprintMap: Map<string, EmployeeRow> } {
  const codeMap = new Map<string, EmployeeRow>();
  const fingerprintMap = new Map<string, EmployeeRow>();
  const codeKeys = new Set<string>();
  for (const employee of employees) {
    for (const alias of employeeAliases(employee.employeeCode)) {
      codeKeys.add(alias);
      if (!codeMap.has(alias)) codeMap.set(alias, employee);
    }
  }
  for (const employee of employees) {
    for (const alias of employeeAliases(employee.fingerprintId)) {
      if (codeKeys.has(alias)) continue;
      if (!fingerprintMap.has(alias)) fingerprintMap.set(alias, employee);
    }
  }
  return { codeMap, fingerprintMap };
}

function resolveEmployee(
  lookup: { codeMap: Map<string, EmployeeRow>; fingerprintMap: Map<string, EmployeeRow> },
  code: string,
): EmployeeRow | undefined {
  const key = code.trim();
  if (!key) return undefined;
  const keys = [key.toLowerCase(), ...employeeAliases(key)];
  const trimmedZeros = key.replace(/^0+/, "").toLowerCase();
  if (trimmedZeros) keys.push(trimmedZeros);
  for (const alias of keys) {
    const hit = lookup.codeMap.get(alias);
    if (hit) return hit;
  }
  for (const alias of keys) {
    const hit = lookup.fingerprintMap.get(alias);
    if (hit) return hit;
  }
  return undefined;
}

async function loadAllEmployees(): Promise<EmployeeRow[]> {
  const items: EmployeeRow[] = [];
  let page = 1;
  let total = Number.POSITIVE_INFINITY;
  while (items.length < total && page <= 50) {
    const res = await apiFetch<{ items?: EmployeeRow[]; totalCount?: number }>(
      `/api/employees?page=${page}&pageSize=200&excludeTerminated=true`,
    );
    const batch = res.items ?? [];
    items.push(...batch);
    total = res.totalCount ?? items.length;
    if (batch.length === 0) break;
    page += 1;
  }
  return items;
}

async function loadAttendanceByRange(from: Date, to: Date): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  let page = 1;
  let total = Number.POSITIVE_INFINITY;
  const fromIso = toIsoDate(from);
  const toIso = toIsoDate(to);
  while (map.size < total && page <= 200) {
    const res = await apiFetch<{ items?: AttendanceRow[]; totalCount?: number }>(
      `/api/attendance?page=${page}&pageSize=100&from=${fromIso}&to=${toIso}`,
    );
    const batch = res.items ?? [];
    for (const row of batch) {
      const date = (row.date ?? "").slice(0, 10);
      if (row.id && row.employeeId && date) map.set(`${row.employeeId}|${date}`, row.id);
    }
    total = res.totalCount ?? map.size;
    if (batch.length === 0) break;
    page += 1;
  }
  return map;
}

async function runPool(
  tasks: Array<() => Promise<void>>,
  concurrency: number,
  onProgress?: (done: number, total: number) => void,
): Promise<void> {
  let next = 0;
  let done = 0;
  const workers = Array.from({ length: Math.min(concurrency, tasks.length) }, async () => {
    while (next < tasks.length) {
      const current = next;
      next += 1;
      await tasks[current]();
      done += 1;
      onProgress?.(done, tasks.length);
    }
  });
  await Promise.all(workers);
}
