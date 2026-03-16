import { APP_NAME } from "@/config/constants";
import { ROUTES } from "@/config/routes";
import Link from "next/link";

/**
 * Marketing layout for /, /pricing, /contact. Server-rendered; no client pathname.
 */
export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-[var(--border)] bg-[var(--panel)] shadow-[var(--shadow)]">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link href={ROUTES.home} className="text-xl font-bold text-[var(--text)]">
            {APP_NAME}
          </Link>
          <nav className="flex gap-6">
            <Link href={ROUTES.home} className="text-sm text-[var(--muted)] hover:text-[var(--text)]">
              Home
            </Link>
            <Link href={ROUTES.pricing} className="text-sm text-[var(--muted)] hover:text-[var(--text)]">
              Pricing
            </Link>
            <Link href={ROUTES.contact} className="text-sm text-[var(--muted)] hover:text-[var(--text)]">
              Contact
            </Link>
            <Link href={ROUTES.dashboard} className="rounded-xl bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white shadow-[var(--shadow)]">
              Dashboard
            </Link>
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-[var(--border)] bg-[var(--panel)] py-6">
        <div className="mx-auto max-w-6xl px-6 text-center text-sm text-[var(--muted)]">
          © {new Date().getFullYear()} {APP_NAME}. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
