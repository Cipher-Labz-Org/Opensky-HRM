"use client";

import { forwardRef, type InputHTMLAttributes } from "react";
import { EPF_VALIDATION_MESSAGE } from "@/lib/input-validation";
import { StatutoryFundNumberInput } from "./StatutoryFundNumberInput";

export type EpfInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "inputMode"> & {
  forceShowError?: boolean;
};

export const EpfInput = forwardRef<HTMLInputElement, EpfInputProps>(function EpfInput(props, ref) {
  return (
    <StatutoryFundNumberInput
      ref={ref}
      validationMessage={EPF_VALIDATION_MESSAGE}
      placeholder="MH/BAN/0000064/000/0000123"
      {...props}
    />
  );
});
