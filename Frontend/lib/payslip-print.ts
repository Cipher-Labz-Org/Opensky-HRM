import { APP_NAME } from "@/config/constants";
import {
  fetchCompanyBranding,
  isPdfLogoUrl,
  resolveCompanyLogoSrc,
} from "@/lib/company-branding";
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

export type PayslipPrintLine = {
  id: string;
  componentName: string;
  componentCode?: string;
  type: string;
  amount: number;
  isEmployerContribution: boolean;
};

export type PayslipPrintData = {
  employeeName: string;
  employeeCode?: string;
  department?: string;
  month: number;
  year: number;
  totalEarnings: number;
  totalDeductions: number;
  grossPay: number;
  netPay: number;
  employerCost: number;
  status: string;
  lines?: PayslipPrintLine[];
};

function money(n: number): string {
  return `LKR ${n.toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function periodLabel(month: number, year: number): string {
  return `${MONTHS[month - 1] ?? month} ${year}`;
}

function isUnfinalized(status: string): boolean {
  const s = status.trim().toLowerCase();
  return s !== "finalized" && s !== "approved";
}

function lineRows(lines: PayslipPrintLine[]): string {
  if (lines.length === 0) {
    return `<tr><td colspan="2" style="padding:8px 0;color:#94a3b8;font-size:12px">None</td></tr>`;
  }
  return lines
    .map(
      (l) => `<tr>
        <td style="padding:6px 8px 6px 0;border-bottom:1px solid #e2e8f0;color:#334155">${escapeHtml(l.componentName)}</td>
        <td style="padding:6px 0;border-bottom:1px solid #e2e8f0;text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap">${escapeHtml(money(l.amount))}</td>
      </tr>`,
    )
    .join("");
}

export function buildPayslipPrintHtml(
  statement: PayslipPrintData,
  companyName: string,
  logoSrc: string | null,
): string {
  const earnings =
    statement.lines?.filter(
      (l) =>
        (l.type === "Earning" || l.type === "Income" || l.componentCode === "TOTAL_PAYMENT" || l.componentCode === "TOTAL_PAY") &&
        l.type !== "Rate" &&
        !l.isEmployerContribution,
    ) ?? [];
  const deductions =
    statement.lines?.filter(
      (l) => (l.type === "Deduction" || l.type === "StatutoryDeduction") && !l.isEmployerContribution,
    ) ?? [];
  const employerItems = statement.lines?.filter((l) => l.isEmployerContribution) ?? [];
  const showDraftMark = isUnfinalized(statement.status);
  const logoHtml =
    logoSrc && !isPdfLogoUrl(logoSrc)
      ? `<img src="${escapeHtml(logoSrc)}" alt="" style="height:56px;max-width:180px;object-fit:contain" />`
      : "";
  const printedAt = new Date().toLocaleString("en-LK");

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Payslip — ${escapeHtml(statement.employeeName)} — ${escapeHtml(periodLabel(statement.month, statement.year))}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; color: #0f172a; margin: 0; padding: 28px 32px; }
    .sheet { position: relative; max-width: 800px; margin: 0 auto; }
    .watermark {
      position: absolute; top: 38%; left: 50%; transform: translate(-50%, -50%) rotate(-28deg);
      font-size: 92px; font-weight: 800; letter-spacing: 0.18em; color: rgba(148,163,184,0.16);
      pointer-events: none; z-index: 0; white-space: nowrap;
    }
    .content { position: relative; z-index: 1; }
    h1 { margin: 0; font-size: 18px; letter-spacing: 0.08em; text-transform: uppercase; }
    table { width: 100%; border-collapse: collapse; }
    @media print {
      body { padding: 12mm; }
      .watermark { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <div class="sheet">
    ${showDraftMark ? `<div class="watermark">${escapeHtml(statement.status.toUpperCase() || "DRAFT")}</div>` : ""}
    <div class="content">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:16px;border-bottom:2px solid #1e4a8c;padding-bottom:14px">
        <div style="display:flex;align-items:center;gap:14px;min-width:0">
          ${logoHtml}
          <div>
            <div style="font-size:16px;font-weight:700">${escapeHtml(companyName || APP_NAME)}</div>
            <div style="font-size:11px;color:#64748b;margin-top:2px">Pay Slip</div>
          </div>
        </div>
        <div style="text-align:right">
          <h1>Payslip</h1>
          <div style="font-size:13px;color:#334155;margin-top:4px">${escapeHtml(periodLabel(statement.month, statement.year))}</div>
          <div style="font-size:11px;color:#64748b;margin-top:2px">Status: ${escapeHtml(statement.status || "—")}</div>
        </div>
      </div>

      <table style="margin:18px 0 22px;font-size:13px">
        <tr>
          <td style="padding:4px 24px 4px 0;color:#64748b;width:120px">Employee</td>
          <td style="padding:4px 0;font-weight:600">${escapeHtml(statement.employeeName)}</td>
        </tr>
        <tr>
          <td style="padding:4px 24px 4px 0;color:#64748b">Employee code</td>
          <td style="padding:4px 0">${escapeHtml(statement.employeeCode || "—")}</td>
        </tr>
        <tr>
          <td style="padding:4px 24px 4px 0;color:#64748b">Department</td>
          <td style="padding:4px 0">${escapeHtml(statement.department || "—")}</td>
        </tr>
      </table>

      <div style="display:flex;gap:28px;align-items:flex-start">
        <div style="flex:1">
          <div style="font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#15803d;margin-bottom:8px">Earnings</div>
          <table style="font-size:13px">
            <tbody>
              ${lineRows(earnings)}
              <tr>
                <td style="padding:10px 8px 0 0;font-weight:700">Total earnings</td>
                <td style="padding:10px 0 0;text-align:right;font-weight:700;font-variant-numeric:tabular-nums">${escapeHtml(money(statement.totalEarnings))}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div style="flex:1">
          <div style="font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#dc2626;margin-bottom:8px">Deductions</div>
          <table style="font-size:13px">
            <tbody>
              ${lineRows(deductions)}
              <tr>
                <td style="padding:10px 8px 0 0;font-weight:700">Total deductions</td>
                <td style="padding:10px 0 0;text-align:right;font-weight:700;font-variant-numeric:tabular-nums">${escapeHtml(money(statement.totalDeductions))}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div style="margin-top:22px;display:flex;justify-content:space-between;align-items:center;background:#f1f5f9;border-radius:8px;padding:14px 16px">
        <span style="font-size:16px;font-weight:700">Net pay</span>
        <span style="font-size:22px;font-weight:800;color:#15803d;font-variant-numeric:tabular-nums">${escapeHtml(money(statement.netPay))}</span>
      </div>
      <div style="margin-top:8px;font-size:12px;color:#64748b">Gross pay: ${escapeHtml(money(statement.grossPay))}</div>

      ${
        employerItems.length > 0
          ? `<div style="margin-top:22px">
          <div style="font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#64748b;margin-bottom:8px">Employer contributions</div>
          <table style="font-size:13px">
            <tbody>
              ${lineRows(employerItems)}
              <tr>
                <td style="padding:10px 8px 0 0;font-weight:700">Total employer cost</td>
                <td style="padding:10px 0 0;text-align:right;font-weight:700;font-variant-numeric:tabular-nums">${escapeHtml(money(statement.employerCost))}</td>
              </tr>
            </tbody>
          </table>
        </div>`
          : ""
      }

      <p style="margin-top:28px;font-size:10px;color:#94a3b8">
        This is a computer-generated payslip. Printed ${escapeHtml(printedAt)}.
      </p>
    </div>
  </div>
</body>
</html>`;
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

/** Opens the browser print dialog for a pay statement. Draft slips can be printed. */
export async function printPayslip(statement: PayslipPrintData): Promise<void> {
  const branding = await fetchCompanyBranding();
  const rawLogo = branding.companyLogoUrl;
  const logoSrc =
    rawLogo && !isPdfLogoUrl(rawLogo) ? resolveCompanyLogoSrc(rawLogo) : null;
  const html = buildPayslipPrintHtml(
    statement,
    branding.companyName || APP_NAME,
    logoSrc,
  );
  await printHtmlInIframe(html);
}
