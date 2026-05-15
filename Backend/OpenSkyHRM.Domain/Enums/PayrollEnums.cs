namespace OpenSkyHRM.Domain.Enums;

public enum ComponentType
{
    Earning,
    Deduction,
    StatutoryDeduction,
    StatutoryContribution
}

public enum ComponentCategory
{
    Fixed,
    Variable,
    Statutory,
    OneTime
}

public enum BatchStatus
{
    Draft,
    Calculated,
    Reviewed,
    Approved,
    Finalized,
    Cancelled
}

public enum PayStatementStatus
{
    Draft,
    Finalized
}

public enum SalaryAdvanceRequestStatus
{
    Pending,
    Approved,
    Rejected
}
