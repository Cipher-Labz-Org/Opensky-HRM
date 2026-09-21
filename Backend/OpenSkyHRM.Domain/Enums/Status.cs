namespace OpenSkyHRM.Domain.Enums;

public enum EmploymentType
{
    Freelance,
    FullTimeContract,
    FullTimeInternship,
    FullTimePermanent,
    FullTimeProbation,
    PartTimeContract,
    PartTimeInternship,
    PartTimePermanent,
}

public enum EmployeeStatus
{
    Active,
    OnNotice,
    Resigned,
    Terminated,
    Retired,
    Deceased,
    Absconded,
}

public enum Gender
{
    Male,
    Female,
    Other
}

public enum ApprovalStatus
{
    Pending,
    PendingLevel2,
    Approved,
    Rejected,
    Cancelled,
    CancellationRequested
}
