namespace OpenSkyHRM.Domain.Enums;

public enum EmploymentStatus
{
    Freelance,
    FullTimeContract,
    FullTimeInternship,
    FullTimePermanent,
    FullTimeProbation,
    PartTimeContract,
    PartTimeInternship,
    PartTimePermanent,
    Terminated
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
    Cancelled
}
