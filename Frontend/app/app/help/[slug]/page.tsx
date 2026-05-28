import { HelpTopicPage } from "@/components/help/HelpTopicPage";

export function generateStaticParams() {
  return [
    { slug: "dashboard" },
    { slug: "people" },
    { slug: "people-audit-trail" },
    { slug: "employee-360" },
    { slug: "recruitment" },
    { slug: "employee-tasks" },
    { slug: "employee-actions" },
    { slug: "leave" },
    { slug: "approvals" },
    { slug: "attendance" },
    { slug: "payroll" },
    { slug: "performance" },
    { slug: "learning" },
    { slug: "reports" },
    { slug: "org-structure" },
    { slug: "analytics" },
    { slug: "settings" },
    { slug: "onboarding" },
    { slug: "offboarding" },
    { slug: "administration" },
    { slug: "user-management" },
    { slug: "billing" },
    { slug: "email-templates" },
    { slug: "email-delivery-log" },
  ];
}

export default function HelpTopicRoute({ params }: { params: { slug: string } }) {
  return <HelpTopicPage slug={params.slug} />;
}
