import { SUPPORT_EMAIL } from "@/config/constants";

export default function ContactPage() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-20">
      <h1 className="text-4xl font-bold text-[var(--text)]">Contact</h1>
      <p className="mt-4 text-[var(--muted)]">
        Get in touch. Contact form and details will be added here.
      </p>
      <div className="mt-8 rounded-[22px] border border-[var(--border)] bg-[var(--panel)] p-8 shadow-[var(--shadow)]">
        <p className="text-sm text-[var(--muted)]">Support email</p>
        <a href={`mailto:${SUPPORT_EMAIL}`} className="mt-1 text-[var(--primary)] hover:underline">
          {SUPPORT_EMAIL}
        </a>
      </div>
    </section>
  );
}
