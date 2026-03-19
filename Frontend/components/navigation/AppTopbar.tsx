type AppTopbarProps = {
  title: string;
  subtitle?: string;
};

export function AppTopbar({ title, subtitle }: AppTopbarProps) {
  return (
    <div className="mb-6">
      <h2 className="text-2xl font-bold text-[var(--text)] md:text-[28px]">
        {title}
      </h2>
      {subtitle && (
        <p className="mt-2 text-[var(--muted)]">{subtitle}</p>
      )}
    </div>
  );
}
