import Link from "next/link";
import { ROUTES } from "@/config/routes";

export default function HomePage() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-20">
      <h1 className="text-4xl font-bold text-[var(--text)]">Home</h1>
      <p className="mt-4 text-[var(--muted)]">
        Modern HR operations in one place — people, attendance, leave, payroll, and more. Explore the site or go
        straight to your workspace.
      </p>
      <div className="mt-8 rounded-[22px] border border-[var(--border)] bg-[var(--panel)] p-8 shadow-[var(--shadow)]">
        <p className="text-sm text-[var(--muted)]">Get started</p>
        <p className="mt-2 text-[var(--text)]">
          Sign in to manage your organization, or view{" "}
          <Link href={ROUTES.pricing} className="font-medium text-[var(--primary)] hover:underline">
            pricing
          </Link>{" "}
          and{" "}
          <Link href={ROUTES.contact} className="font-medium text-[var(--primary)] hover:underline">
            contact
          </Link>{" "}
          for more information.
        </p>
        <div className="mt-6">
          <Link
            href={ROUTES.dashboard}
            className="inline-flex rounded-xl bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-white shadow-[var(--shadow)] transition hover:brightness-95"
          >
            Open dashboard
          </Link>
        </div>
      </div>
    </section>
  );
}
