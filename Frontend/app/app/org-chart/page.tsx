import { redirect } from "next/navigation";

/** Legacy URL: org chart lives under Org Structure (chart tab). */
export default function OrgChartRedirectPage() {
  redirect("/app/org-structure");
}
