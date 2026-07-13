"use client";

import { forwardRef, type InputHTMLAttributes } from "react";
import { ETF_VALIDATION_MESSAGE } from "@/lib/input-validation";
import { StatutoryFundNumberInput } from "./StatutoryFundNumberInput";

export type EtfInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "inputMode"> & {
  forceShowError?: boolean;
};

export const EtfInput = forwardRef<HTMLInputElement, EtfInputProps>(function EtfInput(props, ref) {
  return (
    <StatutoryFundNumberInput
      ref={ref}
      validationMessage={ETF_VALIDATION_MESSAGE}
      placeholder="MH/BAN/0000064/000/0000123"
      {...props}
    />
  );
});
