using Microsoft.EntityFrameworkCore;
using OpenSkyHRM.Domain.Entities;

namespace OpenSkyHRM.Persistence.Seeders;

public static class DocumentTemplateSeeder
{
    public static async Task SeedAsync(AppDbContext context)
    {
        if (await context.DocumentTemplates.AnyAsync()) return;

        var templates = new[]
        {
            new DocumentTemplate
            {
                Name = "Job Confirmation Letter",
                TemplateKey = "job_confirmation",
                HtmlContent = JobConfirmationTemplate
            },
            new DocumentTemplate
            {
                Name = "Probation Confirmation Letter",
                TemplateKey = "probation_confirmation",
                HtmlContent = ProbationConfirmationTemplate
            },
            new DocumentTemplate
            {
                Name = "Experience Letter",
                TemplateKey = "experience_letter",
                HtmlContent = ExperienceLetterTemplate
            }
        };

        context.DocumentTemplates.AddRange(templates);
        await context.SaveChangesAsync();
    }

    private const string JobConfirmationTemplate = @"<!DOCTYPE html>
<html>
<head>
<style>
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #333; padding: 60px; line-height: 1.8; }
  .header { text-align: center; border-bottom: 3px solid #2563eb; padding-bottom: 20px; margin-bottom: 30px; }
  .header h1 { color: #1e40af; margin: 0; font-size: 22px; }
  .header p { color: #64748b; margin: 4px 0 0; font-size: 13px; }
  .date { text-align: right; color: #64748b; font-size: 13px; margin-bottom: 30px; }
  .body-text { font-size: 14px; }
  .body-text p { margin-bottom: 14px; }
  .highlight { font-weight: 600; color: #1e40af; }
  .details-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
  .details-table td { padding: 8px 12px; font-size: 13px; }
  .details-table td:first-child { font-weight: 600; color: #475569; width: 200px; }
  .details-table tr:nth-child(even) { background: #f8fafc; }
  .footer { margin-top: 60px; }
  .signature { margin-top: 50px; }
  .signature .name { font-weight: 600; }
</style>
</head>
<body>
  <div class=""header"">
    <h1>{{CompanyName}}</h1>
    <p>Job Confirmation Letter</p>
  </div>
  <div class=""date"">Date: {{CurrentDate}}</div>
  <div class=""body-text"">
    <p>Dear <span class=""highlight"">{{EmployeeName}}</span>,</p>
    <p>We are pleased to confirm your appointment at <strong>{{CompanyName}}</strong>. Your employment details are as follows:</p>
    <table class=""details-table"">
      <tr><td>Employee Code</td><td>{{EmployeeCode}}</td></tr>
      <tr><td>Job Title</td><td>{{JobTitle}}</td></tr>
      <tr><td>Department</td><td>{{Department}}</td></tr>
      <tr><td>Location</td><td>{{Location}}</td></tr>
      <tr><td>Date of Joining</td><td>{{JoinDate}}</td></tr>
      <tr><td>Employment Status</td><td>{{Status}}</td></tr>
      <tr><td>Reporting To</td><td>{{ManagerName}}</td></tr>
    </table>
    <p>We are confident that you will be a valuable addition to our team. We look forward to a long and successful association with you.</p>
    <p>Please sign and return a copy of this letter as acknowledgement of receipt.</p>
    <div class=""signature"">
      <p>Sincerely,</p>
      <br/><br/>
      <p class=""name"">___________________________</p>
      <p>Authorized Signatory<br/>{{CompanyName}}</p>
    </div>
    <div class=""footer"">
      <p style=""font-size:12px;color:#94a3b8;"">Employee Acknowledgement: I accept the above terms.</p>
      <br/><br/>
      <p style=""font-size:12px;color:#94a3b8;"">Signature: ___________________________ &nbsp;&nbsp; Date: _______________</p>
    </div>
  </div>
</body>
</html>";

    private const string ProbationConfirmationTemplate = @"<!DOCTYPE html>
<html>
<head>
<style>
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #333; padding: 60px; line-height: 1.8; }
  .header { text-align: center; border-bottom: 3px solid #16a34a; padding-bottom: 20px; margin-bottom: 30px; }
  .header h1 { color: #15803d; margin: 0; font-size: 22px; }
  .header p { color: #64748b; margin: 4px 0 0; font-size: 13px; }
  .date { text-align: right; color: #64748b; font-size: 13px; margin-bottom: 30px; }
  .body-text { font-size: 14px; }
  .body-text p { margin-bottom: 14px; }
  .highlight { font-weight: 600; color: #15803d; }
  .details-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
  .details-table td { padding: 8px 12px; font-size: 13px; }
  .details-table td:first-child { font-weight: 600; color: #475569; width: 200px; }
  .details-table tr:nth-child(even) { background: #f8fafc; }
  .signature { margin-top: 50px; }
  .signature .name { font-weight: 600; }
</style>
</head>
<body>
  <div class=""header"">
    <h1>{{CompanyName}}</h1>
    <p>Probation Confirmation Letter</p>
  </div>
  <div class=""date"">Date: {{CurrentDate}}</div>
  <div class=""body-text"">
    <p>Dear <span class=""highlight"">{{EmployeeName}}</span>,</p>
    <p>We are pleased to inform you that you have successfully completed your probationary period at <strong>{{CompanyName}}</strong>.</p>
    <table class=""details-table"">
      <tr><td>Employee Code</td><td>{{EmployeeCode}}</td></tr>
      <tr><td>Name</td><td>{{EmployeeName}}</td></tr>
      <tr><td>Job Title</td><td>{{JobTitle}}</td></tr>
      <tr><td>Department</td><td>{{Department}}</td></tr>
      <tr><td>Date of Joining</td><td>{{JoinDate}}</td></tr>
      <tr><td>Probation End Date</td><td>{{ProbationEndDate}}</td></tr>
      <tr><td>Date of Permanency</td><td>{{DateOfPermanency}}</td></tr>
    </table>
    <p>Effective <strong>{{DateOfPermanency}}</strong>, your employment has been confirmed as permanent. All other terms and conditions of your employment remain unchanged.</p>
    <p>Congratulations on this achievement. We look forward to your continued contribution and growth within the organization.</p>
    <div class=""signature"">
      <p>Sincerely,</p>
      <br/><br/>
      <p class=""name"">___________________________</p>
      <p>Authorized Signatory<br/>{{CompanyName}}</p>
    </div>
  </div>
</body>
</html>";

    private const string ExperienceLetterTemplate = @"<!DOCTYPE html>
<html>
<head>
<style>
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #333; padding: 60px; line-height: 1.8; }
  .header { text-align: center; border-bottom: 3px solid #7c3aed; padding-bottom: 20px; margin-bottom: 30px; }
  .header h1 { color: #6d28d9; margin: 0; font-size: 22px; }
  .header p { color: #64748b; margin: 4px 0 0; font-size: 13px; }
  .date { text-align: right; color: #64748b; font-size: 13px; margin-bottom: 30px; }
  .body-text { font-size: 14px; }
  .body-text p { margin-bottom: 14px; }
  .highlight { font-weight: 600; color: #6d28d9; }
  .details-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
  .details-table td { padding: 8px 12px; font-size: 13px; }
  .details-table td:first-child { font-weight: 600; color: #475569; width: 200px; }
  .details-table tr:nth-child(even) { background: #f8fafc; }
  .signature { margin-top: 50px; }
  .signature .name { font-weight: 600; }
</style>
</head>
<body>
  <div class=""header"">
    <h1>{{CompanyName}}</h1>
    <p>Experience / Service Certificate</p>
  </div>
  <div class=""date"">Date: {{CurrentDate}}</div>
  <div class=""body-text"">
    <p><strong>To Whom It May Concern,</strong></p>
    <p>This is to certify that <span class=""highlight"">{{EmployeeName}}</span> (Employee Code: <strong>{{EmployeeCode}}</strong>) was employed with <strong>{{CompanyName}}</strong> from <strong>{{JoinDate}}</strong> to <strong>{{TerminationDate}}</strong>.</p>
    <table class=""details-table"">
      <tr><td>Employee Name</td><td>{{EmployeeName}}</td></tr>
      <tr><td>Employee Code</td><td>{{EmployeeCode}}</td></tr>
      <tr><td>Job Title</td><td>{{JobTitle}}</td></tr>
      <tr><td>Department</td><td>{{Department}}</td></tr>
      <tr><td>Date of Joining</td><td>{{JoinDate}}</td></tr>
      <tr><td>Date of Leaving</td><td>{{TerminationDate}}</td></tr>
    </table>
    <p>During their tenure, {{FirstName}} demonstrated professionalism, dedication, and commitment to their role. We wish them all the best in their future endeavors.</p>
    <p>This certificate is issued upon request for whatever purpose it may serve.</p>
    <div class=""signature"">
      <p>Sincerely,</p>
      <br/><br/>
      <p class=""name"">___________________________</p>
      <p>Authorized Signatory<br/>{{CompanyName}}</p>
    </div>
  </div>
</body>
</html>";
}
