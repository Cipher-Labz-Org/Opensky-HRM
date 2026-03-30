import { redirect } from "next/navigation";
import { ROUTES } from "@/config/routes";

/** Old URL: help now opens as a slide-over from People Hub (header ? icon). */
export default function PeopleHelpLegacyRedirect() {
  redirect(ROUTES.people);
}
