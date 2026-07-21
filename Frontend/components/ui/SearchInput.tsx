"use client";

import { forwardRef, type ChangeEvent, type InputHTMLAttributes } from "react";
import { sanitizeSearchInput } from "@/lib/input-validation";

export type SearchInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "inputMode">;

export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(function SearchInput(
  { onChange, ...props },
  ref,
) {
  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const sanitized = sanitizeSearchInput(e.target.value);
    if (sanitized !== e.target.value) {
      e.target.value = sanitized;
    }
    onChange?.(e);
  }

  return (
    <input
      ref={ref}
      type="search"
      inputMode="search"
      autoComplete="off"
      onChange={handleChange}
      {...props}
    />
  );
});
