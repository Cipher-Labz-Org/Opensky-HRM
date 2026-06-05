"use client";

import { forwardRef, type ChangeEvent, type InputHTMLAttributes } from "react";
import { sanitizePersonName } from "@/lib/input-validation";

export type PersonNameInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "inputMode">;

export const PersonNameInput = forwardRef<HTMLInputElement, PersonNameInputProps>(
  function PersonNameInput({ onChange, ...props }, ref) {
    function handleChange(e: ChangeEvent<HTMLInputElement>) {
      const sanitized = sanitizePersonName(e.target.value);
      if (sanitized !== e.target.value) {
        e.target.value = sanitized;
      }
      onChange?.(e);
    }

    return (
      <input
        ref={ref}
        type="text"
        inputMode="text"
        autoComplete={props.autoComplete ?? "given-name"}
        onChange={handleChange}
        {...props}
      />
    );
  },
);
