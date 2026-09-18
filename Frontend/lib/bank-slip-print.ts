import { APP_NAME } from "@/config/constants";
import { fetchCompanyBranding, isPdfLogoUrl, resolveCompanyLogoSrc } from "@/lib/company-branding";
import type { CompanyBankAccount } from "@/lib/company-bank-accounts";
import { escapeHtml } from "@/lib/template-merge";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export type BankSlipEmployee = {
  employeeName: string;
  employeeCode?: string;
  netPay: number;
  epfEmployee?: number;
  epfEmployer?: number;
  etfEmployer?: number;
  bankName?: string | null;
  accountNumber?: string | null;
  bankCode?: string | null;
  branchCode?: string | null;
  branchLocation?: string | null;
};

export type BankSlipContext = {
  companyName: string;
  logoSrc: string | null;
  companyAccount: CompanyBankAccount | null;
  batchCode: string;
  month: number;
  year: number;
};

function money(n: number): string {
  return `LKR ${n.toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function periodLabel(month: number, year: number): string {
  return `${MONTHS[month - 1] ?? month} ${year}`;
}

function dash(value?: string | null): string {
  const text = (value ?? "").trim();
  return text || "—";
}

function wrapPrintDocument(title: string, sheetsHtml: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; color: #0f172a; margin: 0; padding: 24px 28px; }
    .sheet { position: relative; max-width: 800px; margin: 0 auto 28px; page-break-after: always; border: 1px solid #cbd5e1; border-radius: 8px; padding: 22px 24px; }
    .sheet:last-child { page-break-after: auto; margin-bottom: 0; }
    h1 { margin: 0; font-size: 16px; letter-spacing: 0.08em; text-transform: uppercase; }
    table { width: 100%; border-collapse: collapse; }
    .muted { color: #64748b; font-size: 11px; }
    .box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 14px; }
    .label { font-size: 10px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #64748b; margin-bottom: 8px; }
    @media print {
      body { padding: 10mm; }
      .sheet { page-break-after: always; border-color: #94a3b8; }
      .sheet:last-child { page-break-after: auto; }
    }
  </style>
</head>
<body>
  ${sheetsHtml}
</body>
</html>`;
}

function headerHtml(ctx: BankSlipContext, subtitle: string): string {
  const logoHtml =
    ctx.logoSrc && !isPdfLogoUrl(ctx.logoSrc)
      ? `<img src="${escapeHtml(ctx.logoSrc)}" alt="" style="height:48px;max-width:160px;object-fit:contain" />`
      : "";
  return `<div style="display:flex;align-items:center;justify-content:space-between;gap:16px;border-bottom:2px solid #1e4a8c;padding-bottom:12px;margin-bottom:16px">
    <div style="display:flex;align-items:center;gap:12px;min-width:0">
      ${logoHtml}
      <div>
        <div style="font-size:16px;font-weight:700">${escapeHtml(ctx.companyName || APP_NAME)}</div>
        <div class="muted" style="margin-top:2px">${escapeHtml(subtitle)}</div>
      </div>
    </div>
    <div style="text-align:right">
      <h1>Bank slip</h1>
      <div style="font-size:13px;margin-top:4px">${escapeHtml(periodLabel(ctx.month, ctx.year))}</div>
      <div class="muted" style="margin-top:2px">${escapeHtml(ctx.batchCode || "—")}</div>
    </div>
  </div>`;
}

function accountBox(title: string, rows: { label: string; value: string }[]): string {
  return `<div class="box">
    <div class="label">${escapeHtml(title)}</div>
    <table style="font-size:13px">
      ${rows
        .map(
          (row) => `<tr>
            <td style="padding:3px 16px 3px 0;color:#64748b;width:42%">${escapeHtml(row.label)}</td>
            <td style="padding:3px 0;font-weight:600">${escapeHtml(row.value)}</td>
          </tr>`,
        )
        .join("")}
    </table>
  </div>`;
}

function companyAccountRows(account: CompanyBankAccount | null): { label: string; value: string }[] {
  return [
    { label: "Account name", value: dash(account?.fullName) },
    { label: "Bank name", value: dash(account?.bankName) },
    { label: "Branch name", value: dash(account?.branchName) },
    { label: "Account no.", value: dash(account?.accountNo) },
    { label: "Bank / branch code", value: [account?.bankCode, account?.branchCode].filter((v) => v?.trim()).join(" / ") || "—" },
  ];
}

function employeeSalarySheet(employee: BankSlipEmployee, ctx: BankSlipContext, printedAt: string): string {
  return `<div class="sheet">
    ${headerHtml(ctx, "Salary payment bank slip")}
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      ${accountBox("From — company account", companyAccountRows(ctx.companyAccount))}
      ${accountBox("To — employee account", [
        { label: "Employee", value: dash(employee.employeeName) },
        { label: "Employee code", value: dash(employee.employeeCode) },
        { label: "Bank name", value: dash(employee.bankName) },
        { label: "Branch", value: dash(employee.branchLocation) },
        { label: "Account no.", value: dash(employee.accountNumber) },
        { label: "Bank / branch code", value: [employee.bankCode, employee.branchCode].filter((v) => v?.trim()).join(" / ") || "—" },
      ])}
    </div>
    <div class="box" style="margin-top:14px;display:flex;justify-content:space-between;align-items:center">
      <div>
        <div class="label" style="margin-bottom:4px">Amount to credit</div>
        <div style="font-size:12px;color:#64748b">Salary — ${escapeHtml(periodLabel(ctx.month, ctx.year))} — ${escapeHtml(dash(employee.employeeCode))}</div>
      </div>
      <div style="font-size:22px;font-weight:800;color:#15803d;font-variant-numeric:tabular-nums">${escapeHtml(money(employee.netPay))}</div>
    </div>
    <p class="muted" style="margin:18px 0 0">Basic layout for now. Official bank slip templates can replace this later. Printed ${escapeHtml(printedAt)}.</p>
  </div>`;
}

