"use client";

import { useCallback, useEffect, useState } from "react";

/** Debounced text filter: applies after typing pauses; clears immediately when input is emptied. */
export function useDebouncedFilterValue(initialValue = "", debounceMs = 350) {
  const [inputValue, setInputValue] = useState(initialValue);
  const [appliedValue, setAppliedValue] = useState(initialValue);

  useEffect(() => {
    const trimmed = inputValue.trim();
    if (!trimmed) {
      setAppliedValue("");
      return;
    }
    const handle = window.setTimeout(() => setAppliedValue(trimmed), debounceMs);
    return () => window.clearTimeout(handle);
  }, [inputValue, debounceMs]);

  const clear = useCallback(() => {
    setInputValue("");
    setAppliedValue("");
  }, []);

  return {
    inputValue,
    setInputValue,
    appliedValue,
    clear,
    hasActiveFilter: appliedValue.trim().length > 0,
  };
}
