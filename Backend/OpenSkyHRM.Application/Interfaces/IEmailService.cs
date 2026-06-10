namespace OpenSkyHRM.Application.Interfaces;

public interface IEmailService
{
    Task SendOfferEmailAsync(string toEmail, string candidateName, string positionTitle,
        decimal salary, string currency, DateTime? joiningDate, string? remarks, string? customLetterHtml = null);

    /// <summary>Sends a confirmation to the employee who submitted the leave request.</summary>
    Task SendLeaveApplicationConfirmationAsync(string toEmail, string employeeName, string leaveTypeName,
        DateTime startDate, DateTime endDate, decimal totalDays, string status, string? reason);

    Task SendTrainingAssignedAsync(string toEmail, string employeeName, string courseTitle, DateTime? dueDate);

    Task SendTrainingOverdueReminderAsync(string toEmail, string employeeName, string courseTitle, DateTime dueDate);

    /// <summary>Notifies the candidate that an interview has been scheduled.</summary>
    Task SendInterviewScheduledToCandidateAsync(string toEmail, string candidateName, string interviewTitle,
        DateTime scheduledAtUtc, int durationMinutes, string? location, string? interviewType, string? interviewerName,
        string requisitionTitle);

    /// <summary>Notifies the assigned interviewer that an interview has been scheduled.</summary>
    Task SendInterviewScheduledToInterviewerAsync(string toEmail, string interviewerName, string candidateName,
        string interviewTitle, DateTime scheduledAtUtc, int durationMinutes, string? location, string? interviewType,
        string requisitionTitle);

    Task<bool> IsConfiguredAsync();

    /// <summary>Sends HR/recruitment inbox a notice that someone applied (uses SendGrid when SendGrid:ApiKey is set).</summary>
    Task SendJobApplicationNotificationToInboxAsync(string inboxEmail, string candidateName, string candidateEmail, string? phone,
        string requisitionTitle, string requisitionCode, Guid candidateId, bool resumePdfUploaded);
}
