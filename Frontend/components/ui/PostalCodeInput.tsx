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
  POSTAL_CODE_VALIDATION_MESSAGE,
  isValidPostalCode,
  sanitizePostalCodeInput,
} from "@/lib/input-validation";
import { FieldValidationHint } from "@/components/ui/FieldValidationHint";

const INVALID_CLASS = "border-red-300 focus:border-red-400 focus:ring-red-200/20";
const ALLOWED_KEY = /^[\p{L}\p{N}\s.,'\-:&]$/u;

export type PostalCodeInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "inputMode"> & {
  forceShowError?: boolean;
};

export const PostalCodeInput = forwardRef<HTMLInputElement, PostalCodeInputProps>(
  function PostalCodeInput(
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
    const invalid = effectiveValue.trim() !== "" && !isValidPostalCode(effectiveValue);
    const showError = (touched || forceShowError) && invalid;

    function syncValue(el: HTMLInputElement) {
      const sanitized = sanitizePostalCodeInput(el.value);
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
      if (ALLOWED_KEY.test(e.key)) {
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
          autoComplete={props.autoComplete ?? "postal-code"}
          value={value}
          defaultValue={value === undefined ? defaultValue : undefined}
          placeholder={placeholder}
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
            message={POSTAL_CODE_VALIDATION_MESSAGE}
            depKey={effectiveValue}
          />
        ) : null}
      </div>
    );
  },
);
