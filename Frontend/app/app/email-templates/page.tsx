"use client";

import Link from "next/link";
import { AppTopbar } from "@/components/navigation/AppTopbar";
import { TransactionalEmailTemplatesContent } from "@/components/settings/TransactionalEmailTemplatesContent";
import { ROUTES } from "@/config/routes";

export default function EmailTemplatesPage() {
  return (
    <>
      <AppTopbar
        title="Email templates"
        subtitle="Customize transactional emails sent by the system (leave confirmations, offers, and future Email_* templates)."
      />
      <p className="mb-6 text-sm text-[var(--text-muted)]">
        In the sidebar, open <strong className="text-[var(--text)]">Audit &amp; Compliance</strong> → Email templates. Letter templates for PDFs/Word stay under{" "}
        <Link href={ROUTES.settings} className="font-medium text-[var(--primary)] hover:underline">
          Policy &amp; Settings
        </Link>
        ; delivery history is the{" "}
        <Link href={ROUTES.emailDeliveryLog} className="font-medium text-[var(--primary)] hover:underline">
          email delivery log
        </Link>
        .
      </p>
      <TransactionalEmailTemplatesContent />
    </>
  );
}
