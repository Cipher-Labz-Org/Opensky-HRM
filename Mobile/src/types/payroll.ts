export interface PayStatementLine {
  id: string;
  componentId: string;
  componentName: string;
  componentCode: string;
  type: string;
  amount: number;
  isEmployerContribution: boolean;
  sortOrder: number;
}

export interface PayStatement {
  id: string;
  batchId: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  department: string | null;
  month: number;
  year: number;
  basicPay: number;
  totalEarnings: number;
  totalDeductions: number;
  grossPay: number;
  netPay: number;
  employerCost: number;
  status: string;
  lines: PayStatementLine[];
}

export interface PagedPayStatements {
  items: PayStatement[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
