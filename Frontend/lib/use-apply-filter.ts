import { useCallback, useState } from "react";

/** Draft input + applied value. Call `apply()` to commit the filter and clear the input field. */
export function useApplyFilter(initialApplied = "") {
  const [input, setInput] = useState("");
  const [applied, setApplied] = useState(initialApplied);

  const apply = useCallback(() => {
    const next = input.trim();
    setApplied(next);
    setInput("");
    return next;
  }, [input]);

  const clear = useCallback(() => {
    setInput("");
    setApplied("");
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
