export default function PricingPage() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-20">
      <h1 className="text-4xl font-bold text-[var(--text)]">Pricing</h1>
      <p className="mt-4 text-[var(--muted)]">
        Plans and pricing will be configured here. Placeholder page.
      </p>
      <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {["Starter", "Professional", "Enterprise"].map((tier) => (
          <div
            key={tier}
            className="rounded-[22px] border border-[var(--border)] bg-[var(--panel)] p-6 shadow-[var(--shadow)]"
          >
            <h3 className="text-xl font-semibold">{tier}</h3>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Tier description placeholder.
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
