import type { Metadata } from "next";
import Link from "next/link";
import { APP_NAME, SUPPORT_EMAIL } from "@/config/constants";
import { ROUTES } from "@/config/routes";

export const metadata: Metadata = {
  title: `Request Data Deletion | ${APP_NAME}`,
  description:
    "How to request deletion of your OpenSky HRM account and associated data.",
};

export default function DataDeletionPage() {
  return (
    <article className="mx-auto max-w-3xl px-6 pb-20 pt-2 md:pt-4">
      <div className="relative -mx-6 mb-8 overflow-hidden border-b border-slate-200 bg-white px-6 py-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]">
        <div
          className="pointer-events-none absolute inset-y-3 left-6 w-1 rounded-full bg-[#2E7BBF] shadow-[0_0_12px_rgba(46,123,191,0.28)]"
          aria-hidden
        />
        <div className="relative pl-5">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-[1.75rem] md:text-[2rem] md:leading-snug">
              Request Data Deletion
            </h1>
            <span className="hidden rounded-full border border-[#2E7BBF]/20 bg-[#2E7BBF]/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#1a5f94] sm:inline-flex">
              OpenSky HRM
            </span>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-slate-600 sm:text-base">
            OpenSky HRM by OpenSkylabz / Cipherlabz. Follow the steps below to request deletion of
            your account and associated data.
          </p>
          <div className="mt-3 h-0.5 max-w-xs rounded-full bg-[#2E7BBF]/70" aria-hidden />
        </div>
      </div>

      <div className="space-y-8 text-[15px] leading-relaxed text-slate-700">
        <section className="space-y-3">
          <h2 className="text-lg font-bold tracking-tight text-slate-900">
            How to request that your data be deleted
          </h2>
          <ol className="list-decimal space-y-3 pl-5">
            <li>
              <span className="font-semibold text-slate-900">Delete data on your device.</span> Log
              out of the OpenSky HRM app, then clear the app’s data in your device settings, or
              uninstall the app. This removes locally stored login tokens, connection settings, and
              cached profile information.
            </li>
            <li>
              <span className="font-semibold text-slate-900">
                Request deletion of server-side HR data from your employer.
              </span>{" "}
              OpenSky HRM accounts are created and managed by your organization. Contact your HR or
              system administrator and ask them to delete your login account and associated employee
              records.
            </li>
            <li>
              <span className="font-semibold text-slate-900">Contact OpenSky HRM support.</span> If
              you need help reaching your administrator, email{" "}
              <a className="font-medium text-[#2E7BBF] hover:underline" href={`mailto:${SUPPORT_EMAIL}`}>
                {SUPPORT_EMAIL}
              </a>{" "}
              with:
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>Your full name</li>
                <li>Your OpenSky HRM username or email</li>
                <li>Your organization / company name</li>
                <li>A clear request to delete your account and associated data</li>
              </ul>
            </li>
          </ol>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold tracking-tight text-slate-900">
            What is deleted
          </h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>Local app data on your device (session tokens, server URL, cached profile)</li>
            <li>
              Your login account, when your organization processes the request
            </li>
            <li>
              Associated HR records your role stored in OpenSky HRM, such as profile details,
              attendance punches, leave requests, documents you uploaded, and notifications — when
              your organization deletes them
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold tracking-tight text-slate-900">
            What may be kept
          </h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              Records your employer is legally required to retain (for example payroll, tax, or
              statutory employment records)
            </li>
            <li>Backup copies until those backups expire under your organization’s policy</li>
            <li>
              Aggregated or anonymized information that no longer identifies you, if your
              organization keeps it for reporting
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold tracking-tight text-slate-900">Retention period</h2>
          <p>
            <span className="font-semibold text-slate-900">On your device:</span> data is removed
            when you log out, clear app data, or uninstall the app.
          </p>
          <p>
            <span className="font-semibold text-slate-900">On your organization’s server:</span>{" "}
            data is retained according to your employer’s data retention policies. OpenSky HRM does
            not automatically delete user data within 90 days.
          </p>
        </section>

        <p>
          See the{" "}
          <Link href={ROUTES.privacy} className="font-medium text-[#2E7BBF] hover:underline">
            Privacy Policy
          </Link>{" "}
          for full details, or{" "}
          <Link href={ROUTES.contact} className="font-medium text-[#2E7BBF] hover:underline">
            contact us
          </Link>
          .
        </p>
      </div>
    </article>
  );
}
