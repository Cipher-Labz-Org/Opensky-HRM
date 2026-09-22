import { isCommercialBankName, isSampathBankName } from "@/lib/bank-names";

export type BankSlipFormat = "commercial-one-to-many" | "sampath-cefts-slips" | "excel-salary-sheet";

export function bankSlipFormatFor(bankName?: string | null): BankSlipFormat {
  if (isCommercialBankName(bankName)) return "commercial-one-to-many";
  if (isSampathBankName(bankName)) return "sampath-cefts-slips";
  return "excel-salary-sheet";
}

export function bankSlipFormatLabel(bankName?: string | null): string {
  const name = (bankName ?? "").trim() || "this bank";
  switch (bankSlipFormatFor(bankName)) {
    case "commercial-one-to-many":
      return "Commercial Bank Combiz One-to-Many text file";
    case "sampath-cefts-slips":
      return "Sampath Bank salary deposit text file";
    default:
      return `${name} salary Excel sheet`;
  }
}
