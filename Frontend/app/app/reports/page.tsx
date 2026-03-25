"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { AppTopbar } from "@/components/navigation/AppTopbar";
import { apiFetch } from "@/lib/api";
import { API_BASE_URL } from "@/config/constants";

interface ReportItem { key: string; name: string; description: string; }
interface ReportCategory { key: string; name: string; icon: string; reports: ReportItem[]; }
interface ReportResult { reportName: string; generatedAt: string; columns: string[]; rows: Record<string, unknown>[]; totalRows: number; }

const ICONS: Record<string, string> = {
  users: "M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z",
  calendar: "M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5",
  clock: "M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z",
  banknotes: "M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z",
  briefcase: "M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0M12 12.75h.008v.008H12v-.008z",
  "chart-bar": "M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z",
  building: "M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21",
  shield: "M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z",
};

const CATEGORY_COLORS: Record<string, string> = {
  people: "bg-blue-500", leave: "bg-emerald-500", attendance: "bg-amber-500", payroll: "bg-violet-500",
  recruitment: "bg-pink-500", performance: "bg-orange-500", organization: "bg-cyan-500", compliance: "bg-red-500",
};

function exportToExcel(result: ReportResult) {
  const BOM = "\uFEFF";
  const header = result.columns.join("\t");
  const body = result.rows.map(row =>
    result.columns.map(c => {
      const v = row[c];
      if (v === null || v === undefined) return "";
      return String(v).replace(/\t/g, " ").replace(/\n/g, " ");
    }).join("\t")
  ).join("\n");
  const tsv = BOM + header + "\n" + body;
  const blob = new Blob([tsv], { type: "application/vnd.ms-excel;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${result.reportName.replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.xls`;
  a.click();
  URL.revokeObjectURL(url);
}

function printReport(result: ReportResult, sortedRows: Record<string, unknown>[]) {
  const printWin = window.open("", "_blank", "width=1100,height=800");
  if (!printWin) return;

  const headerHtml = result.columns.map(c => `<th style="border:1px solid #ccc;padding:4px 8px;background:#f1f5f9;font-size:10px;text-transform:uppercase;text-align:left;white-space:nowrap">${c}</th>`).join("");
  const rowsHtml = sortedRows.map((row, i) =>
    `<tr style="background:${i % 2 === 0 ? "#fff" : "#f8fafc"}">` +
    `<td style="border:1px solid #e2e8f0;padding:3px 6px;font-size:11px;color:#94a3b8;text-align:center">${i + 1}</td>` +
    result.columns.map(c => {
      const v = row[c];
      return `<td style="border:1px solid #e2e8f0;padding:3px 8px;font-size:11px;white-space:nowrap">${v ?? ""}</td>`;
    }).join("") + "</tr>"
  ).join("");

  printWin.document.write(`<!DOCTYPE html><html><head><title>${result.reportName}</title></head><body style="font-family:Arial,sans-serif;margin:20px">
    <h2 style="margin:0 0 4px;font-size:16px">${result.reportName}</h2>
    <p style="margin:0 0 12px;font-size:11px;color:#64748b">Generated: ${new Date(result.generatedAt).toLocaleString()} &bull; ${sortedRows.length} records</p>
    <table style="border-collapse:collapse;width:100%">
      <thead><tr><th style="border:1px solid #ccc;padding:4px 6px;background:#f1f5f9;font-size:10px;width:30px">#</th>${headerHtml}</tr></thead>
      <tbody>${rowsHtml}</tbody>
    </table>
    <p style="margin-top:16px;font-size:9px;color:#94a3b8;text-align:right">OpenSky HRM &bull; Printed ${new Date().toLocaleString()}</p>
  </body></html>`);
  printWin.document.close();
  printWin.focus();
  setTimeout(() => { printWin.print(); }, 400);
}

export default function ReportsPage() {
  const searchParams = useSearchParams();
  const [catalog, setCatalog] = useState<ReportCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [selectedReport, setSelectedReport] = useState<string>("");
  const [result, setResult] = useState<ReportResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortAsc, setSortAsc] = useState(true);
  const deepLinkConsumed = useRef<string | null>(null);

  useEffect(() => {
    apiFetch<ReportCategory[]>("/api/reports/catalog").then((cats) => {
      setCatalog(cats);
      if (cats.length > 0) setSelectedCategory(cats[0].key);
    }).catch(() => {});
  }, []);

  const runReport = useCallback(async (catKey: string, rptKey: string) => {
    setSelectedCategory(catKey);
    setSelectedReport(rptKey);
    setResult(null);
    setLoading(true);
    setSortCol(null);
    setSearchTerm("");
    try {
      const data = await apiFetch<ReportResult>(`/api/reports/${catKey}/${rptKey}`);
      setResult(data);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    const cat = searchParams.get("category");
    const rpt = searchParams.get("report");
    if (!cat || !rpt || catalog.length === 0) return;
    const catObj = catalog.find((c) => c.key === cat);
    if (!catObj?.reports.some((r) => r.key === rpt)) return;
    const sig = `${cat}:${rpt}`;
    if (deepLinkConsumed.current === sig) return;
    deepLinkConsumed.current = sig;
    void runReport(cat, rpt);
  }, [searchParams, catalog, runReport]);

  const handleSort = (col: string) => {
    if (sortCol === col) setSortAsc(!sortAsc);
    else { setSortCol(col); setSortAsc(true); }
  };

  const closeReport = () => { setResult(null); setSelectedReport(""); setLoading(false); };

  const activeCat = catalog.find(c => c.key === selectedCategory);

  const filteredRows = result?.rows?.filter(row => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return result.columns.some(col => String(row[col] ?? "").toLowerCase().includes(term));
  }) ?? [];

  const sortedRows = sortCol
    ? [...filteredRows].sort((a, b) => {
        const va = a[sortCol] ?? "";
        const vb = b[sortCol] ?? "";
        const na = Number(va), nb = Number(vb);
        if (!isNaN(na) && !isNaN(nb)) return sortAsc ? na - nb : nb - na;
        return sortAsc ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
      })
    : filteredRows;

  return (
    <>
      <AppTopbar title="Reports" subtitle="Generate, view, and export standard HR reports across all modules." />

      <div className="flex gap-6" style={{ minHeight: "calc(100vh - 160px)" }}>
        {/* Left sidebar */}
        <div className="w-72 shrink-0">
          <div className="sticky top-4 space-y-1">
            {catalog.map(cat => {
              const isActive = selectedCategory === cat.key;
              return (
                <button
                  key={cat.key}
                  onClick={() => { setSelectedCategory(cat.key); setSelectedReport(""); setResult(null); }}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition ${
                    isActive ? "bg-blue-50 text-blue-700 shadow-sm" : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${CATEGORY_COLORS[cat.key] ?? "bg-slate-500"} text-white`}>
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d={ICONS[cat.icon] ?? ICONS.users} />
                    </svg>
                  </span>
                  <div className="min-w-0">
                    <div className="truncate">{cat.name}</div>
                    <div className="text-[10px] text-slate-400 font-normal">{cat.reports.length} report{cat.reports.length !== 1 ? "s" : ""}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Main content - report cards */}
        <div className="min-w-0 flex-1">
          {activeCat && (
            <div>
              <h3 className="mb-4 text-lg font-semibold text-slate-800">{activeCat.name} Reports</h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {activeCat.reports.map(rpt => (
                  <button
                    key={rpt.key}
                    onClick={() => runReport(activeCat.key, rpt.key)}
                    className="group rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-blue-300 hover:shadow-md"
                  >
                    <div className="flex items-start gap-3">
                      <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${CATEGORY_COLORS[activeCat.key] ?? "bg-slate-500"} bg-opacity-10`}>
                        <svg className={`h-4.5 w-4.5 ${CATEGORY_COLORS[activeCat.key]?.replace("bg-", "text-") ?? "text-slate-500"}`} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                        </svg>
                      </span>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-slate-700 group-hover:text-blue-600 transition">{rpt.name}</div>
                        <div className="mt-1 text-xs text-slate-400 leading-relaxed">{rpt.description}</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Full-screen report overlay (respects sidebar) */}
      {(result || loading) && (
        <div className="fixed top-0 right-0 bottom-0 z-50 flex flex-col bg-white" style={{ left: 280 }}>
          {/* Top bar */}
          <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-3">
            <div className="flex items-center gap-4">
              <button
                onClick={closeReport}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm transition hover:bg-slate-50"
              >
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
                Back
              </button>
              {result && (
                <>
                  <h2 className="text-base font-semibold text-slate-800">{result.reportName}</h2>
                  <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-500">{result.totalRows} record{result.totalRows !== 1 ? "s" : ""}</span>
                </>
              )}
            </div>
            {result && (
              <div className="flex items-center gap-2">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search results..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-3 text-xs text-slate-700 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 w-56"
                  />
                  <svg className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                </div>
                <button
                  onClick={() => exportToExcel(result)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm transition hover:bg-slate-50"
                >
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
                  Export Excel
                </button>
                <button
                  onClick={() => printReport(result, sortedRows)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm transition hover:bg-slate-50"
                >
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5zm-3 0h.008v.008H15V10.5z" /></svg>
                  Print
                </button>
                <button
                  onClick={closeReport}
                  className="ml-2 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                  title="Close"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            )}
          </div>

          {/* Loading state inside overlay */}
          {loading && (
            <div className="flex flex-1 items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
              <span className="ml-3 text-sm text-slate-500">Generating report...</span>
            </div>
          )}

          {/* Table body */}
          {result && !loading && (
            <div className="flex-1 overflow-auto px-6 py-4">
              {sortedRows.length === 0 ? (
                <div className="py-20 text-center text-sm text-slate-400">No records found.</div>
              ) : (
                <table className="w-full border-collapse text-[12px]">
                  <thead className="sticky top-0 z-10">
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <th className="py-2.5 px-3 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider w-8">#</th>
                      {result.columns.map(col => (
                        <th
                          key={col}
                          onClick={() => handleSort(col)}
                          className="py-2.5 px-3 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider cursor-pointer select-none hover:text-slate-700 transition bg-slate-50"
                        >
                          <span className="inline-flex items-center gap-1">
                            {col}
                            {sortCol === col && (
                              <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d={sortAsc ? "M4.5 15.75l7.5-7.5 7.5 7.5" : "M19.5 8.25l-7.5 7.5-7.5-7.5"} />
                              </svg>
                            )}
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedRows.map((row, i) => (
                      <tr key={i} className="border-b border-slate-100 transition hover:bg-blue-50/30">
                        <td className="py-1.5 px-3 text-[10px] text-slate-400">{i + 1}</td>
                        {result.columns.map(col => (
                          <td key={col} className="py-1.5 px-3 text-slate-700 whitespace-nowrap">
                            {formatCell(col, row[col])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* Footer */}
          {result && !loading && (
            <div className="border-t border-slate-200 bg-slate-50 px-6 py-2 text-right text-[10px] text-slate-400">
              Generated at {new Date(result.generatedAt).toLocaleString()} &middot; Showing {sortedRows.length} of {result.totalRows} records
            </div>
          )}
        </div>
      )}
    </>
  );
}

function formatCell(col: string, value: unknown): React.ReactNode {
  if (value === null || value === undefined) return <span className="text-slate-300">&mdash;</span>;
  const s = String(value);

  if (col === "Status" || col === "Employment Status" || col === "Eligible Status") {
    const color = s === "Terminated" || s === "EXPIRED" || s === "Rejected" || s === "Cancelled"
      ? "bg-red-50 text-red-600"
      : s === "Approved" || s === "Present" || s === "Yes"
      ? "bg-emerald-50 text-emerald-600"
      : s === "Pending" || s === "PendingLevel2"
      ? "bg-amber-50 text-amber-600"
      : "bg-slate-50 text-slate-600";
    return <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold leading-none ${color}`}>{s}</span>;
  }

  if (col === "Completed" || col === "Vacant") {
    return s === "Yes"
      ? <span className="inline-block rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-600">Yes</span>
      : <span className="inline-block rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">No</span>;
  }

  if (col.includes("%") || col === "Progress %") {
    const n = Number(value);
    return (
      <div className="flex items-center gap-2">
        <div className="h-1.5 w-16 rounded-full bg-slate-100">
          <div className="h-1.5 rounded-full bg-blue-500" style={{ width: `${Math.min(n, 100)}%` }} />
        </div>
        <span className="text-[10px] text-slate-500">{n}%</span>
      </div>
    );
  }

  if ((col === "Gross" || col === "Deductions" || col === "Net Pay" || col === "Amount" || col === "Total Monthly Cost" || col === "Previous" || col === "Revised") && typeof value === "number") {
    return Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  return s;
}
