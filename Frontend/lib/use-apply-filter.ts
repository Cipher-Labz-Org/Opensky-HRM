import { useCallback, useState } from "react";
import { sanitizeSearchInput } from "./input-validation";

/** Draft input + applied value. Call `apply()` to commit the filter and clear the input field. */
export function useApplyFilter(initialApplied = "") {
  const [input, setInputState] = useState("");
  const [applied, setAppliedState] = useState(initialApplied);

  const setInput = useCallback((value: string) => {
    setInputState(sanitizeSearchInput(value));
  }, []);

  const setApplied = useCallback((value: string) => {
    setAppliedState(sanitizeSearchInput(value));
  }, []);

  const apply = useCallback(() => {
    const next = sanitizeSearchInput(input).trim();
    setAppliedState(next);
    setInputState("");
    return next;
  }, [input]);

  const clear = useCallback(() => {
    setInputState("");
    setAppliedState("");
  }, []);

  return {
    input,
    setInput,
    applied,
    setApplied,
    apply,
    clear,
    hasApplied: Boolean(applied),
  };
}