function remittanceSheet(
  ctx: BankSlipContext,
  totals: { netPay: number; epfEmployee: number; epfEmployer: number; etfEmployer: number; employeeCount: number },
  printedAt: string,
): string {
  const rows = [
    { label: "Salary net pay", value: money(totals.netPay) },
    { label: "EPF employee", value: money(totals.epfEmployee) },
    { label: "EPF employer", value: money(totals.epfEmployer) },
    { label: "ETF employer", value: money(totals.etfEmployer) },
  ];
  return `<div class="sheet">
    ${headerHtml(ctx, "Company bank remittance slip")}
    ${accountBox("Debit — company account", companyAccountRows(ctx.companyAccount))}
    <div class="box" style="margin-top:14px">
      <div class="label">Amounts for this payroll run</div>
      <table style="font-size:13px">
        ${rows
          .map(
            (row) => `<tr>
              <td style="padding:6px 16px 6px 0;border-bottom:1px solid #e2e8f0">${escapeHtml(row.label)}</td>
              <td style="padding:6px 0;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:600;font-variant-numeric:tabular-nums">${escapeHtml(row.value)}</td>
            </tr>`,
          )
          .join("")}
        <tr>
          <td style="padding:10px 16px 0 0;font-weight:700">Employees</td>
          <td style="padding:10px 0 0;text-align:right;font-weight:700">${totals.employeeCount}</td>
        </tr>
      </table>
    </div>
    <p class="muted" style="margin:18px 0 0">Basic remittance summary. Official EPF/ETF/salary bank slip templates can replace this later. Printed ${escapeHtml(printedAt)}.</p>
  </div>`;
}

function printHtmlInIframe(html: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const iframe = document.createElement("iframe");
    iframe.setAttribute("aria-hidden", "true");
    iframe.style.cssText =
      "position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;pointer-events:none";
    document.body.appendChild(iframe);

    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) {
      iframe.remove();
      reject(new Error("Could not prepare print view."));
      return;
    }

    const cleanup = () => {
      window.setTimeout(() => iframe.remove(), 1000);
    };

    const runPrint = () => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        resolve();
      } catch (err) {
        reject(err instanceof Error ? err : new Error("Print failed."));
      } finally {
        cleanup();
      }
    };

    doc.open();
    doc.write(html);
    doc.close();

    const images = Array.from(doc.images);
    if (images.length === 0 || images.every((img) => img.complete)) {
      window.setTimeout(runPrint, 80);
      return;
    }

    let remaining = images.length;
    const done = () => {
      remaining -= 1;
      if (remaining <= 0) window.setTimeout(runPrint, 50);
    };
    for (const img of images) {
      if (img.complete) done();
      else {
        img.onload = done;
        img.onerror = done;
      }
    }
  });
}

async function loadPrintContext(
  companyAccount: CompanyBankAccount | null,
  batchCode: string,
  month: number,
  year: number,
): Promise<BankSlipContext> {
  const branding = await fetchCompanyBranding();
  const rawLogo = branding.companyLogoUrl;
  return {
    companyName: branding.companyName || APP_NAME,
    logoSrc: rawLogo && !isPdfLogoUrl(rawLogo) ? resolveCompanyLogoSrc(rawLogo) : null,
    companyAccount,
    batchCode,
    month,
    year,
  };
}

export async function printEmployeeBankSlips(
  employees: BankSlipEmployee[],
  companyAccount: CompanyBankAccount | null,
  batchCode: string,
  month: number,
  year: number,
): Promise<void> {
  if (employees.length === 0) return;
  const ctx = await loadPrintContext(companyAccount, batchCode, month, year);
  const printedAt = new Date().toLocaleString("en-LK");
  const html = wrapPrintDocument(
    `Bank slips — ${periodLabel(month, year)} (${employees.length})`,
    employees.map((employee) => employeeSalarySheet(employee, ctx, printedAt)).join(""),
  );
  await printHtmlInIframe(html);
}

export async function printBankRemittanceSlip(
  totals: { netPay: number; epfEmployee: number; epfEmployer: number; etfEmployer: number; employeeCount: number },
  companyAccount: CompanyBankAccount | null,
  batchCode: string,
  month: number,
  year: number,
): Promise<void> {
  const ctx = await loadPrintContext(companyAccount, batchCode, month, year);
  const printedAt = new Date().toLocaleString("en-LK");
  const html = wrapPrintDocument(
    `Bank remittance — ${periodLabel(month, year)}`,
    remittanceSheet(ctx, totals, printedAt),
  );
  await printHtmlInIframe(html);
}
