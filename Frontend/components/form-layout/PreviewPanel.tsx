import type { ReactNode } from "react";

export type PreviewChip = { label: string; bg?: string; fg?: string; dot?: string };
export type PreviewKv = { label: string; value?: string | null; mono?: boolean };
export type PreviewCheck = { label: string; done: boolean };

type PreviewPanelProps = {
  label: string;
  name: string;
  subtitle?: string;
  initials?: string;
  chips?: PreviewChip[];
  kv?: PreviewKv[];
  checks?: PreviewCheck[];
  tip?: ReactNode;
};

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return parts
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}

export function PreviewPanel({ label, name, subtitle, initials, chips = [], kv = [], checks = [], tip }: PreviewPanelProps) {
  const pct = checks.length ? Math.round((checks.filter((c) => c.done).length / checks.length) * 100) : 0;

  return (
    <aside className="form-create-preview" aria-label="Preview">
      <div className="form-create-preview-head">
        <span className="form-create-preview-label">{label}</span>
        <div className="form-create-preview-identity">
          <div className="form-create-avatar" aria-hidden>
            {initials ?? initialsOf(name)}
          </div>
          <div className="form-create-preview-names">
            <h2 className="form-create-preview-name">{name}</h2>
            {subtitle ? <span className="form-create-preview-sub">{subtitle}</span> : null}
          </div>
        </div>
        {chips.length > 0 ? (
          <div className="form-create-preview-chips">
            {chips.map((c) => (
              <span
                key={c.label}
                className="form-create-chip"
                style={c.bg || c.fg ? { background: c.bg, color: c.fg } : undefined}
              >
                {c.dot ? <span className="form-create-chip-dot" style={{ background: c.dot }} aria-hidden /> : null}
                {c.label}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      <div className="form-create-preview-body">
        {kv.length > 0 ? (
          <dl className="form-create-kv">
            {kv.map((item) => (
              <div key={item.label} className="contents">
                <dt>{item.label}</dt>
                <dd
                  className={`${!item.value ? "form-create-kv-empty" : ""} ${item.mono ? "form-create-num" : ""}`.trim()}
                  title={item.value ?? undefined}
                >
                  {item.value || "—"}
                </dd>
              </div>
            ))}
          </dl>
        ) : null}

        {checks.length > 0 ? (
          <div>
            <div className="form-create-completeness-head">
              <span className="form-create-completeness-title">Completeness</span>
              <span className="form-create-num form-create-completeness-pct">{pct} %</span>
            </div>
            <div className="form-create-bar" aria-hidden>
              <div className="form-create-bar-fill" style={{ width: `${pct}%` }} />
            </div>
            <div className="form-create-checks">
              {checks.map((c) => (
                <div key={c.label} className={`form-create-check${c.done ? " form-create-check-done" : ""}`}>
                  <span className="form-create-check-box" aria-hidden>
                    {c.done ? (
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5">
                        <path d="M5 12.5 10 17l9-10" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    ) : null}
                  </span>
                  {c.label}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {tip ? (
          <div className="form-create-tip">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden className="shrink-0">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 11v5M12 8h.01" strokeLinecap="round" />
            </svg>
            <span>{tip}</span>
          </div>
        ) : null}
      </div>
    </aside>
  );
}
