import { getAssetBaseUrl } from "@/config/constants";
import { resolveCompanyLogoSrc, type CompanyBranding } from "@/lib/company-branding";

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
  const logoBlock = logoSrc
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

/** Ensures the offer letter header matches the job requisition layout when previewing in the app. */
export function prepareOfferLetterHtmlForDisplay(html: string, branding: CompanyBranding): string {
  if (!html.trim()) return html;
  return normalizeOfferLetterHeader(rewriteOfferLetterAssetUrls(html), branding);
}
