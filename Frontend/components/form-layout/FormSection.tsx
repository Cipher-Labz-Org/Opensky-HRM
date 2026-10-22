import type { ReactNode } from "react";

type FormSectionProps = {
  index: number;
  title: string;
  hint?: string;
  actions?: ReactNode;
  children: ReactNode;
};

export function FormSection({ index, title, hint, actions, children }: FormSectionProps) {
  return (
    <section className="form-create-section">
      <div className="form-create-section-h">
        <span className="form-create-section-idx">{index}</span>
        <h3 className="form-create-section-title">{title}</h3>
        {hint ? <span className="form-create-section-hint">{hint}</span> : null}
        {actions ? <div className="form-create-section-actions">{actions}</div> : null}
      </div>
      {children ? <div className="form-create-section-b">{children}</div> : null}
    </section>
  );
}
