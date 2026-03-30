"use client";

import { AppTopbar } from "@/components/navigation/AppTopbar";
import { EmailDeliveryLogContent } from "@/components/compliance/EmailDeliveryLogContent";

export default function EmailDeliveryLogPage() {
  return (
    <>
      <AppTopbar
        title="Email delivery log"
        subtitle="Outbound transactional email attempts: recipient, subject, delivery status, provider, and errors."
      />
      <EmailDeliveryLogContent />
    </>
  );
}
