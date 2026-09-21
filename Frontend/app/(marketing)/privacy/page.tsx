import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { APP_NAME } from "@/config/constants";
import { ROUTES } from "@/config/routes";

export const metadata: Metadata = {
  title: `Privacy Policy | ${APP_NAME}`,
  description:
    "Privacy Policy for the OpenSky HRM mobile and web applications. How we collect, use, store, and share information.",
};

const LAST_UPDATED = "17 September 2026";

export default function PrivacyPolicyPage() {
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
              Privacy Policy
            </h1>
            <span className="hidden rounded-full border border-[#2E7BBF]/20 bg-[#2E7BBF]/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#1a5f94] sm:inline-flex">
              OpenSky HRM
            </span>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-slate-600 sm:text-base">
            Last updated: {LAST_UPDATED}
          </p>
          <div className="mt-3 h-0.5 max-w-xs rounded-full bg-[#2E7BBF]/70" aria-hidden />
        </div>
      </div>

      <div className="space-y-10 text-[15px] leading-relaxed text-slate-700">
        <div className="rounded-xl border border-[#2E7BBF]/20 bg-[#2E7BBF]/5 px-4 py-4">
          <p className="font-semibold text-slate-900">Request data deletion</p>
          <p className="mt-1">
            To request deletion of your OpenSky HRM account and associated data, follow the steps on
            our{" "}
            <Link href={ROUTES.dataDeletion} className="font-medium text-[#2E7BBF] hover:underline">
              data deletion page
            </Link>
            .
          </p>
        </div>

        <Section title="1. About the App">
          <p>
            OpenSky HRM (the “App”) is a Human Resource Management application for authorized
            employees, managers, and HR administrators. It includes the mobile app and the related
            web application used by your organization.
          </p>
          <p>
            The App connects to your organization’s OpenSky HRM backend (server URL configured via
            QR code or manual setup on mobile, or via your organization’s web address). Business and
            employee data is processed on your organization’s servers, not on public OpenSkylabz
            consumer services, unless we explicitly state otherwise.
          </p>
        </Section>

        <Section title="2. Information We Collect">
          <h3 className="mt-6 text-base font-semibold text-slate-900">
            2.1 Account and Authentication Data
          </h3>
          <p>The App may collect and process the following information for authentication and account access:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Username</li>
            <li>Email address</li>
            <li>Password</li>
            <li>Access tokens (session tokens)</li>
            <li>
              User profile information returned by your organization’s server, such as name, role,
              employee ID, permissions, assigned locations, and licensed modules
            </li>
          </ul>

          <h4 className="mt-5 font-semibold text-slate-900">Password Handling</h4>
          <p>
            When you sign in, your password is transmitted securely to your organization’s
            authentication server for identity verification.
          </p>
          <p>
            We do not store your password locally on the device after sign-in. Your organization’s
            server stores a hashed representation of your password for verification. The App does
            not use locally stored passwords for offline sign-in.
          </p>
          <p>
            Access tokens and certain account information may be stored locally on your device to
            maintain your login session. On mobile, these are stored using secure storage mechanisms
            provided by the device or operating system (with a fallback to device storage where
            secure storage is unavailable). On the web application, session tokens may be stored in
            browser local storage or session storage, depending on whether you choose to stay signed
            in.
          </p>
          <p>You can remove locally stored credentials by:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Logging out of the App</li>
            <li>Clearing the App’s data from your device settings (mobile) or browser data (web)</li>
            <li>Uninstalling the App</li>
          </ul>
          <p>
            We do not sell or share your password with third parties. Password verification is
            performed by your organization’s authentication server.
          </p>

          <h3 className="mt-8 text-base font-semibold text-slate-900">
            2.2 HR and operational data
          </h3>
          <p>When you use the App, it may access, display, create, upload, or sync:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              Employee profile data (for example name, employee code, contact details, address, date
              of birth, nationality, national ID, tax and statutory identifiers, employment status,
              job title, department, location, and manager)
            </li>
            <li>Profile photographs</li>
            <li>Leave balances, leave requests, and supporting documents such as medical certificates</li>
            <li>Attendance punches, timesheets, and related location or QR check-in records</li>
            <li>Payslips and payroll information you are authorized to view</li>
            <li>Approvals (for example leave approve or reject actions for managers)</li>
            <li>In-app notifications</li>
            <li>
              Other HR records your organization stores in OpenSky HRM and that your role is
              permitted to access, such as emergency contacts, dependents, bank account details for
              payroll, documents and attachments, recruitment and candidate information, performance,
              learning, onboarding, and offboarding records
            </li>
          </ul>
          <p>This data is sent to and retrieved from your configured API server.</p>

          <h3 className="mt-8 text-base font-semibold text-slate-900">
            2.3 Device configuration data
          </h3>
          <ul className="list-disc space-y-1 pl-5">
            <li>API server URLs and company connection settings (from QR scan or manual entry)</li>
            <li>Company name and logo used for branding in the App</li>
            <li>App or browser preferences (for example display settings)</li>
          </ul>

          <h3 className="mt-8 text-base font-semibold text-slate-900">
            2.4 Location data (optional)
          </h3>
          <p>
            If you grant location permission, the App may collect GPS coordinates (latitude and
            longitude) when you punch attendance in or out, including where your organization uses
            geofencing. Location is collected at the time of the punch. Location is not collected
            continuously in the background.
          </p>

          <h3 className="mt-8 text-base font-semibold text-slate-900">2.5 Camera (optional)</h3>
          <p>
            The camera is used to scan QR codes for company server configuration and for attendance
            punch in or out at a business unit or location. Photos or videos are not stored unless
            required for a feature you actively use (for example updating your profile photograph).
          </p>

          <h3 className="mt-8 text-base font-semibold text-slate-900">
            2.6 Photos and files (optional)
          </h3>
          <p>
            If you grant photo library or file access, you may upload a profile photograph or attach
            documents required for a feature you use (for example a medical certificate PDF with a
            leave request). These files are sent to your organization’s server.
          </p>

          <h3 className="mt-8 text-base font-semibold text-slate-900">
            2.7 Locally stored data
          </h3>
          <p>To maintain your session and connection settings, the App stores data on your device using:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Secure device storage (mobile)</li>
            <li>Browser storage such as localStorage or sessionStorage (web)</li>
          </ul>
          <p>
            This may include your API server URL, company branding, access tokens, and cached profile
            information needed to keep you signed in. The mobile App is not an offline-first HR
            system; HR records are retrieved from and saved to your organization’s server when you
            use the App.
          </p>
        </Section>

        <Section title="3. How We Use Information">
          <p>We use collected information to:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Authenticate users and maintain secure sessions</li>
            <li>
              Provide HR self-service and administration, including profile, leave, attendance,
              approvals, notifications, and payslips
            </li>
            <li>Connect the App to your organization’s HRM server</li>
            <li>Attach location or QR check-in data to attendance records where enabled</li>
            <li>Improve reliability and security of the App</li>
          </ul>
          <p>We do not sell your personal information to third parties.</p>
        </Section>

        <Section title="4. Data Sharing">
          <p>Information is shared only as follows:</p>
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-900">
                <tr>
                  <th className="px-4 py-3 font-semibold">Recipient</th>
                  <th className="px-4 py-3 font-semibold">Purpose</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                <tr>
                  <td className="px-4 py-3 align-top font-medium text-slate-900">
                    Your organization’s HRM/API server
                  </td>
                  <td className="px-4 py-3 align-top">Core app functionality</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 align-top font-medium text-slate-900">
                    Google Play / Apple App Store / device OS services
                  </td>
                  <td className="px-4 py-3 align-top">
                    App distribution and optional device backup (if enabled on the device)
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3 align-top font-medium text-slate-900">
                    Email delivery providers
                  </td>
                  <td className="px-4 py-3 align-top">
                    If your organization configures outbound email (for example SendGrid or SMTP),
                    messages such as notifications, offers, or password-related mail may be sent
                    through that provider
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3 align-top font-medium text-slate-900">
                    Cloud file storage
                  </td>
                  <td className="px-4 py-3 align-top">
                    If your organization configures cloud storage (for example Amazon S3), uploaded
                    files such as photos and documents may be stored there on your organization’s
                    behalf
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3 align-top font-medium text-slate-900">AI providers</td>
                  <td className="px-4 py-3 align-top">
                    If your organization enables OpenSky AI, questions and limited HR context may be
                    sent to the configured language-model provider (for example Azure OpenAI or
                    OpenAI) to generate a response
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3 align-top font-medium text-slate-900">Legal authorities</td>
                  <td className="px-4 py-3 align-top">When required by applicable law</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p>
            Your organization is responsible for HR data on its server. Attendance data may also be
            received from workplace time-clock or biometric devices that your organization operates;
            the App does not use your phone’s fingerprint or face unlock to collect biometric
            identifiers.
          </p>
          <p>
            The App does not include third-party advertising or analytics SDKs for tracking users
            across apps.
          </p>
        </Section>

        <Section title="5. Data Retention">
          <p>
            <span className="font-semibold text-slate-900">On device:</span> Data remains until you
            log out, clear app or browser data, uninstall the App, or your organization’s policies
            require removal.
          </p>
          <p>
            <span className="font-semibold text-slate-900">On server:</span> Retained according to
            your employer or organization’s data retention policies on the connected HRM system.
          </p>
        </Section>

        <Section title="6. Security">
          <p>We use reasonable technical measures including:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>HTTPS/API communication with your configured server</li>
            <li>Token-based authentication</li>
            <li>Local encryption or storage practices supported by the device OS</li>
          </ul>
          <p>
            No method of transmission or storage is 100% secure. You are responsible for keeping
            your login credentials confidential.
          </p>
        </Section>

        <Section title="7. Your Choices and Rights">
          <p>You may:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Deny camera, location, photo, or file permissions (some features may not work)</li>
            <li>Log out and clear local app or browser data from device settings</li>
            <li>
              Contact your organization’s administrator for access, correction, or deletion of
              server-side HR data
            </li>
          </ul>
          <p>
            Depending on your country, you may have additional privacy rights (for example access,
            correction, deletion). Contact us using the details below.
          </p>
        </Section>

        <Section title="8. Children’s Privacy">
          <p>
            The App is intended for business use by authorized employees and is not directed at
            children under 13 (or 16 where applicable). We do not knowingly collect data from
            children.
          </p>
        </Section>

        <Section title="9. International Transfers">
          <p>
            If your organization’s server, email provider, file storage, or AI provider is located
            outside your country, data may be transferred internationally according to your
            organization’s setup and applicable law.
          </p>
        </Section>

        <Section title="10. Changes to This Policy">
          <p>
            We may update this Privacy Policy from time to time. The “Last updated” date will be
            revised. Continued use of the App after changes constitutes acceptance of the updated
            policy.
          </p>
        </Section>

        <Section title="11. Contact Us">
          <p>If you have questions about this Privacy Policy or the OpenSky HRM App:</p>
          <p className="font-semibold text-slate-900">OpenSkylabz / Cipherlabz</p>
          <ul className="space-y-1">
            <li>
              Email:{" "}
              <a className="font-medium text-[#2E7BBF] hover:underline" href="mailto:info@cipherlabz.com">
                info@cipherlabz.com
              </a>
            </li>
            <li>
              Support:{" "}
              <a className="font-medium text-[#2E7BBF] hover:underline" href="mailto:support@openskyhrm.com">
                support@openskyhrm.com
              </a>
            </li>
            <li>
              Website:{" "}
              <a
                className="font-medium text-[#2E7BBF] hover:underline"
                href="https://www.openskylabz.com/"
                target="_blank"
                rel="noopener noreferrer"
              >
                https://www.openskylabz.com/
              </a>
            </li>
            <li>Address: No. 302, Galle Road, Colombo 04, Sri Lanka</li>
          </ul>
          <p className="pt-2">
            For questions about HR records held by your employer, contact your organization’s
            administrator.{" "}
            <Link href={ROUTES.contact} className="font-medium text-[#2E7BBF] hover:underline">
              Open the contact page
            </Link>
            .
          </p>
        </Section>
      </div>
    </article>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-bold tracking-tight text-slate-900">{title}</h2>
      {children}
    </section>
  );
}
