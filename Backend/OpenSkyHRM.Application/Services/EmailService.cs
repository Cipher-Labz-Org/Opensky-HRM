using System.Net;
using System.Net.Http.Headers;
using System.Net.Mail;
using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using OpenSkyHRM.Application.Interfaces;
using OpenSkyHRM.Domain.Entities;
using OpenSkyHRM.Persistence;
using OpenSkyHRM.Persistence.Seeders;

namespace OpenSkyHRM.Application.Services;

public class EmailService : IEmailService
{
    public const string CategoryRecruitmentOffer = "RecruitmentOffer";
    public const string CategoryLeaveApplication = "LeaveApplication";
    public const string CategoryTraining = "Training";

    private readonly IConfiguration _config;
    private readonly ILogger<EmailService> _logger;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IEmailDeliveryLogWriter _deliveryLog;
    private readonly AppDbContext _db;

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
        AppDbContext db)
    {
        _config = config;
        _logger = logger;
        _httpClientFactory = httpClientFactory;
        _deliveryLog = deliveryLog;
        _db = db;
    }

    public Task<bool> IsConfiguredAsync()
    {
        if (!string.IsNullOrWhiteSpace(_config["SendGrid:ApiKey"]))
            return Task.FromResult(true);
        if (!string.IsNullOrWhiteSpace(_config["Smtp:Host"]))
            return Task.FromResult(true);
        return Task.FromResult(false);
    }

    public async Task SendOfferEmailAsync(string toEmail, string candidateName, string positionTitle,
        decimal salary, string currency, DateTime? joiningDate, string? remarks)
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
        var (subject, body) = await ResolveTransactionalEmailAsync(
            TransactionalEmailTemplateSeeder.RecruitmentOfferKey,
            bodyReplacements,
            defaultSubject,
            subjectReplacements,
            () => BuildOfferHtml(candidateName, positionTitle, salary, currency, joiningDate, remarks));

        await SendHtmlEmailAsync(toEmail, candidateName, subject, body, CategoryRecruitmentOffer);
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

    private async Task SendHtmlEmailAsync(string toEmail, string toDisplayName, string subject, string htmlBody, string category)
    {
        var fromEmail = _config["SendGrid:FromEmail"] ?? _config["Smtp:From"] ?? "hr@openskyhrm.com";
        var sendGridKey = _config["SendGrid:ApiKey"];
        if (!string.IsNullOrWhiteSpace(sendGridKey))
        {
            await SendViaSendGridAsync(toEmail, toDisplayName, subject, htmlBody, sendGridKey, category, fromEmail);
            return;
        }

        await SendViaSmtpAsync(toEmail, toDisplayName, subject, htmlBody, category, fromEmail);
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

    private async Task SendViaSendGridAsync(string toEmail, string toName, string subject, string htmlBody, string apiKey, string category, string fromEmail)
    {
        var apiUrl = _config["SendGrid:ApiUrl"] ?? "https://api.sendgrid.com/v3/mail/send";
        var fromName = _config["SendGrid:FromName"] ?? _config["Smtp:FromName"] ?? "OpenSky HRM";

        var payload = new
        {
            Personalizations = new[]
            {
                new { To = new[] { new { Email = toEmail, Name = toName } } },
            },
            From = new { Email = fromEmail, Name = fromName },
            Subject = subject,
            Content = new[] { new { Type = "text/html", Value = htmlBody } },
        };

        var json = JsonSerializer.Serialize(payload, JsonOpts);
        using var req = new HttpRequestMessage(HttpMethod.Post, apiUrl)
        {
            Content = new StringContent(json, Encoding.UTF8, "application/json"),
        };
        req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);

        var client = _httpClientFactory.CreateClient();
        client.Timeout = TimeSpan.FromSeconds(60);

        using var resp = await client.SendAsync(req);
        var code = (int)resp.StatusCode;
        if (!resp.IsSuccessStatusCode)
        {
            var err = await resp.Content.ReadAsStringAsync();
            _logger.LogError("SendGrid failed ({Status}): {Body}", code, err);
            await TryPersistLogAsync(new EmailDeliveryLogEntry(
                category, toEmail, toName, subject, "Failed", "SendGrid", code, fromEmail, err));
            throw new InvalidOperationException($"SendGrid returned {code}. Check API key and sender verification.");
        }

        await TryPersistLogAsync(new EmailDeliveryLogEntry(
            category, toEmail, toName, subject, "Sent", "SendGrid", code, fromEmail, null));
        _logger.LogInformation("Email sent via SendGrid to {Email} subject {Subject}", toEmail, subject);
    }

    private async Task SendViaSmtpAsync(string toEmail, string toDisplayName, string subject, string body, string category, string fromEmailResolved)
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
        msg.Body = body;
        msg.IsBodyHtml = true;

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
            await TryPersistLogAsync(new EmailDeliveryLogEntry(
                category, toEmail, toDisplayName, subject, "Failed", "Smtp", null, from, ex.Message));
            throw;
        }
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
}
