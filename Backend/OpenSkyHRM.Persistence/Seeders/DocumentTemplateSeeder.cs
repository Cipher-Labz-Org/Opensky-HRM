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

    public const string ResignationLetterKey = "resignation_letter";
    public const string AppointmentLetterKey = "appointment_letter";
    public const string ConfirmationLetterKey = "confirmation_letter";
    public const string ContractLetterKey = "contract_letter";

    /// <summary>Adds standard HR letter templates if missing (safe for existing databases).</summary>
    public static async Task EnsureLetterPackAsync(AppDbContext context)
    {
        if (!await context.DocumentTemplates.AnyAsync(t => t.TemplateKey == ResignationLetterKey))
        {
            context.DocumentTemplates.Add(new DocumentTemplate
            {
                Name = "Resignation Letter",
                TemplateKey = ResignationLetterKey,
                HtmlContent = ResignationLetterHtml,
                IsActive = true,
            });
        }

        if (!await context.DocumentTemplates.AnyAsync(t => t.TemplateKey == AppointmentLetterKey))
        {
            context.DocumentTemplates.Add(new DocumentTemplate
            {
                Name = "Appointment Letter",
                TemplateKey = AppointmentLetterKey,
                HtmlContent = AppointmentLetterHtml,
                IsActive = true,
            });
        }

        if (!await context.DocumentTemplates.AnyAsync(t => t.TemplateKey == ConfirmationLetterKey))
        {
            context.DocumentTemplates.Add(new DocumentTemplate
            {
                Name = "Confirmation Letter",
                TemplateKey = ConfirmationLetterKey,
                HtmlContent = ConfirmationLetterHtml,
                IsActive = true,
            });
        }

        if (!await context.DocumentTemplates.AnyAsync(t => t.TemplateKey == ContractLetterKey))
        {
            context.DocumentTemplates.Add(new DocumentTemplate
            {
                Name = "Contract Letter",
                TemplateKey = ContractLetterKey,
                HtmlContent = ContractLetterHtml,
                IsActive = true,
            });
        }

        await context.SaveChangesAsync();
    }

    private const string ResignationLetterHtml = """
<!DOCTYPE html>
<html>
<head><meta charset="utf-8">
<style>
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #333; padding: 60px; line-height: 1.8; }
  .header { text-align: center; border-bottom: 3px solid #64748b; padding-bottom: 20px; margin-bottom: 30px; }
  .header h1 { color: #334155; margin: 0; font-size: 22px; }
  .header p { color: #64748b; margin: 4px 0 0; font-size: 13px; }
  .date { text-align: right; color: #64748b; font-size: 13px; margin-bottom: 30px; }
  .body-text { font-size: 14px; }
  .body-text p { margin-bottom: 14px; }
  .highlight { font-weight: 600; color: #334155; }
  .details-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
  .details-table td { padding: 8px 12px; font-size: 13px; }
  .details-table td:first-child { font-weight: 600; color: #475569; width: 200px; }
  .details-table tr:nth-child(even) { background: #f8fafc; }
  .signature { margin-top: 50px; }
  .signature .name { font-weight: 600; }
</style>
</head>
<body>
  <div class="header">
    <h1>{{CompanyName}}</h1>
    <p>Resignation — acknowledgement</p>
  </div>
  <div class="date">Date: {{CurrentDate}}</div>
  <div class="body-text">
    <p>Dear <span class="highlight">{{EmployeeName}}</span>,</p>
    <p>We acknowledge receipt of your resignation from the position of <strong>{{JobTitle}}</strong> within <strong>{{Department}}</strong>.</p>
    <table class="details-table">
      <tr><td>Employee code</td><td>{{EmployeeCode}}</td></tr>
      <tr><td>Job title</td><td>{{JobTitle}}</td></tr>
      <tr><td>Department</td><td>{{Department}}</td></tr>
      <tr><td>Location</td><td>{{Location}}</td></tr>
      <tr><td>Date of joining</td><td>{{JoinDate}}</td></tr>
      <tr><td>Recorded last working day</td><td>{{TerminationDate}}</td></tr>
      <tr><td>Reporting manager</td><td>{{ManagerName}}</td></tr>
    </table>
    <p>Your separation will be processed in accordance with company policy, your employment contract, and applicable law, including settlement of dues and return of company property.</p>
    <p>Where your relieving date is not yet finalised in the system, your manager or HR will confirm the same separately.</p>
    <p>We thank you for your contributions to {{CompanyName}} and wish you success in your future endeavours.</p>
    <div class="signature">
      <p>Sincerely,</p>
      <br/><br/>
      <p class="name">___________________________</p>
      <p>Authorized signatory<br/>{{CompanyName}}</p>
    </div>
  </div>
</body>
</html>
""";

    private const string AppointmentLetterHtml = """
<!DOCTYPE html>
<html>
<head><meta charset="utf-8">
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
  .signature { margin-top: 50px; }
  .signature .name { font-weight: 600; }
</style>
</head>
<body>
  <div class="header">
    <h1>{{CompanyName}}</h1>
    <p>Letter of appointment</p>
  </div>
  <div class="date">Date: {{CurrentDate}}</div>
  <div class="body-text">
    <p>Dear <span class="highlight">{{EmployeeName}}</span>,</p>
    <p>With reference to your application and subsequent selection process, we are pleased to appoint you to the following role at <strong>{{CompanyName}}</strong>:</p>
    <table class="details-table">
      <tr><td>Employee code</td><td>{{EmployeeCode}}</td></tr>
      <tr><td>Position / job title</td><td>{{JobTitle}}</td></tr>
      <tr><td>Department</td><td>{{Department}}</td></tr>
      <tr><td>Business unit</td><td>{{BusinessUnit}}</td></tr>
      <tr><td>Location</td><td>{{Location}}</td></tr>
      <tr><td>Grade</td><td>{{Grade}}</td></tr>
      <tr><td>Reporting to</td><td>{{ManagerName}}</td></tr>
      <tr><td>Date of joining</td><td>{{JoinDate}}</td></tr>
      <tr><td>Employment status</td><td>{{Status}}</td></tr>
    </table>
    <p>Your appointment is subject to the terms and conditions set out in your employment contract, the employee handbook, and policies of {{CompanyName}} as may be amended from time to time.</p>
    <p>Please sign and return a copy of this letter to HR as acceptance of this appointment.</p>
    <div class="signature">
      <p>Yours faithfully,</p>
      <br/><br/>
      <p class="name">___________________________</p>
      <p>For {{CompanyName}}<br/>Authorized signatory</p>
    </div>
  </div>
</body>
</html>
""";

    private const string ConfirmationLetterHtml = """
<!DOCTYPE html>
<html>
<head><meta charset="utf-8">
<style>
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #333; padding: 60px; line-height: 1.8; }
  .header { text-align: center; border-bottom: 3px solid #0d9488; padding-bottom: 20px; margin-bottom: 30px; }
  .header h1 { color: #0f766e; margin: 0; font-size: 22px; }
  .header p { color: #64748b; margin: 4px 0 0; font-size: 13px; }
  .date { text-align: right; color: #64748b; font-size: 13px; margin-bottom: 30px; }
  .body-text { font-size: 14px; }
  .body-text p { margin-bottom: 14px; }
  .highlight { font-weight: 600; color: #0f766e; }
  .details-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
  .details-table td { padding: 8px 12px; font-size: 13px; }
  .details-table td:first-child { font-weight: 600; color: #475569; width: 200px; }
  .details-table tr:nth-child(even) { background: #f8fafc; }
  .signature { margin-top: 50px; }
  .signature .name { font-weight: 600; }
</style>
</head>
<body>
  <div class="header">
    <h1>{{CompanyName}}</h1>
    <p>Employment confirmation</p>
  </div>
  <div class="date">Date: {{CurrentDate}}</div>
  <div class="body-text">
    <p><strong>To whom it may concern,</strong></p>
    <p>This is to confirm that <span class="highlight">{{EmployeeName}}</span> (employee code <strong>{{EmployeeCode}}</strong>) is currently employed with <strong>{{CompanyName}}</strong> in the capacity detailed below. This letter is issued without financial liability to the company and upon the employee's request.</p>
    <table class="details-table">
      <tr><td>Full name</td><td>{{EmployeeName}}</td></tr>
      <tr><td>Employee code</td><td>{{EmployeeCode}}</td></tr>
      <tr><td>Job title</td><td>{{JobTitle}}</td></tr>
      <tr><td>Department</td><td>{{Department}}</td></tr>
      <tr><td>Location</td><td>{{Location}}</td></tr>
      <tr><td>Date of joining</td><td>{{JoinDate}}</td></tr>
      <tr><td>Current status</td><td>{{Status}}</td></tr>
      <tr><td>Reporting manager</td><td>{{ManagerName}}</td></tr>
    </table>
    <p>For any further verification, HR may be contacted using official channels only.</p>
    <div class="signature">
      <p>Sincerely,</p>
      <br/><br/>
      <p class="name">___________________________</p>
      <p>HR / Authorized signatory<br/>{{CompanyName}}</p>
    </div>
  </div>
</body>
</html>
""";

    private const string ContractLetterHtml = """
<!DOCTYPE html>
<html>
<head><meta charset="utf-8">
<style>
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #333; padding: 60px; line-height: 1.8; }
  .header { text-align: center; border-bottom: 3px solid #4338ca; padding-bottom: 20px; margin-bottom: 30px; }
  .header h1 { color: #3730a3; margin: 0; font-size: 22px; }
  .header p { color: #64748b; margin: 4px 0 0; font-size: 13px; }
  .date { text-align: right; color: #64748b; font-size: 13px; margin-bottom: 30px; }
  .body-text { font-size: 14px; }
  .body-text p { margin-bottom: 14px; }
  .highlight { font-weight: 600; color: #3730a3; }
  .details-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
  .details-table td { padding: 8px 12px; font-size: 13px; }
  .details-table td:first-child { font-weight: 600; color: #475569; width: 200px; }
  .details-table tr:nth-child(even) { background: #f8fafc; }
  .ol { margin: 16px 0 16px 20px; padding: 0; font-size: 14px; }
  .ol li { margin-bottom: 10px; }
  .signature { margin-top: 50px; }
  .signature .name { font-weight: 600; }
</style>
</head>
<body>
  <div class="header">
    <h1>{{CompanyName}}</h1>
    <p>Employment contract — summary letter</p>
  </div>
  <div class="date">Date: {{CurrentDate}}</div>
  <div class="body-text">
    <p>This letter summarises key terms of employment between <strong>{{CompanyName}}</strong> (“Company”) and <span class="highlight">{{EmployeeName}}</span> (“Employee”). The full contract, schedules, and policies referenced below form part of the understanding between the parties.</p>
    <table class="details-table">
      <tr><td>Employee code</td><td>{{EmployeeCode}}</td></tr>
      <tr><td>Role</td><td>{{JobTitle}}</td></tr>
      <tr><td>Position</td><td>{{Position}}</td></tr>
      <tr><td>Department</td><td>{{Department}}</td></tr>
      <tr><td>Business unit</td><td>{{BusinessUnit}}</td></tr>
      <tr><td>Work location</td><td>{{Location}}</td></tr>
      <tr><td>Grade</td><td>{{Grade}}</td></tr>
      <tr><td>Reporting manager</td><td>{{ManagerName}}</td></tr>
      <tr><td>Commencement / joining</td><td>{{JoinDate}}</td></tr>
      <tr><td>Probation end (if applicable)</td><td>{{ProbationEndDate}}</td></tr>
      <tr><td>Employment status</td><td>{{Status}}</td></tr>
    </table>
    <ol class="ol">
      <li><strong>Role and duties.</strong> The Employee shall perform the duties of the role reasonably assigned by the Company, including those consistent with {{JobTitle}} and departmental objectives.</li>
      <li><strong>Policies.</strong> The Employee shall comply with the employee handbook, code of conduct, IT and security policies, and other internal policies as updated from time to time.</li>
      <li><strong>Compensation and benefits.</strong> Remuneration, allowances, and benefits shall be as set out in the applicable compensation schedule, payroll records, and benefit plans communicated by HR.</li>
      <li><strong>Confidentiality.</strong> The Employee shall not disclose the Company’s confidential information during or after employment, except as required by law or with written consent.</li>
      <li><strong>Probation.</strong> Where applicable, probation shall be governed by the dates above and company policy until confirmed in writing.</li>
      <li><strong>Governing terms.</strong> In case of conflict, the executed employment contract and applicable law prevail over this summary.</li>
    </ol>
    <p>By signing below, the Employee acknowledges receipt of this summary and confirms that the full contract and policies have been made available for review.</p>
    <div class="signature">
      <p><strong>For the Company</strong></p>
      <br/><br/>
      <p class="name">___________________________</p>
      <p>Authorized signatory — {{CompanyName}}</p>
      <br/><br/>
      <p><strong>Employee acceptance</strong></p>
      <br/><br/>
      <p class="name">___________________________</p>
      <p>{{EmployeeName}} &nbsp;&nbsp; Date: _______________</p>
    </div>
  </div>
</body>
</html>
""";
}
