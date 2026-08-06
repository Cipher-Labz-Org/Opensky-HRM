"use client";

import { forwardRef, type ChangeEvent, type InputHTMLAttributes } from "react";
import { PHONE_VALIDATION_MESSAGE, sanitizePhoneInput } from "@/lib/input-validation";

export type PhoneInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "inputMode">;

export const PhoneInput = forwardRef<HTMLInputElement, PhoneInputProps>(function PhoneInput(
  { onChange, placeholder, title, ...props },
  ref,
) {
  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const sanitized = sanitizePhoneInput(e.target.value);
    if (sanitized !== e.target.value) {
      e.target.value = sanitized;
    }
    onChange?.(e);
  }

  return (
    <input
      ref={ref}
      type="tel"
      inputMode="tel"
      autoComplete={props.autoComplete ?? "tel"}
      placeholder={placeholder ?? "0762535363"}
      title={title ?? PHONE_VALIDATION_MESSAGE}
      onChange={handleChange}
      {...props}
    />
  );
});
