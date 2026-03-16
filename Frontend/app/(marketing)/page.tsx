export default function HomePage() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-20">
      <div className="rounded-[26px] bg-gradient-to-br from-[#0f172a] to-[#1d4ed8] p-8 text-white shadow-[var(--shadow)] md:p-12">
        <h1 className="mb-4 text-4xl font-bold md:text-5xl">
          Enterprise workforce platform
        </h1>
        <p className="max-w-2xl text-lg leading-relaxed text-blue-100">
          OpenSky HRM brings employee records, talent acquisition, onboarding,
          leave, time, payroll integration, performance, and analytics into one
          role-based experience.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          {["Role-based access", "Compliance & audit", "Manager approvals", "Analytics"].map(
            (label) => (
              <span
                key={label}
                className="rounded-full bg-white/10 px-3 py-2 text-sm"
              >
                {label}
              </span>
            )
          )}
        </div>
      </div>
      <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {[
          { title: "People Hub", desc: "Central employee master and lifecycle." },
          { title: "Recruitment", desc: "Pipeline and hiring workflows." },
          { title: "Analytics", desc: "Workforce insights and reporting." },
        ].map(({ title, desc }) => (
          <div
            key={title}
            className="rounded-[22px] border border-[var(--border)] bg-[var(--panel)] p-6 shadow-[var(--shadow)]"
          >
            <h3 className="text-lg font-semibold text-[var(--text)]">{title}</h3>
            <p className="mt-2 text-sm text-[var(--muted)]">{desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
