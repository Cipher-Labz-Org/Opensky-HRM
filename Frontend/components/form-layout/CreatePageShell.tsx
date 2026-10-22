"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";

const PREVIEW_STORAGE_KEY = "opensky-form-preview-open";

export type BreadcrumbItem = { label: string; href?: string };

type CreatePageShellProps = {
  breadcrumb?: BreadcrumbItem[];
  title: string;
  subtitle?: ReactNode;
  formId: string;
  saving?: boolean;
  saveLabel?: string;
  onDiscard: () => void;
  preview?: ReactNode;
  children: ReactNode;
};

export function CreatePageShell({
  breadcrumb,
  title,
  subtitle,
  formId,
  saving,
  saveLabel = "Save",
  onDiscard,
  preview,
  children,
}: CreatePageShellProps) {
  const [previewOpen, setPreviewOpen] = useState(true);

  useEffect(() => {
    if (localStorage.getItem(PREVIEW_STORAGE_KEY) === "0") setPreviewOpen(false);
  }, []);

  function togglePreview(open: boolean) {
    setPreviewOpen(open);
    localStorage.setItem(PREVIEW_STORAGE_KEY, open ? "1" : "0");
  }

  return (
    <div className="form-create -mx-4 -mb-6 sm:-mx-6">
      <div className="form-create-top">
        {breadcrumb && breadcrumb.length > 0 ? (
          <nav className="form-create-breadcrumb" aria-label="Breadcrumb">
            {breadcrumb.map((item, i) => {
              const last = i === breadcrumb.length - 1;
              return (
                <span key={`${item.label}-${i}`} className="inline-flex items-center gap-1.5">
                  {item.href && !last ? (
                    <Link href={item.href}>{item.label}</Link>
                  ) : (
                    <span className={last ? "form-create-breadcrumb-current" : undefined}>{item.label}</span>
                  )}
                  {!last ? <span aria-hidden>/</span> : null}
                </span>
              );
            })}
          </nav>
        ) : null}

        <div className="form-create-page-head">
          <div className="form-create-page-head-row">
            <div className="min-w-0 flex-1">
              <h1 className="form-create-title">{title}</h1>
              <p className="form-create-subtitle">
                {subtitle ? <>{subtitle} · </> : null}
                Fields marked <span className="form-create-req">*</span> are required
              </p>
            </div>
            <div className="form-create-page-head-actions">
              {preview && !previewOpen ? (
                <button type="button" onClick={() => togglePreview(true)} className="form-create-btn-secondary gap-1.5">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                    <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" strokeLinejoin="round" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                  Show preview
                </button>
              ) : null}
              <button type="button" onClick={onDiscard} className="form-create-btn-secondary" disabled={saving}>
                Discard
              </button>
              <button type="submit" form={formId} className="form-create-btn-primary" disabled={saving}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
                  <path d="M5 12.5 10 17l9-10" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {saving ? "Saving..." : saveLabel}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="form-create-layout">
        <div className="form-create-main">{children}</div>
        {preview && previewOpen ? (
          <div className="form-create-preview-slot">
            <button
              type="button"
              className="form-create-preview-close"
              onClick={() => togglePreview(false)}
              aria-label="Close preview"
              title="Close preview"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
                <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
              </svg>
            </button>
            {preview}
          </div>
        ) : null}
      </div>
    </div>
  );
}
