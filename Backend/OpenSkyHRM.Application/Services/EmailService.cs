using System.Net;
using System.Net.Mail;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using OpenSkyHRM.Application.Interfaces;

namespace OpenSkyHRM.Application.Services;

public class EmailService : IEmailService
{
    private readonly IConfiguration _config;
    private readonly ILogger<EmailService> _logger;

    public EmailService(IConfiguration config, ILogger<EmailService> logger)
    {
        _config = config;
        _logger = logger;
    }

    public Task<bool> IsConfiguredAsync()
    {
        var host = _config["Smtp:Host"];
        return Task.FromResult(!string.IsNullOrWhiteSpace(host));
    }

    public async Task SendOfferEmailAsync(string toEmail, string candidateName, string positionTitle,
        decimal salary, string currency, DateTime? joiningDate, string? remarks)
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
            _logger.LogWarning("SMTP is not configured. Offer email to {Email} will be logged only.", toEmail);
            _logger.LogInformation("OFFER EMAIL (not sent — no SMTP configured):\n" +
                "To: {To}\nSubject: Offer of Employment – {Position}\n" +
                "Candidate: {Name}\nSalary: {Currency} {Salary:N0}\nJoining: {JoiningDate}\nRemarks: {Remarks}",
                toEmail, positionTitle, candidateName, currency, salary,
                joiningDate?.ToString("dd MMM yyyy") ?? "TBD", remarks ?? "—");
            return;
        }

        var subject = $"Offer of Employment – {positionTitle}";
        var body = BuildOfferHtml(candidateName, positionTitle, salary, currency, joiningDate, remarks);

        using var msg = new MailMessage();
        msg.From = new MailAddress(from, fromName);
        msg.To.Add(new MailAddress(toEmail, candidateName));
        msg.Subject = subject;
        msg.Body = body;
        msg.IsBodyHtml = true;

        using var client = new SmtpClient(host, int.Parse(portStr));
        client.EnableSsl = enableSsl;
        if (!string.IsNullOrWhiteSpace(username))
            client.Credentials = new NetworkCredential(username, password);

        await client.SendMailAsync(msg);
        _logger.LogInformation("Offer email sent to {Email} for position {Position}", toEmail, positionTitle);
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
