"use client";

import {
  forwardRef,
  useState,
  type ChangeEvent,
  type FocusEvent,
  type FormEvent,
  type InputHTMLAttributes,
  type KeyboardEvent,
} from "react";
import {
  isValidStatutoryFundNumber,
  sanitizeStatutoryFundNumberInput,
} from "@/lib/input-validation";
import { FieldValidationHint } from "@/components/ui/FieldValidationHint";

const INVALID_CLASS =
  "border-red-300 focus:border-red-400 focus:ring-red-200/20";

export type StatutoryFundNumberInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "inputMode"
> & {
  forceShowError?: boolean;
  validationMessage: string;
};

export const StatutoryFundNumberInput = forwardRef<
  HTMLInputElement,
  StatutoryFundNumberInputProps
>(function StatutoryFundNumberInput(
  {
    className = "",
    onChange,
    onBlur,
    onInput,
    onKeyDown,
    value,
    defaultValue,
    forceShowError,
    placeholder,
    validationMessage,
    ...props
  },
  ref,
) {
  const [touched, setTouched] = useState(false);
  const [internalValue, setInternalValue] = useState(() => String(defaultValue ?? ""));

  const effectiveValue = value !== undefined ? String(value) : internalValue;
  const invalid =
    effectiveValue.trim() !== "" && !isValidStatutoryFundNumber(effectiveValue);
  const showError = (touched || forceShowError) && invalid;

  function syncValue(el: HTMLInputElement) {
    const sanitized = sanitizeStatutoryFundNumberInput(el.value);
    if (sanitized !== el.value) el.value = sanitized;
    if (value === undefined) setInternalValue(sanitized);
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
    if (/^[A-Za-z0-9/]$/.test(e.key)) {
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
        inputMode="text"
        autoComplete={props.autoComplete ?? "off"}
        value={value}
        defaultValue={value === undefined ? defaultValue : undefined}
        placeholder={placeholder ?? "MH/BAN/0000064/000/0000123"}
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
          message={validationMessage}
          depKey={effectiveValue}
        />
      ) : null}
    </div>
  );
});
