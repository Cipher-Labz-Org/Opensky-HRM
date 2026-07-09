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
  DRIVING_LICENSE_VALIDATION_MESSAGE,
  isValidDrivingLicense,
  sanitizeDrivingLicenseInput,
} from "@/lib/input-validation";
import { FieldValidationHint } from "@/components/ui/FieldValidationHint";

const INVALID_CLASS =
  "border-red-300 focus:border-red-400 focus:ring-red-200/20";

export type DrivingLicenseInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "inputMode"
> & {
  forceShowError?: boolean;
};

export const DrivingLicenseInput = forwardRef<HTMLInputElement, DrivingLicenseInputProps>(
  function DrivingLicenseInput(
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
      ...props
    },
    ref,
  ) {
    const [touched, setTouched] = useState(false);
    const [internalValue, setInternalValue] = useState(() => String(defaultValue ?? ""));

    const effectiveValue = value !== undefined ? String(value) : internalValue;
    const invalid =
      effectiveValue.trim() !== "" && !isValidDrivingLicense(effectiveValue);
    const showError = (touched || forceShowError) && invalid;

    function syncValue(el: HTMLInputElement) {
      const sanitized = sanitizeDrivingLicenseInput(el.value);
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
      if (/^[A-Za-z0-9\s\-/]$/.test(e.key)) {
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
          placeholder={placeholder ?? "e.g. B1234567"}
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
            message={DRIVING_LICENSE_VALIDATION_MESSAGE}
            depKey={effectiveValue}
          />
        ) : null}
      </div>
    );
  },
);
