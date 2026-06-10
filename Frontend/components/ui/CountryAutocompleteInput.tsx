"use client";

import { COUNTRY_NAMES } from "@/lib/people-form-lists";
import { ListAutocompleteInput } from "./ListAutocompleteInput";

export function CountryAutocompleteInput({
  name,
  value,
  onChange,
  className = "",
  placeholder = "Type to search country…",
  disabled = false,
}: {
  name: string;
  value: string;
  onChange: (next: string) => void;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <ListAutocompleteInput
      name={name}
      value={value}
      onChange={onChange}
      options={COUNTRY_NAMES}
      className={className}
      placeholder={placeholder}
      disabled={disabled}
    />
  );
}
