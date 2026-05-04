import Link from "next/link";
import { SUPPORT_EMAIL } from "@/config/constants";
import { ROUTES } from "@/config/routes";

export default function ContactPage() {
  return (
    <section className="mx-auto max-w-6xl px-6 pb-20 pt-2 md:pt-4">
      {/* Command Center–style title strip (same as AppTopbar, marketing-safe margins) */}
      <div className="relative -mx-6 mb-8 overflow-hidden border-b border-slate-200 bg-white px-6 py-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)] sm:-mx-6">
        <div
          className="pointer-events-none absolute inset-y-3 left-6 w-1 rounded-full bg-[#2E7BBF] shadow-[0_0_12px_rgba(46,123,191,0.28)] sm:left-6"
          aria-hidden
        />
        <div className="relative pl-5">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-[1.75rem] md:text-[2rem] md:leading-snug">
              Contact
            </h1>
            <span className="hidden rounded-full border border-[#2E7BBF]/20 bg-[#2E7BBF]/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#1a5f94] sm:inline-flex">
              OpenSky HRM
            </span>
          </div>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-base">
            Get in touch. Contact form and details will be added here.
          </p>
          <div className="mt-3 h-0.5 max-w-xs rounded-full bg-[#2E7BBF]/70" aria-hidden />
        </div>
      </div>

      <div className="opensky-dashboard-card overflow-hidden p-0">
        <div className="flex items-center gap-3 border-b border-[#2E7BBF]/20 bg-white px-5 py-4 sm:px-6">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#2E7BBF]/12">
            <svg className="h-5 w-5 text-[#2E7BBF]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
              />
            </svg>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Support</h2>
            <p className="text-xs text-[#2E7BBF]">We typically respond within one business day.</p>
          </div>
        </div>
        <div className="border-t border-slate-100 bg-white px-5 py-5 sm:px-6 sm:py-6">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Support email</p>
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="mt-2 inline-block text-base font-semibold text-[#2E7BBF] underline-offset-2 transition hover:text-[#ED1C24] hover:underline sm:text-lg"
          >
            {SUPPORT_EMAIL}
          </a>
          <p className="mt-6 text-sm text-slate-600">
            Already a customer?{" "}
            <Link href={ROUTES.dashboard} className="font-semibold text-[#2E7BBF] underline-offset-2 hover:text-[#ED1C24] hover:underline">
              Open the dashboard
            </Link>
            .
          </p>
        </div>
      </div>
    </section>
  );
}
