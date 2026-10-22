import type { ReactNode } from "react";

type FormFieldProps = {
  label: string;
  htmlFor?: string;
  required?: boolean;
  full?: boolean;
  error?: string;
  help?: ReactNode;
  children: ReactNode;
};

export function FormField({ label, htmlFor, required, full, error, help, children }: FormFieldProps) {
  return (
    <div className={`form-create-field${full ? " form-create-field-full" : ""}`}>
      <label className="form-create-label" htmlFor={htmlFor}>
        {label}
        {required ? <span className="form-create-req">*</span> : null}
      </label>
      {children}
      {error ? <span className="form-create-err">{error}</span> : help ? <span className="form-create-help">{help}</span> : null}
    </div>
  );
}
