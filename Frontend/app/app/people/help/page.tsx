import { redirect } from "next/navigation";
import { ROUTES } from "@/config/routes";

/** Canonical People Hub guide lives under /app/help/people */
export default function PeopleHelpLegacyRedirect() {
  redirect(ROUTES.peopleHelp);
}
