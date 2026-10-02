namespace OpenSkyHRM.Application.Interfaces;

public interface IEmailService
{
    /// <summary>Sends offer email with the letter as a PDF attachment. Returns PDF bytes when generated.</summary>
    Task<byte[]?> SendOfferEmailAsync(string toEmail, string candidateName, string positionTitle,
        decimal salary, string currency, DateTime? joiningDate, string? remarks, string? customLetterHtml = null,
        string? offerResponseUrl = null,
        CancellationToken cancellationToken = default);

    /// <summary>Sends a confirmation to the employee who submitted the leave request.</summary>
    Task SendLeaveApplicationConfirmationAsync(string toEmail, string employeeName, string leaveTypeName,
        DateTime startDate, DateTime endDate, decimal totalDays, string status, string? reason);

    /// <summary>Notifies the employee's supervisor that a leave request is waiting for approval.</summary>
    Task SendLeaveApplicationToSupervisorAsync(string toEmail, string supervisorName, string employeeName,
        string leaveTypeName, DateTime startDate, DateTime endDate, decimal totalDays, string status, string? reason,
        Guid? leaveRequestId = null);

    /// <summary>Notifies the covering person that they are named on a leave request.</summary>
    Task SendLeaveApplicationToCoveringPersonAsync(string toEmail, string coveringPersonName, string employeeName,
        string leaveTypeName, DateTime startDate, DateTime endDate, decimal totalDays, string status, string? reason);

    /// <summary>Tells the employee that their leave request was approved.</summary>
    Task SendLeaveApprovedToEmployeeAsync(string toEmail, string employeeName, string leaveTypeName,
        DateTime startDate, DateTime endDate, decimal totalDays, string? remarks, string? approverName);

    /// <summary>Tells the employee that their leave request was rejected.</summary>
    Task SendLeaveRejectedToEmployeeAsync(string toEmail, string employeeName, string leaveTypeName,
        DateTime startDate, DateTime endDate, decimal totalDays, string? remarks, string? approverName);

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
