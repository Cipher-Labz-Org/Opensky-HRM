namespace OpenSkyHRM.Application.Interfaces;

public interface IEmailService
{
    Task SendOfferEmailAsync(string toEmail, string candidateName, string positionTitle,
        decimal salary, string currency, DateTime? joiningDate, string? remarks);

    /// <summary>Sends a confirmation to the employee who submitted the leave request.</summary>
    Task SendLeaveApplicationConfirmationAsync(string toEmail, string employeeName, string leaveTypeName,
        DateTime startDate, DateTime endDate, decimal totalDays, string status, string? reason);

    Task SendTrainingAssignedAsync(string toEmail, string employeeName, string courseTitle, DateTime? dueDate);

    Task SendTrainingOverdueReminderAsync(string toEmail, string employeeName, string courseTitle, DateTime dueDate);

    Task<bool> IsConfiguredAsync();
}
