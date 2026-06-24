namespace OpenSkyHRM.Domain;

public static class EmployeeLifecycleEventTypes
{
    public const string Joined = "Joined";
    public const string ProbationEnded = "ProbationEnded";
    public const string Confirmed = "Confirmed";
    public const string Promotion = "Promotion";
    public const string Transfer = "Transfer";
    public const string RoleChange = "RoleChange";
    public const string StatusChange = "StatusChange";
    public const string EmploymentTypeChange = "EmploymentTypeChange";
    public const string Separation = "Separation";
    public const string Reactivated = "Reactivated";

    public static string Label(string eventType) => eventType switch
    {
        Joined => "Joined organization",
        ProbationEnded => "Probation ended",
        Confirmed => "Permanent / confirmed",
        Promotion => "Promotion",
        Transfer => "Transfer",
        RoleChange => "Role change",
        StatusChange => "Status change",
        EmploymentTypeChange => "Employment type change",
        Separation => "Separation",
        Reactivated => "Reactivated",
        _ => eventType,
    };
}

public static class EmployeeLifecycleEventSources
{
    public const string System = "System";
    public const string AuditBackfill = "AuditBackfill";
    public const string RecordBackfill = "RecordBackfill";
}
