"use client";

import { NATIONALITY_NAMES } from "@/lib/people-form-lists";
import { ListAutocompleteInput } from "./ListAutocompleteInput";

export function NationalityAutocompleteInput({
  name,
  value,
  onChange,
  className = "",
  placeholder = "Type to search nationality…",
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
      options={NATIONALITY_NAMES}
      className={className}
      placeholder={placeholder}
      disabled={disabled}
    />
  );
}
