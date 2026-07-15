import { getAssetBaseUrl } from "@/config/constants";
import { resolveCompanyLogoSrc, isPdfLogoUrl, type CompanyBranding } from "@/lib/company-branding";

const OFFER_HEADER_GRADIENT =
  "background: linear-gradient(90deg, #1a3a6e 0%, #1e4a8c 50%, #2e78e6 100%); padding: 28px 36px; color: white;";

function escapeHtmlAttr(value: string): string {
  return value.replace(/"/g, "&quot;");
}

function escapeHtmlText(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildOfferLetterHeaderHtml(logoSrc: string | null, companyName: string): string {
  const logoBlock =
    logoSrc && !isPdfLogoUrl(logoSrc)
      ? `<img src="${escapeHtmlAttr(logoSrc)}" alt="${escapeHtmlAttr(`${companyName} logo`)}" style="height: 80px; max-width: 200px; width: auto; object-fit: contain; display: block; flex-shrink: 0;" />`
      : "";

  return `<div style="display: flex; align-items: center; gap: 24px;">
    ${logoBlock}
    <div style="min-width: 0; flex: 1;">
      <h1 style="margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.02em;">Offer of Employment</h1>
      <p style="margin: 8px 0 0; font-size: 15px; font-weight: 400; opacity: 0.9;">${escapeHtmlText(companyName)}</p>
    </div>
  </div>`;
}

/** Rewrites stored upload paths so images load in the browser preview. */
export function rewriteOfferLetterAssetUrls(html: string): string {
  if (!html.trim()) return html;

  const assetBase = getAssetBaseUrl().replace(/\/$/, "");
  return html.replace(
    /src="(?:https?:\/\/[^"]+)?(\/uploads\/[^"]+)"|src="\/hrm-backend(\/uploads\/[^"]+)"/gi,
    (_match, uploadsPath: string, proxiedPath: string) => {
      const path = uploadsPath || proxiedPath;
      return `src="${assetBase}${path}"`;
    },
  );
}

function normalizeOfferLetterHeader(html: string, branding: CompanyBranding): string {
  const headerStart = html.search(/<div style="background: linear-gradient/i);
  if (headerStart < 0) return html;

  const bodyStart = html.indexOf('<div style="padding:', headerStart);
  if (bodyStart < 0) return html;

  const logoSrc = resolveCompanyLogoSrc(branding.companyLogoUrl);
  const headerInner = buildOfferLetterHeaderHtml(logoSrc, branding.companyName);
  const normalizedHeader = `<div style="${OFFER_HEADER_GRADIENT}">${headerInner}</div>\n    `;
  return html.slice(0, headerStart) + normalizedHeader + html.slice(bodyStart);
}

function injectOfferActionsPreview(html: string): string {
  if (html.toLowerCase().includes("accept offer</a>") || html.includes("Accept offer</span>")) return html;
  const previewActions = `<div style="margin: 28px 0 12px; padding: 24px; background: #f8f9fe; border-radius: 12px; text-align: center;">
    <p style="margin: 0 0 16px; font-size: 15px; font-weight: 600; color: #1a1a2e;">Your response</p>
    <p style="margin: 0 0 20px; font-size: 14px; line-height: 1.6; color: #555;">When emailed, the candidate can accept, negotiate, or decline from this offer.</p>
    <span style="display:inline-block;margin:6px;padding:12px 20px;background:#16a34a;color:#fff;border-radius:8px;font-weight:600;font-size:14px;">Accept offer</span>
    <span style="display:inline-block;margin:6px;padding:12px 20px;background:#2563eb;color:#fff;border-radius:8px;font-weight:600;font-size:14px;">Negotiate</span>
    <span style="display:inline-block;margin:6px;padding:12px 20px;background:#dc2626;color:#fff;border-radius:8px;font-weight:600;font-size:14px;">Decline</span>
  </div>`;
  const marker = "Please review the details and let us know your decision at your earliest convenience.";
  if (html.includes(marker)) return html.replace(marker, marker + previewActions);
  return html + previewActions;
}

/** Ensures the offer letter header matches the job requisition layout when previewing in the app. */
export function prepareOfferLetterHtmlForDisplay(html: string, branding: CompanyBranding): string {
  if (!html.trim()) return html;
  const normalized = normalizeOfferLetterHeader(rewriteOfferLetterAssetUrls(html), branding);
  return injectOfferActionsPreview(normalized);
}

function injectOfferResponseLinks(html: string, responseBaseUrl: string): string {
  if (html.toLowerCase().includes("accept offer</a>")) return html;

  const acceptUrl = escapeHtmlAttr(`${responseBaseUrl}?action=accept`);
  const negotiateUrl = escapeHtmlAttr(`${responseBaseUrl}?action=negotiate`);
  const rejectUrl = escapeHtmlAttr(`${responseBaseUrl}?action=reject`);

  const actions = `<div style="margin: 28px 0 12px; padding: 24px; background: #f8f9fe; border-radius: 12px; text-align: center;">
    <p style="margin: 0 0 16px; font-size: 15px; font-weight: 600; color: #1a1a2e;">Your response</p>
    <p style="margin: 0 0 20px; font-size: 14px; line-height: 1.6; color: #555;">Please choose how you would like to proceed with this offer.</p>
    <a href="${acceptUrl}" style="display:inline-block;margin:6px;padding:12px 20px;background:#16a34a;color:#fff;border-radius:8px;font-weight:600;font-size:14px;text-decoration:none;">Accept offer</a>
    <a href="${negotiateUrl}" style="display:inline-block;margin:6px;padding:12px 20px;background:#2563eb;color:#fff;border-radius:8px;font-weight:600;font-size:14px;text-decoration:none;">Negotiate</a>
    <a href="${rejectUrl}" style="display:inline-block;margin:6px;padding:12px 20px;background:#dc2626;color:#fff;border-radius:8px;font-weight:600;font-size:14px;text-decoration:none;">Decline</a>
  </div>`;

  const marker = "Please review the details and let us know your decision at your earliest convenience.";
  const withoutPreview = html.replace(
    /<div style="margin: 28px 0 12px; padding: 24px; background: #f8f9fe; border-radius: 12px; text-align: center;">[\s\S]*?(?:When emailed, the candidate can accept|Please choose how you would like to proceed)[\s\S]*?<\/div>/i,
    "",
  );
  if (withoutPreview.includes(marker)) return withoutPreview.replace(marker, marker + actions);
  return withoutPreview + actions;
}

/** Public candidate page: show the letter with optional working response links. */
export function prepareOfferLetterHtmlForPublicResponse(
  html: string,
  branding: CompanyBranding,
  responseBaseUrl?: string,
): string {
  if (!html.trim()) return html;
  const normalized = normalizeOfferLetterHeader(rewriteOfferLetterAssetUrls(html), branding);
  if (!responseBaseUrl) {
    return normalized.replace(
      /<div style="margin: 28px 0 12px; padding: 24px; background: #f8f9fe; border-radius: 12px; text-align: center;">[\s\S]*?<\/div>/i,
      "",
    );
  }
  return injectOfferResponseLinks(normalized, responseBaseUrl);
}
