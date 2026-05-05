import type { Metadata } from "next";
import { APP_NAME } from "@/config/constants";
import { LoginLandingExperience } from "@/components/auth/LoginLandingExperience";

export const metadata: Metadata = {
  title: `${APP_NAME} — Sign in`,
  description: "Sign in to your OpenSky HRM workspace",
};

export default function HomePage() {
  return <LoginLandingExperience />;
}
