"use client";

import {
  forwardRef,
  useEffect,
  useState,
  type ChangeEvent,
  type FocusEvent,
  type FormEvent,
  type InputHTMLAttributes,
  type KeyboardEvent,
} from "react";
import {
  isValidEmailInput,
  sanitizeEmailInput,
  EMAIL_INPUT_VALIDATION_MESSAGE,
} from "@/lib/input-validation";
import { displayWorkEmail } from "@/lib/employee-email";
import { FieldValidationHint } from "@/components/ui/FieldValidationHint";

const INVALID_CLASS =
  "border-red-300 focus:border-red-400 focus:ring-red-200/20";

export type EmailInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "inputMode"> & {
  forceShowError?: boolean;
  /** When true, auto-generated placeholder work emails are shown as empty. */
  stripPlaceholderWorkEmail?: boolean;
};

export const EmailInput = forwardRef<HTMLInputElement, EmailInputProps>(function EmailInput(
  {
    className = "",
    onChange,
    onBlur,
    onInput,
    onKeyDown,
    value,
    defaultValue,
    forceShowError,
    stripPlaceholderWorkEmail = false,
    placeholder,
    ...props
  },
  ref,
) {
  const normalize = (raw: string | number | readonly string[] | undefined) => {
    const text = String(raw ?? "");
    return stripPlaceholderWorkEmail ? displayWorkEmail(text) : text;
  };

  const isControlled = value !== undefined;
  const [touched, setTouched] = useState(false);
  const [internalValue, setInternalValue] = useState(() => normalize(defaultValue));

  useEffect(() => {
    if (!isControlled) setInternalValue(normalize(defaultValue));
  }, [defaultValue, isControlled, stripPlaceholderWorkEmail]);

  const effectiveValue = isControlled ? normalize(value) : internalValue;
  const invalid = effectiveValue.trim() !== "" && !isValidEmailInput(effectiveValue);
  const showError = (touched || forceShowError) && invalid;

  function syncValue(el: HTMLInputElement) {
    const sanitized = sanitizeEmailInput(el.value);
    if (sanitized !== el.value) el.value = sanitized;
    if (!isControlled) setInternalValue(sanitized);
    return sanitized;
  }

  function handleInput(e: FormEvent<HTMLInputElement>) {
    syncValue(e.currentTarget);
    onInput?.(e);
  }

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    syncValue(e.currentTarget);
    onChange?.(e);
  }

  function handleBlur(e: FocusEvent<HTMLInputElement>) {
    setTouched(true);
    syncValue(e.currentTarget);
    onBlur?.(e);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.ctrlKey || e.metaKey || e.altKey) {
      onKeyDown?.(e);
      return;
    }
    const allowed = [
      "Backspace",
      "Delete",
      "Tab",
      "Enter",
      "ArrowLeft",
      "ArrowRight",
      "ArrowUp",
      "ArrowDown",
      "Home",
      "End",
    ];
    if (allowed.includes(e.key)) {
      onKeyDown?.(e);
      return;
    }
    if (/^[A-Za-z0-9@.]$/.test(e.key)) {
      onKeyDown?.(e);
      return;
    }
    e.preventDefault();
  }

  return (
    <div>
      <input
        ref={ref}
        type="text"
        inputMode="email"
        autoComplete={props.autoComplete ?? "email"}
        value={effectiveValue}
        placeholder={placeholder ?? "name@company.com"}
        className={`${className}${showError ? ` ${INVALID_CLASS}` : ""}`}
        onInput={handleInput}
        onChange={handleChange}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        aria-invalid={showError || undefined}
        {...props}
      />
      {showError ? (
        <FieldValidationHint
          show={showError}
          message={EMAIL_INPUT_VALIDATION_MESSAGE}
          depKey={effectiveValue}
        />
      ) : null}
    </div>
  );
});
