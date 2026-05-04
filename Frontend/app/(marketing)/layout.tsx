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
      <header className="border-b border-slate-200/90 bg-white">
        <div className="relative mx-auto flex h-14 max-w-6xl items-center justify-center px-6 sm:h-16">
          <Link href={ROUTES.home} className="text-lg font-bold tracking-tight text-slate-900 sm:text-xl">
            {APP_NAME}
          </Link>
          <Link
            href={ROUTES.dashboard}
            className="absolute right-6 top-1/2 -translate-y-1/2 rounded-xl bg-[#1a92d5] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#157fc0]"
          >
            Dashboard
          </Link>
        </div>
      </header>
      <main className="flex-1 bg-[var(--bg)]">{children}</main>
      <footer className="border-t border-slate-200/90 bg-white py-6">
        <div className="mx-auto max-w-6xl px-6 text-center text-sm text-slate-600">
          © {new Date().getFullYear()} {APP_NAME}. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
