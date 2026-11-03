using System.Globalization;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Mail;
using System.Net.Sockets;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using OpenSkyHRM.Application.Common;
using OpenSkyHRM.Application.Interfaces;
using OpenSkyHRM.Domain.Entities;
using OpenSkyHRM.Persistence;
using OpenSkyHRM.Persistence.Seeders;

namespace OpenSkyHRM.Application.Services;

public class EmailService : IEmailService
{
    public const string CategoryRecruitmentOffer = "RecruitmentOffer";
    public const string CategoryRecruitmentInterview = "RecruitmentInterview";
    public const string CategoryRecruitmentJobApplication = "RecruitmentJobApplication";
    public const string CategoryLeaveApplication = "LeaveApplication";
    public const string CategoryTraining = "Training";

    private readonly IConfiguration _config;
    private readonly ILogger<EmailService> _logger;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IEmailDeliveryLogWriter _deliveryLog;
    private readonly AppDbContext _db;
    private readonly IHtmlToPdfService _htmlToPdf;
    private readonly IPublicAppUrlAccessor _appUrl;

    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull,
    };

    public EmailService(
        IConfiguration config,
        ILogger<EmailService> logger,
        IHttpClientFactory httpClientFactory,
        IEmailDeliveryLogWriter deliveryLog,
        AppDbContext db,
        IHtmlToPdfService htmlToPdf,
        IPublicAppUrlAccessor appUrl)
    {
        _config = config;
        _logger = logger;
        _httpClientFactory = httpClientFactory;
        _deliveryLog = deliveryLog;
        _db = db;
        _htmlToPdf = htmlToPdf;
        _appUrl = appUrl;
    }

    private string? GetSendGridApiKey() => OutboundEmailConfiguration.GetSendGridApiKey(_config);

    public Task<bool> IsConfiguredAsync() =>
        Task.FromResult(OutboundEmailConfiguration.IsEmailProviderConfigured(_config));

    public async Task<byte[]?> SendOfferEmailAsync(string toEmail, string candidateName, string positionTitle,
        decimal salary, string currency, DateTime? joiningDate, string? remarks, string? customLetterHtml = null,
        string? offerResponseUrl = null,
        CancellationToken cancellationToken = default)
    {
        string letterHtml;
        string subject;

        if (!string.IsNullOrWhiteSpace(customLetterHtml))
        {
            var posEncoded = WebUtility.HtmlEncode(positionTitle);
            var subjReplacements = new Dictionary<string, string>(StringComparer.Ordinal)
            {
                ["{{PositionTitle}}"] = posEncoded,
            };
            var offerSubject = $"Offer of Employment – {posEncoded}";
            (subject, _) = await ResolveTransactionalEmailAsync(
                TransactionalEmailTemplateSeeder.RecruitmentOfferKey,
                subjReplacements,
                offerSubject,
                subjReplacements,
                () => "");
            letterHtml = customLetterHtml;
        }
        else
        {
            var encName = WebUtility.HtmlEncode(candidateName);
            var encPos = WebUtility.HtmlEncode(positionTitle);
            var salaryFormatted = WebUtility.HtmlEncode($"{currency} {salary:N0}");
            var joiningText = WebUtility.HtmlEncode(joiningDate.HasValue ? joiningDate.Value.ToString("dd MMM yyyy") : "—");
            var remarksHtml = string.IsNullOrWhiteSpace(remarks)
                ? ""
                : $"<p style=\"font-size: 14px; line-height: 1.6; color: #555; margin: 0 0 20px;\">{WebUtility.HtmlEncode(remarks)}</p>";

            var bodyReplacements = new Dictionary<string, string>(StringComparer.Ordinal)
            {
                ["{{CandidateName}}"] = encName,
                ["{{PositionTitle}}"] = encPos,
                ["{{SalaryFormatted}}"] = salaryFormatted,
                ["{{JoiningDate}}"] = joiningText,
                ["{{RemarksHtml}}"] = remarksHtml,
            };

            var subjectReplacements = new Dictionary<string, string>(StringComparer.Ordinal)
            {
                ["{{PositionTitle}}"] = encPos,
            };

            var defaultSubject = $"Offer of Employment – {encPos}";
            (subject, letterHtml) = await ResolveTransactionalEmailAsync(
                TransactionalEmailTemplateSeeder.RecruitmentOfferKey,
                bodyReplacements,
                defaultSubject,
                subjectReplacements,
                () => BuildOfferHtml(candidateName, positionTitle, salary, currency, joiningDate, remarks));
        }

        byte[] pdfBytes;
        string emailHtml;
        try
        {
            var actionsHtml = string.IsNullOrWhiteSpace(offerResponseUrl)
                ? ""
                : OfferLetterHelper.BuildOfferActionsHtml(offerResponseUrl);
            var letterForEmail = OfferLetterHelper.InjectOfferActions(letterHtml, actionsHtml);
            pdfBytes = await _htmlToPdf.ConvertHtmlToPdfAsync(WrapOfferLetterHtmlForPdf(letterForEmail), cancellationToken);
            emailHtml = BuildOfferEmailCoverHtml(candidateName, positionTitle, offerResponseUrl);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Could not generate offer letter PDF for {Email}", toEmail);
            throw new InvalidOperationException("Could not generate the offer letter PDF. Please try again.", ex);
        }

        var attachmentName = BuildOfferPdfFileName(candidateName, positionTitle);
        var attachment = new EmailAttachment(attachmentName, "application/pdf", pdfBytes);

        await SendHtmlEmailAsync(
            toEmail,
            candidateName,
            subject,
            emailHtml,
            CategoryRecruitmentOffer,
            new[] { attachment },
            cancellationToken);

        return pdfBytes;
    }

    public async Task SendLeaveApplicationConfirmationAsync(string toEmail, string employeeName, string leaveTypeName,
        DateTime startDate, DateTime endDate, decimal totalDays, string status, string? reason)
    {
        var safeName = WebUtility.HtmlEncode(employeeName);
        var safeType = WebUtility.HtmlEncode(leaveTypeName);
        var safeStatus = WebUtility.HtmlEncode(status);
        var safeReason = string.IsNullOrWhiteSpace(reason) ? "—" : WebUtility.HtmlEncode(reason);
        var start = startDate.ToString("dd MMM yyyy");
        var end = endDate.ToString("dd MMM yyyy");
        var days = totalDays.ToString("F1");

        var bodyReplacements = new Dictionary<string, string>(StringComparer.Ordinal)
        {
            ["{{EmployeeName}}"] = safeName,
            ["{{LeaveTypeName}}"] = safeType,
            ["{{StartDate}}"] = start,
            ["{{EndDate}}"] = end,
            ["{{TotalDays}}"] = days,
            ["{{Status}}"] = safeStatus,
            ["{{Reason}}"] = safeReason,
        };

        const string defaultSubject = "Leave request received";
        var (subject, body) = await ResolveTransactionalEmailAsync(
            TransactionalEmailTemplateSeeder.LeaveApplicationKey,
            bodyReplacements,
            defaultSubject,
            bodyReplacements,
            () => BuildLeaveApplicationHtml(employeeName, leaveTypeName, startDate, endDate, totalDays, status, reason));

        await SendHtmlEmailAsync(toEmail, employeeName, subject, body, CategoryLeaveApplication);
    }

    public async Task SendLeaveApplicationToSupervisorAsync(string toEmail, string supervisorName, string employeeName,
        string leaveTypeName, DateTime startDate, DateTime endDate, decimal totalDays, string status, string? reason,
        Guid? leaveRequestId = null)
    {
        var safeSupervisor = WebUtility.HtmlEncode(supervisorName);
        var safeName = WebUtility.HtmlEncode(employeeName);
        var safeType = WebUtility.HtmlEncode(leaveTypeName);
        var safeStatus = WebUtility.HtmlEncode(status);
        var safeReason = string.IsNullOrWhiteSpace(reason) ? "—" : WebUtility.HtmlEncode(reason);
        var approvalUrl = await ResolveLeaveApprovalPageUrlAsync(leaveRequestId);
        var safeApprovalUrl = WebUtility.HtmlEncode(approvalUrl ?? "");
        var start = startDate.ToString("dd MMM yyyy");
        var end = endDate.ToString("dd MMM yyyy");
        var days = totalDays.ToString("F1");

        var bodyReplacements = new Dictionary<string, string>(StringComparer.Ordinal)
        {
            ["{{SupervisorName}}"] = safeSupervisor,
            ["{{EmployeeName}}"] = safeName,
            ["{{LeaveTypeName}}"] = safeType,
            ["{{StartDate}}"] = start,
            ["{{EndDate}}"] = end,
            ["{{TotalDays}}"] = days,
            ["{{Status}}"] = safeStatus,
            ["{{Reason}}"] = safeReason,
            ["{{ApprovalUrl}}"] = safeApprovalUrl,
        };

        const string defaultSubject = "{{EmployeeName}} submitted a leave request";
        var (subject, body) = await ResolveTransactionalEmailAsync(
            TransactionalEmailTemplateSeeder.LeaveApplicationSupervisorKey,
            bodyReplacements,
            defaultSubject,
            bodyReplacements,
            () => BuildLeaveApplicationSupervisorHtml(supervisorName, employeeName, leaveTypeName, startDate, endDate, totalDays, status, reason, approvalUrl));

        body = EnsureLeaveApprovalShortcut(body, approvalUrl);
        body = RewriteLoopbackApprovalLinks(body, approvalUrl);

        await SendHtmlEmailAsync(toEmail, supervisorName, subject, body, CategoryLeaveApplication);
    }

    public async Task SendLeaveApplicationToCoveringPersonAsync(string toEmail, string coveringPersonName, string employeeName,
        string leaveTypeName, DateTime startDate, DateTime endDate, decimal totalDays, string status, string? reason)
    {
        var safeCovering = WebUtility.HtmlEncode(coveringPersonName);
        var safeName = WebUtility.HtmlEncode(employeeName);
        var safeType = WebUtility.HtmlEncode(leaveTypeName);
        var safeStatus = WebUtility.HtmlEncode(status);
        var safeReason = string.IsNullOrWhiteSpace(reason) ? "—" : WebUtility.HtmlEncode(reason);
        var start = startDate.ToString("dd MMM yyyy");
        var end = endDate.ToString("dd MMM yyyy");
        var days = totalDays.ToString("F1");

        var bodyReplacements = new Dictionary<string, string>(StringComparer.Ordinal)
        {
            ["{{CoveringPersonName}}"] = safeCovering,
            ["{{EmployeeName}}"] = safeName,
            ["{{LeaveTypeName}}"] = safeType,
            ["{{StartDate}}"] = start,
            ["{{EndDate}}"] = end,
            ["{{TotalDays}}"] = days,
            ["{{Status}}"] = safeStatus,
            ["{{Reason}}"] = safeReason,
        };

        const string defaultSubject = "You are covering for {{EmployeeName}}";
        var (subject, body) = await ResolveTransactionalEmailAsync(
            TransactionalEmailTemplateSeeder.LeaveApplicationCoveringKey,
            bodyReplacements,
            defaultSubject,
            bodyReplacements,
            () => BuildLeaveApplicationCoveringHtml(coveringPersonName, employeeName, leaveTypeName, startDate, endDate, totalDays, status, reason));

        await SendHtmlEmailAsync(toEmail, coveringPersonName, subject, body, CategoryLeaveApplication);
    }

    public async Task SendLeaveApprovedToEmployeeAsync(string toEmail, string employeeName, string leaveTypeName,
        DateTime startDate, DateTime endDate, decimal totalDays, string? remarks, string? approverName)
    {
        await SendLeaveDecisionToEmployeeAsync(
            TransactionalEmailTemplateSeeder.LeaveApprovedKey,
            "Leave request approved",
            toEmail,
            employeeName,
            leaveTypeName,
            startDate,
            endDate,
            totalDays,
            remarks,
            approverName,
            approved: true);
    }

    public async Task SendLeaveRejectedToEmployeeAsync(string toEmail, string employeeName, string leaveTypeName,
        DateTime startDate, DateTime endDate, decimal totalDays, string? remarks, string? approverName)
    {
        await SendLeaveDecisionToEmployeeAsync(
            TransactionalEmailTemplateSeeder.LeaveRejectedKey,
            "Leave request rejected",
            toEmail,
            employeeName,
            leaveTypeName,
            startDate,
            endDate,
            totalDays,
            remarks,
            approverName,
            approved: false);
    }

    private async Task SendLeaveDecisionToEmployeeAsync(
        string templateKey,
        string defaultSubject,
        string toEmail,
        string employeeName,
        string leaveTypeName,
        DateTime startDate,
        DateTime endDate,
        decimal totalDays,
        string? remarks,
        string? approverName,
        bool approved)
    {
        var safeName = WebUtility.HtmlEncode(employeeName);
        var safeType = WebUtility.HtmlEncode(leaveTypeName);
        var safeRemarks = string.IsNullOrWhiteSpace(remarks) ? "—" : WebUtility.HtmlEncode(remarks);
        var safeApprover = string.IsNullOrWhiteSpace(approverName) ? "your supervisor" : WebUtility.HtmlEncode(approverName);
        var status = approved ? "Approved" : "Rejected";
        var start = startDate.ToString("dd MMM yyyy");
        var end = endDate.ToString("dd MMM yyyy");
        var days = totalDays.ToString("F1");

        var bodyReplacements = new Dictionary<string, string>(StringComparer.Ordinal)
        {
            ["{{EmployeeName}}"] = safeName,
            ["{{LeaveTypeName}}"] = safeType,
            ["{{StartDate}}"] = start,
            ["{{EndDate}}"] = end,
            ["{{TotalDays}}"] = days,
            ["{{Status}}"] = status,
            ["{{Remarks}}"] = safeRemarks,
            ["{{ApproverName}}"] = safeApprover,
        };

        var (subject, body) = await ResolveTransactionalEmailAsync(
            templateKey,
            bodyReplacements,
            defaultSubject,
            bodyReplacements,
            () => BuildLeaveDecisionHtml(employeeName, leaveTypeName, startDate, endDate, totalDays, remarks, approverName, approved));

        await SendHtmlEmailAsync(toEmail, employeeName, subject, body, CategoryLeaveApplication);
    }

    public async Task SendTrainingAssignedAsync(string toEmail, string employeeName, string courseTitle,
        DateTime? dueDate)
    {
        var safeName = WebUtility.HtmlEncode(employeeName);
        var safeCourse = WebUtility.HtmlEncode(courseTitle);
        var dueText = dueDate.HasValue
            ? WebUtility.HtmlEncode(dueDate.Value.ToString("dd MMM yyyy"))
            : "—";
        var subject = $"Training assigned: {courseTitle}";
        var body =
            $"<p style=\"font-size:14px;line-height:1.6;color:#333;\">Hi {safeName},</p>" +
            $"<p style=\"font-size:14px;line-height:1.6;color:#333;\">You have been assigned training: <strong>{safeCourse}</strong>.</p>" +
            $"<p style=\"font-size:14px;line-height:1.6;color:#333;\">Due date: <strong>{dueText}</strong></p>" +
            "<p style=\"font-size:14px;line-height:1.6;color:#555;\">Please complete this in OpenSky HRM Learning.</p>";
        await SendHtmlEmailAsync(toEmail, employeeName, subject, body, CategoryTraining);
    }

    public async Task SendTrainingOverdueReminderAsync(string toEmail, string employeeName, string courseTitle,
        DateTime dueDate)
    {
        var safeName = WebUtility.HtmlEncode(employeeName);
        var safeCourse = WebUtility.HtmlEncode(courseTitle);
        var due = WebUtility.HtmlEncode(dueDate.ToString("dd MMM yyyy"));
        var subject = $"Overdue training: {courseTitle}";
        var body =
            $"<p style=\"font-size:14px;line-height:1.6;color:#333;\">Hi {safeName},</p>" +
            $"<p style=\"font-size:14px;line-height:1.6;color:#b45309;\">Your training <strong>{safeCourse}</strong> was due on <strong>{due}</strong> and is now overdue.</p>" +
            "<p style=\"font-size:14px;line-height:1.6;color:#555;\">Please complete it or contact HR if you need an extension.</p>";
        await SendHtmlEmailAsync(toEmail, employeeName, subject, body, CategoryTraining);
    }

    public async Task SendInterviewScheduledToCandidateAsync(string toEmail, string candidateName, string interviewTitle,
        DateTime scheduledAtUtc, int durationMinutes, string? location, string? interviewType, string? interviewerName,
        string requisitionTitle)
    {
        var scheduledText = scheduledAtUtc.Kind == DateTimeKind.Unspecified
            ? DateTime.SpecifyKind(scheduledAtUtc, DateTimeKind.Utc)
            : scheduledAtUtc.ToUniversalTime();
        var scheduledDisplay = scheduledText.ToString("dddd, dd MMM yyyy HH:mm", CultureInfo.InvariantCulture) + " UTC";
        var loc = string.IsNullOrWhiteSpace(location) ? "—" : location;
        var type = string.IsNullOrWhiteSpace(interviewType) ? "—" : interviewType;
        var ivName = string.IsNullOrWhiteSpace(interviewerName) ? "—" : interviewerName;

        var bodyReplacements = new Dictionary<string, string>(StringComparer.Ordinal)
        {
            ["{{CandidateName}}"] = WebUtility.HtmlEncode(candidateName),
            ["{{InterviewTitle}}"] = WebUtility.HtmlEncode(interviewTitle),
            ["{{ScheduledAt}}"] = WebUtility.HtmlEncode(scheduledDisplay),
            ["{{DurationMinutes}}"] = WebUtility.HtmlEncode(durationMinutes.ToString(CultureInfo.InvariantCulture)),
            ["{{Location}}"] = WebUtility.HtmlEncode(loc),
            ["{{InterviewType}}"] = WebUtility.HtmlEncode(type),
            ["{{InterviewerName}}"] = WebUtility.HtmlEncode(ivName),
            ["{{RequisitionTitle}}"] = WebUtility.HtmlEncode(requisitionTitle),
        };

        var defaultSubject = $"Interview scheduled: {interviewTitle}";
        var (subject, body) = await ResolveTransactionalEmailAsync(
            TransactionalEmailTemplateSeeder.RecruitmentInterviewCandidateKey,
            bodyReplacements,
            defaultSubject,
            bodyReplacements,
            () => BuildInterviewCandidateHtml(candidateName, interviewTitle, scheduledDisplay, durationMinutes, loc, type, ivName, requisitionTitle));

        await SendHtmlEmailAsync(toEmail, candidateName, subject, body, CategoryRecruitmentInterview);
    }

    public async Task SendInterviewScheduledToInterviewerAsync(string toEmail, string interviewerName, string candidateName,
        string interviewTitle, DateTime scheduledAtUtc, int durationMinutes, string? location, string? interviewType,
        string requisitionTitle)
    {
        var scheduledText = scheduledAtUtc.Kind == DateTimeKind.Unspecified
            ? DateTime.SpecifyKind(scheduledAtUtc, DateTimeKind.Utc)
            : scheduledAtUtc.ToUniversalTime();
        var scheduledDisplay = scheduledText.ToString("dddd, dd MMM yyyy HH:mm", CultureInfo.InvariantCulture) + " UTC";
        var loc = string.IsNullOrWhiteSpace(location) ? "—" : location;
        var type = string.IsNullOrWhiteSpace(interviewType) ? "—" : interviewType;

        var bodyReplacements = new Dictionary<string, string>(StringComparer.Ordinal)
        {
            ["{{InterviewerName}}"] = WebUtility.HtmlEncode(interviewerName),
            ["{{CandidateName}}"] = WebUtility.HtmlEncode(candidateName),
            ["{{InterviewTitle}}"] = WebUtility.HtmlEncode(interviewTitle),
            ["{{ScheduledAt}}"] = WebUtility.HtmlEncode(scheduledDisplay),
            ["{{DurationMinutes}}"] = WebUtility.HtmlEncode(durationMinutes.ToString(CultureInfo.InvariantCulture)),
            ["{{Location}}"] = WebUtility.HtmlEncode(loc),
            ["{{InterviewType}}"] = WebUtility.HtmlEncode(type),
            ["{{RequisitionTitle}}"] = WebUtility.HtmlEncode(requisitionTitle),
        };

        var defaultSubject = $"You are scheduled to interview: {candidateName}";
        var (subject, body) = await ResolveTransactionalEmailAsync(
            TransactionalEmailTemplateSeeder.RecruitmentInterviewInterviewerKey,
            bodyReplacements,
            defaultSubject,
            bodyReplacements,
            () => BuildInterviewInterviewerHtml(interviewerName, candidateName, interviewTitle, scheduledDisplay, durationMinutes, loc, type, requisitionTitle));

        await SendHtmlEmailAsync(toEmail, interviewerName, subject, body, CategoryRecruitmentInterview);
    }

    public async Task SendJobApplicationNotificationToInboxAsync(string inboxEmail, string candidateName, string candidateEmail,
        string? phone, string requisitionTitle, string requisitionCode, Guid candidateId, bool resumePdfUploaded)
    {
        var safeName = WebUtility.HtmlEncode(candidateName);
        var safeEmail = WebUtility.HtmlEncode(candidateEmail);
        var safePhone = string.IsNullOrWhiteSpace(phone) ? "—" : WebUtility.HtmlEncode(phone);
        var safeReqTitle = WebUtility.HtmlEncode(requisitionTitle);
        var safeReqCode = WebUtility.HtmlEncode(requisitionCode);
        var resumeLine = resumePdfUploaded ? "A PDF resume was uploaded with this application." : "No resume file was attached.";
        var subject = $"New application: {requisitionTitle} — {candidateName}";
        var mailtoHref = "mailto:" + Uri.EscapeDataString(candidateEmail);
        var body = $@"<!DOCTYPE html>
<html><head><meta charset=""utf-8""></head>
<body style=""font-family:'Segoe UI',Arial,sans-serif;color:#1a1a2e;margin:0;padding:0;background:#f5f6fa;"">
  <div style=""max-width:600px;margin:20px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);"">
    <div style=""background:linear-gradient(135deg,#1e3a5f 0%,#2B7DE9 100%);padding:24px 32px;color:white;"">
      <h1 style=""margin:0;font-size:20px;font-weight:600;"">New job application received</h1>
      <p style=""margin:8px 0 0;opacity:0.9;font-size:14px;"">OpenSky HRM · Recruitment</p>
    </div>
    <div style=""padding:28px 32px;"">
      <p style=""font-size:15px;line-height:1.6;margin:0 0 16px;"">Someone applied for <strong>{safeReqTitle}</strong> <span style=""color:#64748b;font-size:13px;"">({safeReqCode})</span>.</p>
      <table style=""width:100%;border-collapse:collapse;font-size:14px;line-height:1.7;color:#334155;"">
        <tr><td style=""padding:6px 0;width:120px;vertical-align:top;color:#64748b;"">Name</td><td style=""padding:6px 0;""><strong>{safeName}</strong></td></tr>
        <tr><td style=""padding:6px 0;vertical-align:top;color:#64748b;"">Email</td><td style=""padding:6px 0;""><a href=""{mailtoHref}"" style=""color:#2563eb;"">{safeEmail}</a></td></tr>
        <tr><td style=""padding:6px 0;vertical-align:top;color:#64748b;"">Phone</td><td style=""padding:6px 0;"">{safePhone}</td></tr>
        <tr><td style=""padding:6px 0;vertical-align:top;color:#64748b;"">Candidate ID</td><td style=""padding:6px 0;font-family:ui-monospace,monospace;font-size:13px;"">{candidateId}</td></tr>
      </table>
      <p style=""font-size:13px;color:#64748b;margin:20px 0 0;"">{resumeLine} Open this candidate in OpenSky HRM Recruitment to review and move stages.</p>
    </div>
  </div>
</body></html>";
        var displayName = "Recruitment inbox";
        await SendHtmlEmailAsync(inboxEmail, displayName, subject, body, CategoryRecruitmentJobApplication);
    }

    private async Task<(string Subject, string Html)> ResolveTransactionalEmailAsync(
        string templateKey,
        Dictionary<string, string> bodyReplacements,
        string defaultSubject,
        Dictionary<string, string>? subjectReplacements,
        Func<string> fallbackHtml)
    {
        var row = await _db.Set<DocumentTemplate>().AsNoTracking()
            .FirstOrDefaultAsync(t => t.TemplateKey == templateKey && t.IsActive);
        if (row is null || string.IsNullOrWhiteSpace(row.HtmlContent))
            return (ApplyTemplate(defaultSubject, subjectReplacements ?? bodyReplacements), fallbackHtml());

        var html = ApplyTemplate(row.HtmlContent, bodyReplacements);
        var subjTemplate = string.IsNullOrWhiteSpace(row.Subject) ? defaultSubject : row.Subject;
        var subject = ApplyTemplate(subjTemplate, subjectReplacements ?? bodyReplacements);
        return (subject, html);
    }

    private static string ApplyTemplate(string template, IReadOnlyDictionary<string, string> values)
    {
        var result = template;
        foreach (var kv in values)
            result = result.Replace(kv.Key, kv.Value, StringComparison.Ordinal);
        return result;
    }

    private async Task SendHtmlEmailAsync(
        string toEmail,
        string toDisplayName,
        string subject,
        string htmlBody,
        string category,
        IReadOnlyList<EmailAttachment>? attachments = null,
        CancellationToken cancellationToken = default)
    {
        var fromEmail = _config["SendGrid:FromEmail"] ?? _config["Smtp:From"] ?? "hr@openskyhrm.com";
        var sendGridKey = GetSendGridApiKey();
        if (!string.IsNullOrWhiteSpace(sendGridKey))
        {
            await SendViaSendGridAsync(toEmail, toDisplayName, subject, htmlBody, sendGridKey, category, fromEmail, attachments, cancellationToken);
            return;
        }

        await SendViaSmtpAsync(toEmail, toDisplayName, subject, htmlBody, category, fromEmail, attachments, cancellationToken);
    }

    private async Task TryPersistLogAsync(EmailDeliveryLogEntry entry)
    {
        try
        {
            await _deliveryLog.WriteAsync(entry);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Could not persist outbound email audit row for {Recipient} subject {Subject}", entry.RecipientEmail, entry.Subject);
        }
    }

    private async Task SendViaSendGridAsync(
        string toEmail,
        string toName,
        string subject,
        string htmlBody,
        string apiKey,
        string category,
        string fromEmail,
        IReadOnlyList<EmailAttachment>? attachments = null,
        CancellationToken cancellationToken = default)
    {
        var apiUrl = _config["SendGrid:ApiUrl"] ?? "https://api.sendgrid.com/v3/mail/send";
        var fromName = _config["SendGrid:FromName"] ?? _config["Smtp:FromName"] ?? "OpenSky HRM";
        var replyToEmail = _config["SendGrid:ReplyTo"]?.Trim();
        if (string.IsNullOrWhiteSpace(replyToEmail))
            replyToEmail = fromEmail;

        object[]? sendGridAttachments = null;
        if (attachments is { Count: > 0 })
        {
            sendGridAttachments = attachments
                .Select(a => new
                {
                    content = Convert.ToBase64String(a.Content),
                    type = a.ContentType,
                    filename = a.FileName,
                    disposition = "attachment",
                })
                .ToArray();
        }

        var plainText = HtmlToPlainText(htmlBody);
        var payload = new
        {
            Personalizations = new[]
            {
                new { To = new[] { new { Email = toEmail, Name = toName } } },
            },
            From = new { Email = fromEmail, Name = fromName },
            ReplyTo = new { Email = replyToEmail, Name = fromName },
            Subject = subject,
            Content = new object[]
            {
                new { Type = "text/plain", Value = plainText },
                new { Type = "text/html", Value = htmlBody },
            },
            Attachments = sendGridAttachments,
            Categories = new[] { category },
            MailSettings = new
            {
                Footer = new { Enable = false },
                SandboxMode = new { Enable = false },
            },
            TrackingSettings = new
            {
                ClickTracking = new { Enable = false, EnableText = false },
                OpenTracking = new { Enable = false },
                SubscriptionTracking = new { Enable = false },
            },
        };

        var json = JsonSerializer.Serialize(payload, JsonOpts);
        using var req = new HttpRequestMessage(HttpMethod.Post, apiUrl)
        {
            Content = new StringContent(json, Encoding.UTF8, "application/json"),
        };
        req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);

        var client = _httpClientFactory.CreateClient();
        client.Timeout = TimeSpan.FromSeconds(60);

        using var resp = await client.SendAsync(req, cancellationToken);
        var code = (int)resp.StatusCode;
        if (!resp.IsSuccessStatusCode)
        {
            var err = await resp.Content.ReadAsStringAsync(cancellationToken);
            _logger.LogError("SendGrid failed ({Status}): {Body}", code, err);
            await TryPersistLogAsync(new EmailDeliveryLogEntry(
                category, toEmail, toName, subject, "Failed", "SendGrid", code, fromEmail, err));
            throw new InvalidOperationException($"SendGrid returned {code}. Check API key and sender verification.");
        }

        await TryPersistLogAsync(new EmailDeliveryLogEntry(
            category, toEmail, toName, subject, "Sent", "SendGrid", code, fromEmail, null));
        _logger.LogInformation("Email sent via SendGrid to {Email} subject {Subject}", toEmail, subject);
    }

    private async Task SendViaSmtpAsync(
        string toEmail,
        string toDisplayName,
        string subject,
        string body,
        string category,
        string fromEmailResolved,
        IReadOnlyList<EmailAttachment>? attachments = null,
        CancellationToken cancellationToken = default)
    {
        var host = _config["Smtp:Host"];
        var portStr = _config["Smtp:Port"] ?? "587";
        var from = _config["Smtp:From"] ?? "hr@openskyhrm.com";
        var fromName = _config["Smtp:FromName"] ?? "OpenSky HRM";
        var username = _config["Smtp:Username"];
        var password = _config["Smtp:Password"];
        var enableSsl = _config["Smtp:EnableSsl"] != "false";

        if (string.IsNullOrWhiteSpace(host))
        {
            _logger.LogWarning(
                "Email not delivered: set SendGrid:ApiKey or Smtp:Host (and credentials). Until then, messages are logged only. Intended recipient: {Email}, subject: {Subject}.",
                toEmail, subject);
            _logger.LogInformation(
                "EMAIL (not sent — no email provider configured):\nTo: {To}\nSubject: {Subject}",
                toEmail, subject);
            await TryPersistLogAsync(new EmailDeliveryLogEntry(
                category,
                toEmail,
                toDisplayName,
                subject,
                "SkippedNotConfigured",
                "None",
                null,
                fromEmailResolved,
                "Neither SendGrid:ApiKey nor Smtp:Host is configured; message was not sent."));
            return;
        }

        using var msg = new MailMessage();
        msg.From = new MailAddress(from, fromName);
        msg.To.Add(new MailAddress(toEmail, toDisplayName));
        msg.Subject = subject;
        msg.IsBodyHtml = true;
        msg.Body = body;
        msg.AlternateViews.Add(AlternateView.CreateAlternateViewFromString(HtmlToPlainText(body), null, "text/plain"));

        if (attachments is { Count: > 0 })
        {
            foreach (var attachment in attachments)
            {
                var stream = new MemoryStream(attachment.Content, writable: false);
                msg.Attachments.Add(new Attachment(stream, attachment.FileName, attachment.ContentType));
            }
        }

        try
        {
            using var client = new SmtpClient(host, int.Parse(portStr));
            client.EnableSsl = enableSsl;
            if (!string.IsNullOrWhiteSpace(username))
                client.Credentials = new NetworkCredential(username, password);

            await client.SendMailAsync(msg);
            await TryPersistLogAsync(new EmailDeliveryLogEntry(
                category, toEmail, toDisplayName, subject, "Sent", "Smtp", null, from, null));
            _logger.LogInformation("Email sent via SMTP to {Email} subject {Subject}", toEmail, subject);
        }
        catch (Exception ex)
        {
            var detail = BuildSmtpFailureDetail(ex, host, portStr);
            await TryPersistLogAsync(new EmailDeliveryLogEntry(
                category, toEmail, toDisplayName, subject, "Failed", "Smtp", null, from, detail));
            _logger.LogWarning(ex, "SMTP send failed to {Recipient} via {Host}:{Port}", toEmail, host, portStr);
            throw;
        }
    }

    private static string HtmlToPlainText(string html)
    {
        if (string.IsNullOrWhiteSpace(html))
            return string.Empty;

        var text = html;
        text = Regex.Replace(text, @"<br\s*/?>", "\n", RegexOptions.IgnoreCase);
        text = Regex.Replace(text, @"</p>", "\n\n", RegexOptions.IgnoreCase);
        text = Regex.Replace(text, @"</div>", "\n", RegexOptions.IgnoreCase);
        text = Regex.Replace(text, @"<a[^>]+href=""([^""]+)""[^>]*>([^<]*)</a>", "$2 ($1)", RegexOptions.IgnoreCase);
        text = Regex.Replace(text, "<[^>]+>", string.Empty);
        text = WebUtility.HtmlDecode(text);
        text = Regex.Replace(text, @"[ \t]+\n", "\n");
        text = Regex.Replace(text, @"\n{3,}", "\n\n");
        return text.Trim();
    }

    /// <summary>Human-readable SMTP failure for logs (OutboundEmailLogs.ErrorDetail is capped at 4000 chars).</summary>
    private static string BuildSmtpFailureDetail(Exception ex, string host, string portStr)
    {
        static void AppendInner(StringBuilder sb, Exception? e, int depth)
        {
            if (e is null || depth > 4) return;
            sb.Append(" | ").Append(e.GetType().Name).Append(": ").Append(e.Message.Trim());
            AppendInner(sb, e.InnerException, depth + 1);
        }

        var sb = new StringBuilder(ex.Message.Trim());
        AppendInner(sb, ex.InnerException, 1);
        if (host is "127.0.0.1" or "::1" or "localhost")
        {
            sb.Append(" | Local SMTP (").Append(host).Append(':').Append(portStr).Append("): start Mailpit/MailHog on that port, or use appsettings.Local.json from appsettings.Local.example.json.");
        }
        if (ex is SocketException || ex.InnerException is SocketException)
            sb.Append(" | Often means nothing is listening on the SMTP host/port, or TLS/SSL settings do not match the server (try Smtp:EnableSsl true/false).");
        if (ex is SmtpException smtpEx)
            sb.Append(" | SmtpStatusCode=").Append(smtpEx.StatusCode.ToString());
        sb.Append(" | For real delivery without a local catcher, configure SendGrid:ApiKey and a verified SendGrid:FromEmail.");
        return sb.ToString();
    }

    private static string BuildInterviewCandidateHtml(string candidateName, string interviewTitle, string scheduledDisplay,
        int durationMinutes, string location, string interviewType, string interviewerName, string requisitionTitle)
    {
        var cn = WebUtility.HtmlEncode(candidateName);
        var title = WebUtility.HtmlEncode(interviewTitle);
        var when = WebUtility.HtmlEncode(scheduledDisplay);
        var loc = WebUtility.HtmlEncode(location);
        var typ = WebUtility.HtmlEncode(interviewType);
        var iv = WebUtility.HtmlEncode(interviewerName);
        var req = WebUtility.HtmlEncode(requisitionTitle);
        return $@"<!DOCTYPE html>
<html><head><meta charset=""utf-8""></head>
<body style=""font-family:'Segoe UI',Arial,sans-serif;color:#1a1a2e;margin:0;padding:0;background:#f5f6fa;"">
  <div style=""max-width:600px;margin:20px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);"">
    <div style=""background:linear-gradient(135deg,#1e3a5f 0%,#2B7DE9 100%);padding:28px 36px;color:white;"">
      <h1 style=""margin:0;font-size:22px;font-weight:600;"">Your interview is scheduled</h1>
      <p style=""margin:8px 0 0;opacity:0.9;font-size:14px;"">OpenSky HRM</p>
    </div>
    <div style=""padding:28px 36px;"">
      <p style=""font-size:16px;margin:0 0 16px;"">Hi <strong>{cn}</strong>,</p>
      <p style=""font-size:15px;line-height:1.6;margin:0 0 20px;"">You have been scheduled for an interview for <strong>{req}</strong>.</p>
      <div style=""background:#f8f9fe;border-radius:8px;padding:18px 22px;margin:0 0 20px;"">
        <table style=""width:100%;border-collapse:collapse;font-size:14px;"">
          <tr><td style=""padding:8px 0;color:#666;"">Session</td><td style=""padding:8px 0;font-weight:600;text-align:right;"">{title}</td></tr>
          <tr><td style=""padding:8px 0;color:#666;"">When</td><td style=""padding:8px 0;font-weight:600;text-align:right;"">{when}</td></tr>
          <tr><td style=""padding:8px 0;color:#666;"">Duration</td><td style=""padding:8px 0;font-weight:600;text-align:right;"">{durationMinutes} minutes</td></tr>
          <tr><td style=""padding:8px 0;color:#666;"">Type</td><td style=""padding:8px 0;text-align:right;"">{typ}</td></tr>
          <tr><td style=""padding:8px 0;color:#666;"">Location</td><td style=""padding:8px 0;text-align:right;"">{loc}</td></tr>
          <tr><td style=""padding:8px 0;color:#666;"">Interviewer</td><td style=""padding:8px 0;text-align:right;"">{iv}</td></tr>
        </table>
      </div>
      <p style=""font-size:14px;line-height:1.6;color:#555;margin:0;"">If you need to reschedule, please contact HR as soon as possible.</p>
    </div>
    <div style=""background:#f5f6fa;padding:16px 36px;text-align:center;font-size:12px;color:#999;"">This is an automated message from OpenSky HRM.</div>
  </div>
</body></html>";
    }

    private static string BuildInterviewInterviewerHtml(string interviewerName, string candidateName, string interviewTitle,
        string scheduledDisplay, int durationMinutes, string location, string interviewType, string requisitionTitle)
    {
        var iv = WebUtility.HtmlEncode(interviewerName);
        var cn = WebUtility.HtmlEncode(candidateName);
        var title = WebUtility.HtmlEncode(interviewTitle);
        var when = WebUtility.HtmlEncode(scheduledDisplay);
        var loc = WebUtility.HtmlEncode(location);
        var typ = WebUtility.HtmlEncode(interviewType);
        var req = WebUtility.HtmlEncode(requisitionTitle);
        return $@"<!DOCTYPE html>
<html><head><meta charset=""utf-8""></head>
<body style=""font-family:'Segoe UI',Arial,sans-serif;color:#1a1a2e;margin:0;padding:0;background:#f5f6fa;"">
  <div style=""max-width:600px;margin:20px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);"">
    <div style=""background:linear-gradient(135deg,#1a1a2e 0%,#16213e 100%);padding:28px 36px;color:white;"">
      <h1 style=""margin:0;font-size:22px;font-weight:600;"">Interview assignment</h1>
      <p style=""margin:8px 0 0;opacity:0.85;font-size:14px;"">OpenSky HRM</p>
    </div>
    <div style=""padding:28px 36px;"">
      <p style=""font-size:16px;margin:0 0 16px;"">Hi <strong>{iv}</strong>,</p>
      <p style=""font-size:15px;line-height:1.6;margin:0 0 20px;"">You are scheduled to conduct an interview with <strong>{cn}</strong> for <strong>{req}</strong>.</p>
      <div style=""background:#f8f9fe;border-radius:8px;padding:18px 22px;margin:0 0 20px;"">
        <table style=""width:100%;border-collapse:collapse;font-size:14px;"">
          <tr><td style=""padding:8px 0;color:#666;"">Session</td><td style=""padding:8px 0;font-weight:600;text-align:right;"">{title}</td></tr>
          <tr><td style=""padding:8px 0;color:#666;"">When</td><td style=""padding:8px 0;font-weight:600;text-align:right;"">{when}</td></tr>
          <tr><td style=""padding:8px 0;color:#666;"">Duration</td><td style=""padding:8px 0;font-weight:600;text-align:right;"">{durationMinutes} minutes</td></tr>
          <tr><td style=""padding:8px 0;color:#666;"">Type</td><td style=""padding:8px 0;text-align:right;"">{typ}</td></tr>
          <tr><td style=""padding:8px 0;color:#666;"">Location</td><td style=""padding:8px 0;text-align:right;"">{loc}</td></tr>
        </table>
      </div>
      <p style=""font-size:14px;line-height:1.6;color:#555;margin:0;"">Please review the candidate profile in OpenSky HRM before the session.</p>
    </div>
    <div style=""background:#f5f6fa;padding:16px 36px;text-align:center;font-size:12px;color:#999;"">This is an automated message from OpenSky HRM.</div>
  </div>
</body></html>";
    }

    private static string BuildLeaveApplicationCoveringHtml(string coveringPersonName, string employeeName,
        string leaveTypeName, DateTime startDate, DateTime endDate, decimal totalDays, string status, string? reason)
    {
        var safeCovering = WebUtility.HtmlEncode(coveringPersonName);
        var safeName = WebUtility.HtmlEncode(employeeName);
        var safeType = WebUtility.HtmlEncode(leaveTypeName);
        var safeStatus = WebUtility.HtmlEncode(status);
        var safeReason = string.IsNullOrWhiteSpace(reason) ? "—" : WebUtility.HtmlEncode(reason);
        var start = startDate.ToString("dd MMM yyyy");
        var end = endDate.ToString("dd MMM yyyy");

        return $@"
<!DOCTYPE html>
<html>
<head><meta charset=""utf-8""></head>
<body style=""font-family: 'Segoe UI', Arial, sans-serif; color: #1a1a2e; margin: 0; padding: 0; background: #f5f6fa;"">
  <div style=""max-width: 600px; margin: 20px auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,0.08);"">
    <div style=""background: linear-gradient(135deg, #1e3a5f 0%, #2B7DE9 100%); padding: 28px 36px; color: white;"">
      <h1 style=""margin: 0; font-size: 22px; font-weight: 600;"">You are named as covering person</h1>
      <p style=""margin: 8px 0 0; opacity: 0.9; font-size: 14px;"">OpenSky HRM</p>
    </div>
    <div style=""padding: 28px 36px;"">
      <p style=""font-size: 16px; margin: 0 0 16px;"">Hi <strong>{safeCovering}</strong>,</p>
      <p style=""font-size: 15px; line-height: 1.6; margin: 0 0 20px;"">
        <strong>{safeName}</strong> has submitted a leave request and named you as the covering person. The request is currently <strong>{safeStatus}</strong>.
      </p>
      <div style=""background: #f8f9fe; border-radius: 8px; padding: 18px 22px; margin: 0 0 20px;"">
        <table style=""width: 100%; border-collapse: collapse; font-size: 14px;"">
          <tr><td style=""padding: 8px 0; color: #666;"">Employee</td><td style=""padding: 8px 0; font-weight: 600; text-align: right;"">{safeName}</td></tr>
          <tr><td style=""padding: 8px 0; color: #666;"">Leave type</td><td style=""padding: 8px 0; font-weight: 600; text-align: right;"">{safeType}</td></tr>
          <tr><td style=""padding: 8px 0; color: #666;"">Start</td><td style=""padding: 8px 0; font-weight: 600; text-align: right;"">{start}</td></tr>
          <tr><td style=""padding: 8px 0; color: #666;"">End</td><td style=""padding: 8px 0; font-weight: 600; text-align: right;"">{end}</td></tr>
          <tr><td style=""padding: 8px 0; color: #666;"">Total days</td><td style=""padding: 8px 0; font-weight: 600; text-align: right;"">{totalDays:F1}</td></tr>
          <tr><td style=""padding: 8px 0; color: #666;"">Reason</td><td style=""padding: 8px 0; text-align: right;"">{safeReason}</td></tr>
        </table>
      </div>
      <p style=""font-size: 14px; line-height: 1.6; color: #555; margin: 0;"">
        Please be available to cover duties during this period if the request is approved.
      </p>
    </div>
    <div style=""background: #f5f6fa; padding: 16px 36px; text-align: center; font-size: 12px; color: #999;"">
      This is an automated message from OpenSky HRM.
    </div>
  </div>
</body>
</html>";
    }

    /// <summary>
    /// Company site used in emails. Localhost is ignored so a leave submitted on a dev machine
    /// still links the supervisor to the live company site.
    /// </summary>
    private async Task<string?> ResolvePublicWebBaseUrlAsync()
    {
        var settingValues = await _db.SystemSettings.AsNoTracking()
            .Where(s => s.Key == "PublicWebBaseUrl" || s.Key == "CompanyWebsite" || s.Key == "CompanyName")
            .Select(s => new { s.Key, s.Value })
            .ToListAsync();

        string? Setting(string key) =>
            settingValues.FirstOrDefault(s => s.Key == key)?.Value;

        // This deployment's own site first, so Rambank mail never opens Epic (and the reverse).
        var candidates = new[]
        {
            _config["App:PublicWebBaseUrl"],
            _config["Recruitment:CareersBaseUrl"],
            DeriveCompanySiteFromFolder(_config["FileStorage:CompanyFolder"]),
            Setting("PublicWebBaseUrl"),
            _appUrl.TryGetBrowserBaseUrl(),
            DeriveCompanySiteFromName(Setting("CompanyName")),
            Setting("CompanyWebsite"),
            DeriveCompanySiteFromApiHost(_config["Mobile:PublicApiBaseUrl"]),
        };

        foreach (var raw in candidates)
        {
            var companySite = AsCompanyAppUrl(raw);
            if (companySite != null)
                return companySite;
        }

        _logger.LogWarning(
            "Supervisor approval email has no company site URL. Set App:PublicWebBaseUrl to the live company address, for example https://rambank.openskyhrm.com.");
        return null;
    }

    private static string? NormalizeWebBaseUrl(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return null;
        var trimmed = raw.Trim().TrimEnd('/');
        if (!Uri.TryCreate(trimmed, UriKind.Absolute, out var uri)) return null;
        if (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps) return null;
        return uri.GetLeftPart(UriPartial.Authority).TrimEnd('/');
    }

    private static bool IsLoopbackWebUrl(string url)
    {
        return url.Contains("localhost", StringComparison.OrdinalIgnoreCase)
            || url.Contains("127.0.0.1", StringComparison.OrdinalIgnoreCase);
    }

    /// <summary>https://{company}.openskyhrm.com, or null for localhost, API hosts, and other sites.</summary>
    private static string? AsCompanyAppUrl(string? raw)
    {
        var normalized = NormalizeWebBaseUrl(raw);
        if (normalized == null || IsLoopbackWebUrl(normalized)) return null;
        if (!Uri.TryCreate(normalized, UriKind.Absolute, out var uri)) return null;

        var host = uri.Host.ToLowerInvariant();
        if (host.StartsWith("www.", StringComparison.Ordinal))
            host = host[4..];
        if (!host.EndsWith(".openskyhrm.com", StringComparison.Ordinal) || host == "openskyhrm.com")
            return null;
        if (host.Contains("backend", StringComparison.Ordinal))
            return null;

        return $"https://{host}";
    }

    private static string? DeriveCompanySiteFromFolder(string? companyFolder)
    {
        var folder = companyFolder?.Trim().ToLowerInvariant();
        if (string.IsNullOrWhiteSpace(folder) || folder is "default" or "your-company-code")
            return null;
        if (!Regex.IsMatch(folder, "^[a-z0-9]+$"))
            return null;
        return $"https://{folder}.openskyhrm.com";
    }

    private static string? DeriveCompanySiteFromApiHost(string? apiBaseUrl)
    {
        var normalized = NormalizeWebBaseUrl(apiBaseUrl);
        if (normalized == null || !Uri.TryCreate(normalized, UriKind.Absolute, out var uri))
            return null;

        var host = uri.Host.ToLowerInvariant();
        const string marker = "backend.openskyhrm.com";
        if (!host.EndsWith(marker, StringComparison.Ordinal))
            return null;

        var slug = host[..^marker.Length];
        if (string.IsNullOrWhiteSpace(slug) || !Regex.IsMatch(slug, "^[a-z0-9]+$"))
            return null;
        return $"https://{slug}.openskyhrm.com";
    }

    private static readonly string[] KnownCompanySlugs =
    {
        "donandson", "stage2cafe", "cipherlabz", "besttrend", "nexawave", "stagecafe",
        "rambank", "santhastore", "gamma", "tasty", "mbkh", "demo", "epic",
    };

    private static readonly Dictionary<string, string> CompanyNameAliases = new(StringComparer.OrdinalIgnoreCase)
    {
        ["ram bank"] = "rambank",
        ["rambank"] = "rambank",
        ["santha store"] = "santhastore",
        ["santhastore"] = "santhastore",
        ["don & son"] = "donandson",
        ["don and son"] = "donandson",
        ["best trend"] = "besttrend",
        ["nexa wave"] = "nexawave",
        ["nexawave"] = "nexawave",
        ["stage cafe"] = "stagecafe",
        ["cipher labz"] = "cipherlabz",
        ["cipherlabz"] = "cipherlabz",
    };

    private static string? DeriveCompanySiteFromName(string? companyName)
    {
        if (string.IsNullOrWhiteSpace(companyName)) return null;
        var trimmed = companyName.Trim();
        if (CompanyNameAliases.TryGetValue(trimmed, out var alias))
            return $"https://{alias}.openskyhrm.com";

        var slug = Regex.Replace(trimmed.ToLowerInvariant(), "[^a-z0-9]", "");
        if (slug.Length == 0) return null;

        foreach (var known in KnownCompanySlugs)
        {
            if (!slug.StartsWith(known, StringComparison.Ordinal)) continue;
            var remainder = slug[known.Length..];
            if (remainder is "" or "pvt" or "pvtltd" or "ltd" or "limited" or "company" or "plc")
                return $"https://{known}.openskyhrm.com";
        }

        return null;
    }

    private static string RewriteLoopbackApprovalLinks(string html, string? approvalUrl)
    {
        if (string.IsNullOrWhiteSpace(html) || string.IsNullOrWhiteSpace(approvalUrl))
            return html;

        return Regex.Replace(
            html,
            @"https?://(?:localhost|127\.0\.0\.1)(?::\d+)?(?:/[^""'\s<]*)?",
            match =>
            {
                var url = match.Value;
                if (url.Contains("/app/approvals", StringComparison.OrdinalIgnoreCase)
                    || url.Contains("/login", StringComparison.OrdinalIgnoreCase)
                    || url.Contains("requestId=", StringComparison.OrdinalIgnoreCase))
                    return WebUtility.HtmlEncode(approvalUrl);
                return url;
            },
            RegexOptions.IgnoreCase);
    }

    private async Task<string?> ResolveLeaveApprovalPageUrlAsync(Guid? leaveRequestId)
    {
        var baseUrl = await ResolvePublicWebBaseUrlAsync();
        if (string.IsNullOrWhiteSpace(baseUrl)) return null;

        var url = $"{baseUrl}/app/approvals?tab=leave&waiting=1";
        if (leaveRequestId.HasValue && leaveRequestId.Value != Guid.Empty)
            url += $"&requestId={leaveRequestId.Value:D}";
        return url;
    }

    private static string BuildLeaveApprovalButtonHtml(string approvalUrl)
    {
        var safeUrl = WebUtility.HtmlEncode(approvalUrl);
        return $@"
      <p style=""margin: 24px 0 8px; text-align: center;"">
        <a clicktracking=""off"" href=""{safeUrl}"" style=""display:inline-block;background:#2B7DE9;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:600;"">Review waiting approvals</a>
      </p>
      <p style=""font-size: 13px; line-height: 1.55; color: #666; margin: 0; text-align: center;"">
        Sign in with your username and password if prompted, then you will see leave requests waiting for your approval.
        <br />
        <a clicktracking=""off"" href=""{safeUrl}"" style=""color:#2B7DE9;"">{safeUrl}</a>
      </p>";
    }

    private static string EnsureLeaveApprovalShortcut(string html, string? approvalUrl)
    {
        if (string.IsNullOrWhiteSpace(approvalUrl) || string.IsNullOrWhiteSpace(html))
            return html;
        if (html.Contains("/app/approvals", StringComparison.OrdinalIgnoreCase))
            return html;

        var button = BuildLeaveApprovalButtonHtml(approvalUrl);
        const string footer = "This is an automated message from OpenSky HRM.";
        var footerIdx = html.IndexOf(footer, StringComparison.OrdinalIgnoreCase);
        if (footerIdx >= 0)
        {
            var footerDiv = html.LastIndexOf("<div", footerIdx, StringComparison.OrdinalIgnoreCase);
            if (footerDiv >= 0)
                return html.Insert(footerDiv, button);
        }

        return html + button;
    }

    private static string BuildLeaveApplicationSupervisorHtml(string supervisorName, string employeeName,
        string leaveTypeName, DateTime startDate, DateTime endDate, decimal totalDays, string status, string? reason,
        string? approvalUrl)
    {
        var safeSupervisor = WebUtility.HtmlEncode(supervisorName);
        var safeName = WebUtility.HtmlEncode(employeeName);
        var safeType = WebUtility.HtmlEncode(leaveTypeName);
        var safeStatus = WebUtility.HtmlEncode(status);
        var safeReason = string.IsNullOrWhiteSpace(reason) ? "—" : WebUtility.HtmlEncode(reason);
        var start = startDate.ToString("dd MMM yyyy");
        var end = endDate.ToString("dd MMM yyyy");
        var button = string.IsNullOrWhiteSpace(approvalUrl) ? "" : BuildLeaveApprovalButtonHtml(approvalUrl);

        return $@"
<!DOCTYPE html>
<html>
<head><meta charset=""utf-8""></head>
<body style=""font-family: 'Segoe UI', Arial, sans-serif; color: #1a1a2e; margin: 0; padding: 0; background: #f5f6fa;"">
  <div style=""max-width: 600px; margin: 20px auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,0.08);"">
    <div style=""background: linear-gradient(135deg, #1e3a5f 0%, #2B7DE9 100%); padding: 28px 36px; color: white;"">
      <h1 style=""margin: 0; font-size: 22px; font-weight: 600;"">Leave request pending your approval</h1>
      <p style=""margin: 8px 0 0; opacity: 0.9; font-size: 14px;"">OpenSky HRM</p>
    </div>
    <div style=""padding: 28px 36px;"">
      <p style=""font-size: 16px; margin: 0 0 16px;"">Hi <strong>{safeSupervisor}</strong>,</p>
      <p style=""font-size: 15px; line-height: 1.6; margin: 0 0 20px;"">
        <strong>{safeName}</strong> has submitted a leave request and it is now <strong>{safeStatus}</strong>. Please review it in Leave &amp; Absence.
      </p>
      <div style=""background: #f8f9fe; border-radius: 8px; padding: 18px 22px; margin: 0 0 20px;"">
        <table style=""width: 100%; border-collapse: collapse; font-size: 14px;"">
          <tr><td style=""padding: 8px 0; color: #666;"">Employee</td><td style=""padding: 8px 0; font-weight: 600; text-align: right;"">{safeName}</td></tr>
          <tr><td style=""padding: 8px 0; color: #666;"">Leave type</td><td style=""padding: 8px 0; font-weight: 600; text-align: right;"">{safeType}</td></tr>
          <tr><td style=""padding: 8px 0; color: #666;"">Start</td><td style=""padding: 8px 0; font-weight: 600; text-align: right;"">{start}</td></tr>
          <tr><td style=""padding: 8px 0; color: #666;"">End</td><td style=""padding: 8px 0; font-weight: 600; text-align: right;"">{end}</td></tr>
          <tr><td style=""padding: 8px 0; color: #666;"">Total days</td><td style=""padding: 8px 0; font-weight: 600; text-align: right;"">{totalDays:F1}</td></tr>
          <tr><td style=""padding: 8px 0; color: #666;"">Reason</td><td style=""padding: 8px 0; text-align: right;"">{safeReason}</td></tr>
        </table>
      </div>
      <p style=""font-size: 14px; line-height: 1.6; color: #555; margin: 0;"">
        Open Leave &amp; Absence in OpenSky HRM to approve or reject this request.
      </p>
      {button}
    </div>
    <div style=""background: #f5f6fa; padding: 16px 36px; text-align: center; font-size: 12px; color: #999;"">
      This is an automated message from OpenSky HRM.
    </div>
  </div>
</body>
</html>";
    }

    private static string BuildLeaveDecisionHtml(string employeeName, string leaveTypeName,
        DateTime startDate, DateTime endDate, decimal totalDays, string? remarks, string? approverName, bool approved)
    {
        var safeName = WebUtility.HtmlEncode(employeeName);
        var safeType = WebUtility.HtmlEncode(leaveTypeName);
        var safeRemarks = string.IsNullOrWhiteSpace(remarks) ? "—" : WebUtility.HtmlEncode(remarks);
        var safeApprover = string.IsNullOrWhiteSpace(approverName) ? "your supervisor" : WebUtility.HtmlEncode(approverName);
        var start = startDate.ToString("dd MMM yyyy");
        var end = endDate.ToString("dd MMM yyyy");
        var heading = approved ? "Leave request approved" : "Leave request rejected";
        var message = approved
            ? $"Good news — {safeApprover} has approved your leave request."
            : $"{safeApprover} has rejected your leave request.";

        return $@"
<!DOCTYPE html>
<html>
<head><meta charset=""utf-8""></head>
<body style=""font-family: 'Segoe UI', Arial, sans-serif; color: #1a1a2e; margin: 0; padding: 0; background: #f5f6fa;"">
  <div style=""max-width: 600px; margin: 20px auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,0.08);"">
    <div style=""background: linear-gradient(135deg, #1e3a5f 0%, #2B7DE9 100%); padding: 28px 36px; color: white;"">
      <h1 style=""margin: 0; font-size: 22px; font-weight: 600;"">{heading}</h1>
      <p style=""margin: 8px 0 0; opacity: 0.9; font-size: 14px;"">OpenSky HRM</p>
    </div>
    <div style=""padding: 28px 36px;"">
      <p style=""font-size: 16px; margin: 0 0 16px;"">Hi <strong>{safeName}</strong>,</p>
      <p style=""font-size: 15px; line-height: 1.6; margin: 0 0 20px;"">
        {message}
      </p>
      <div style=""background: #f8f9fe; border-radius: 8px; padding: 18px 22px; margin: 0 0 20px;"">
        <table style=""width: 100%; border-collapse: collapse; font-size: 14px;"">
          <tr><td style=""padding: 8px 0; color: #666;"">Leave type</td><td style=""padding: 8px 0; font-weight: 600; text-align: right;"">{safeType}</td></tr>
          <tr><td style=""padding: 8px 0; color: #666;"">Start</td><td style=""padding: 8px 0; font-weight: 600; text-align: right;"">{start}</td></tr>
          <tr><td style=""padding: 8px 0; color: #666;"">End</td><td style=""padding: 8px 0; font-weight: 600; text-align: right;"">{end}</td></tr>
          <tr><td style=""padding: 8px 0; color: #666;"">Total days</td><td style=""padding: 8px 0; font-weight: 600; text-align: right;"">{totalDays:F1}</td></tr>
          <tr><td style=""padding: 8px 0; color: #666;"">Decided by</td><td style=""padding: 8px 0; font-weight: 600; text-align: right;"">{safeApprover}</td></tr>
          <tr><td style=""padding: 8px 0; color: #666;"">Remarks</td><td style=""padding: 8px 0; text-align: right;"">{safeRemarks}</td></tr>
        </table>
      </div>
      <p style=""font-size: 14px; line-height: 1.6; color: #555; margin: 0;"">
        You can review this request in Leave &amp; Absence. If you have questions, contact HR or your supervisor.
      </p>
    </div>
    <div style=""background: #f5f6fa; padding: 16px 36px; text-align: center; font-size: 12px; color: #999;"">
      This is an automated message from OpenSky HRM.
    </div>
  </div>
</body>
</html>";
    }

    private static string BuildLeaveApplicationHtml(string employeeName, string leaveTypeName,
        DateTime startDate, DateTime endDate, decimal totalDays, string status, string? reason)
    {
        var safeName = WebUtility.HtmlEncode(employeeName);
        var safeType = WebUtility.HtmlEncode(leaveTypeName);
        var safeStatus = WebUtility.HtmlEncode(status);
        var safeReason = string.IsNullOrWhiteSpace(reason) ? "—" : WebUtility.HtmlEncode(reason);
        var start = startDate.ToString("dd MMM yyyy");
        var end = endDate.ToString("dd MMM yyyy");

        return $@"
<!DOCTYPE html>
<html>
<head><meta charset=""utf-8""></head>
<body style=""font-family: 'Segoe UI', Arial, sans-serif; color: #1a1a2e; margin: 0; padding: 0; background: #f5f6fa;"">
  <div style=""max-width: 600px; margin: 20px auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,0.08);"">
    <div style=""background: linear-gradient(135deg, #1e3a5f 0%, #2B7DE9 100%); padding: 28px 36px; color: white;"">
      <h1 style=""margin: 0; font-size: 22px; font-weight: 600;"">Leave request received</h1>
      <p style=""margin: 8px 0 0; opacity: 0.9; font-size: 14px;"">OpenSky HRM</p>
    </div>
    <div style=""padding: 28px 36px;"">
      <p style=""font-size: 16px; margin: 0 0 16px;"">Hi <strong>{safeName}</strong>,</p>
      <p style=""font-size: 15px; line-height: 1.6; margin: 0 0 20px;"">
        Your leave application has been submitted successfully and is now <strong>{safeStatus}</strong>.
      </p>
      <div style=""background: #f8f9fe; border-radius: 8px; padding: 18px 22px; margin: 0 0 20px;"">
        <table style=""width: 100%; border-collapse: collapse; font-size: 14px;"">
          <tr><td style=""padding: 8px 0; color: #666;"">Leave type</td><td style=""padding: 8px 0; font-weight: 600; text-align: right;"">{safeType}</td></tr>
          <tr><td style=""padding: 8px 0; color: #666;"">Start</td><td style=""padding: 8px 0; font-weight: 600; text-align: right;"">{start}</td></tr>
          <tr><td style=""padding: 8px 0; color: #666;"">End</td><td style=""padding: 8px 0; font-weight: 600; text-align: right;"">{end}</td></tr>
          <tr><td style=""padding: 8px 0; color: #666;"">Total days</td><td style=""padding: 8px 0; font-weight: 600; text-align: right;"">{totalDays:F1}</td></tr>
          <tr><td style=""padding: 8px 0; color: #666;"">Reason</td><td style=""padding: 8px 0; text-align: right;"">{safeReason}</td></tr>
        </table>
      </div>
      <p style=""font-size: 14px; line-height: 1.6; color: #555; margin: 0;"">
        You will be notified when your request is approved or rejected. If you have questions, contact HR.
      </p>
    </div>
    <div style=""background: #f5f6fa; padding: 16px 36px; text-align: center; font-size: 12px; color: #999;"">
      This is an automated message from OpenSky HRM.
    </div>
  </div>
</body>
</html>";
    }

    private static string BuildOfferHtml(string name, string position, decimal salary,
        string currency, DateTime? joiningDate, string? remarks)
    {
        return $@"
<!DOCTYPE html>
<html>
<head><meta charset=""utf-8""></head>
<body style=""font-family: 'Segoe UI', Arial, sans-serif; color: #1a1a2e; margin: 0; padding: 0; background: #f5f6fa;"">
  <div style=""max-width: 600px; margin: 20px auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,0.08);"">
    <div style=""background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); padding: 32px 40px; color: white;"">
      <h1 style=""margin: 0; font-size: 24px; font-weight: 600;"">Offer of Employment</h1>
      <p style=""margin: 8px 0 0; opacity: 0.85; font-size: 14px;"">OpenSky HRM</p>
    </div>
    <div style=""padding: 32px 40px;"">
      <p style=""font-size: 16px; margin: 0 0 16px;"">Dear <strong>{name}</strong>,</p>
      <p style=""font-size: 15px; line-height: 1.6; margin: 0 0 20px;"">
        We are pleased to extend an offer of employment for the position of
        <strong>{position}</strong>. We were impressed with your qualifications
        and believe you will be a valuable addition to our team.
      </p>
      <div style=""background: #f8f9fe; border-radius: 8px; padding: 20px 24px; margin: 0 0 20px;"">
        <table style=""width: 100%; border-collapse: collapse; font-size: 14px;"">
          <tr>
            <td style=""padding: 8px 0; color: #666;"">Position</td>
            <td style=""padding: 8px 0; font-weight: 600; text-align: right;"">{position}</td>
          </tr>
          <tr>
            <td style=""padding: 8px 0; color: #666;"">Salary</td>
            <td style=""padding: 8px 0; font-weight: 600; text-align: right;"">{currency} {salary:N0}</td>
          </tr>
          {(joiningDate.HasValue ? $@"<tr>
            <td style=""padding: 8px 0; color: #666;"">Proposed Joining Date</td>
            <td style=""padding: 8px 0; font-weight: 600; text-align: right;"">{joiningDate:dd MMM yyyy}</td>
          </tr>" : "")}
        </table>
      </div>
      {(!string.IsNullOrWhiteSpace(remarks) ? $@"<p style=""font-size: 14px; line-height: 1.6; color: #555; margin: 0 0 20px;"">{remarks}</p>" : "")}
      <p style=""font-size: 15px; line-height: 1.6; margin: 0 0 8px;"">
        Please review the details and let us know your decision at your earliest convenience.
      </p>
      <p style=""font-size: 15px; margin: 24px 0 0;"">
        Best regards,<br />
        <strong>Human Resources</strong><br />
        <span style=""color: #666; font-size: 13px;"">OpenSky HRM</span>
      </p>
    </div>
    <div style=""background: #f5f6fa; padding: 16px 40px; text-align: center; font-size: 12px; color: #999;"">
      This is an automated email from OpenSky HRM. Please do not reply directly.
    </div>
  </div>
</body>
</html>";
    }

    private static string WrapOfferLetterHtmlForPdf(string html)
    {
        var trimmed = html.Trim();
        if (trimmed.Contains("<html", StringComparison.OrdinalIgnoreCase))
            return trimmed;

        return $"""
            <!DOCTYPE html>
            <html>
            <head><meta charset="utf-8"></head>
            <body style="font-family: 'Segoe UI', Arial, sans-serif; color: #1a1a2e; margin: 0; padding: 0;">
            {trimmed}
            </body>
            </html>
            """;
    }

    private static string BuildOfferEmailCoverHtml(string candidateName, string positionTitle, string? offerResponseUrl = null)
    {
        var safeName = WebUtility.HtmlEncode(candidateName);
        var safePos = WebUtility.HtmlEncode(positionTitle);
        var actionsHtml = string.IsNullOrWhiteSpace(offerResponseUrl)
            ? ""
            : OfferLetterHelper.BuildOfferActionsHtml(offerResponseUrl);
        return $"""
            <!DOCTYPE html>
            <html>
            <head><meta charset="utf-8"></head>
            <body style="font-family: 'Segoe UI', Arial, sans-serif; color: #1a1a2e; margin: 0; padding: 0; background: #f5f6fa;">
              <div style="max-width: 600px; margin: 20px auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,0.08);">
                <div style="background: linear-gradient(90deg, #1a3a6e 0%, #1e4a8c 50%, #2e78e6 100%); padding: 24px 32px; color: white;">
                  <h1 style="margin: 0; font-size: 20px; font-weight: 600;">Offer of Employment</h1>
                  <p style="margin: 8px 0 0; opacity: 0.85; font-size: 14px;">OpenSky HRM</p>
                </div>
                <div style="padding: 28px 32px;">
                  <p style="font-size: 16px; margin: 0 0 16px;">Dear <strong>{safeName}</strong>,</p>
                  <p style="font-size: 15px; line-height: 1.6; margin: 0 0 16px;">
                    Please find attached your offer of employment for the position of <strong>{safePos}</strong> as a PDF document.
                  </p>
                  <p style="font-size: 14px; line-height: 1.6; color: #555; margin: 0 0 16px;">
                    Open the attachment to review salary, joining date, and other details. You can accept, negotiate, or decline using the buttons below.
                  </p>
                  {actionsHtml}
                </div>
                <div style="background: #f5f6fa; padding: 16px 32px; text-align: center; font-size: 12px; color: #999;">
                  This is an automated email from OpenSky HRM.
                </div>
              </div>
            </body>
            </html>
            """;
    }

    private static string BuildOfferPdfFileName(string candidateName, string positionTitle)
    {
        static string Sanitize(string value)
        {
            var chars = value.Trim().ToCharArray();
            for (var i = 0; i < chars.Length; i++)
            {
                if (!char.IsLetterOrDigit(chars[i]) && chars[i] != '-' && chars[i] != '_')
                    chars[i] = '-';
            }
            return new string(chars).Trim('-');
        }

        var namePart = Sanitize(candidateName);
        var posPart = Sanitize(positionTitle);
        if (string.IsNullOrWhiteSpace(namePart)) namePart = "Candidate";
        if (string.IsNullOrWhiteSpace(posPart)) posPart = "Offer";
        return $"{namePart}-{posPart}-Offer-Letter.pdf";
    }
}
