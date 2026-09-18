import { isCommercialBankName } from "@/lib/bank-names";

export type BankSlipFormat = "commercial-one-to-many" | "unavailable";

export function bankSlipFormatFor(bankName?: string | null): BankSlipFormat {
  if (isCommercialBankName(bankName)) return "commercial-one-to-many";
  return "unavailable";
}

export function bankSlipFormatLabel(bankName?: string | null): string {
  const name = (bankName ?? "").trim() || "this bank";
  switch (bankSlipFormatFor(bankName)) {
    case "commercial-one-to-many":
      return "Commercial Bank one-to-many text file";
    default:
      return `${name} slip is not set up yet`;
  }
}
