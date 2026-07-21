using Microsoft.EntityFrameworkCore;
using OpenSkyHRM.Domain.Entities;

namespace OpenSkyHRM.Persistence.Seeders;

public static class DocumentTemplateSeeder
{
    public const string ResignationLetterKey = "resignation_letter";
    public const string AppointmentLetterKey = "appointment_letter";
    public const string ConfirmationLetterKey = "confirmation_letter";
    public const string ContractLetterKey = "contract_letter";
    public const string JobConfirmationKey = "job_confirmation";
    public const string ProbationConfirmationKey = "probation_confirmation";
    public const string ExperienceLetterKey = "experience_letter";

    public static async Task SeedAsync(AppDbContext context)
    {
        if (await context.DocumentTemplates.AnyAsync()) return;

        context.DocumentTemplates.AddRange(
            new DocumentTemplate { Name = "Job Confirmation Letter", TemplateKey = JobConfirmationKey, HtmlContent = JobConfirmationTemplate, IsActive = true },
            new DocumentTemplate { Name = "Probation Confirmation Letter", TemplateKey = ProbationConfirmationKey, HtmlContent = ProbationConfirmationTemplate, IsActive = true },
            new DocumentTemplate { Name = "Experience Letter", TemplateKey = ExperienceLetterKey, HtmlContent = ExperienceLetterTemplate, IsActive = true });
        await context.SaveChangesAsync();
    }

    public static async Task EnsureLetterPackAsync(AppDbContext context)
    {
        await UpsertLetterAsync(context, ResignationLetterKey, "Resignation Letter", ResignationLetterHtml, refreshLegacyOnly: true);
        await UpsertLetterAsync(context, AppointmentLetterKey, "Appointment Letter", AppointmentLetterHtml, refreshLegacyOnly: true);
        await UpsertLetterAsync(context, ConfirmationLetterKey, "Confirmation Letter", ConfirmationLetterHtml, refreshLegacyOnly: true);
        await UpsertLetterAsync(context, ContractLetterKey, "Contract Letter", ContractLetterHtml, refreshLegacyOnly: true);
        await UpsertLetterAsync(context, JobConfirmationKey, "Job Confirmation Letter", JobConfirmationTemplate, refreshLegacyOnly: true);
        await UpsertLetterAsync(context, ProbationConfirmationKey, "Probation Confirmation Letter", ProbationConfirmationTemplate, refreshLegacyOnly: true);
        await UpsertLetterAsync(context, ExperienceLetterKey, "Experience Letter", ExperienceLetterTemplate, refreshLegacyOnly: true);
        await context.SaveChangesAsync();
    }

    public static async Task RefreshLetterPackHtmlAsync(AppDbContext context)
    {
        await UpsertLetterAsync(context, ResignationLetterKey, "Resignation Letter", ResignationLetterHtml, refreshLegacyOnly: false);
        await UpsertLetterAsync(context, AppointmentLetterKey, "Appointment Letter", AppointmentLetterHtml, refreshLegacyOnly: false);
        await UpsertLetterAsync(context, ConfirmationLetterKey, "Confirmation Letter", ConfirmationLetterHtml, refreshLegacyOnly: false);
        await UpsertLetterAsync(context, ContractLetterKey, "Contract Letter", ContractLetterHtml, refreshLegacyOnly: false);
        await UpsertLetterAsync(context, JobConfirmationKey, "Job Confirmation Letter", JobConfirmationTemplate, refreshLegacyOnly: false);
        await UpsertLetterAsync(context, ProbationConfirmationKey, "Probation Confirmation Letter", ProbationConfirmationTemplate, refreshLegacyOnly: false);
        await UpsertLetterAsync(context, ExperienceLetterKey, "Experience Letter", ExperienceLetterTemplate, refreshLegacyOnly: false);
        await context.SaveChangesAsync();
    }

    private static async Task UpsertLetterAsync(AppDbContext context, string key, string name, string html, bool refreshLegacyOnly)
    {
        var existing = await context.DocumentTemplates.FirstOrDefaultAsync(t => t.TemplateKey == key);
        if (existing is null)
        {
            context.DocumentTemplates.Add(new DocumentTemplate { Name = name, TemplateKey = key, HtmlContent = html, IsActive = true });
            return;
        }

        var needsUpgrade =
            existing.HtmlContent.Contains("details-table", StringComparison.OrdinalIgnoreCase) ||
            existing.HtmlContent.Contains("class=\"header\"", StringComparison.OrdinalIgnoreCase) ||
            !existing.HtmlContent.Contains("data-letter-version=\"2\"", StringComparison.Ordinal);
        if (!refreshLegacyOnly || needsUpgrade)
            existing.HtmlContent = html;
    }

    private static string DetailRow(string label, string placeholder) =>
        $"      <div class=\"detail-label\">{label}</div><div class=\"detail-colon\">:</div><div class=\"detail-value\">{{{{{placeholder}}}}}</div>";

    private static string DetailGrid(params (string Label, string Placeholder)[] rows)
    {
        var lines = new List<string> { "    <div class=\"detail-grid\">" };
        foreach (var (label, placeholder) in rows)
            lines.Add(DetailRow(label, placeholder));
        lines.Add("    </div>");
        return string.Join("\n", lines);
    }

    private static string FormalLetter(string docTitle, string refLine, string bodyInnerHtml) =>
        LetterShell
            .Replace("[[DOC_TITLE]]", docTitle, StringComparison.Ordinal)
            .Replace("[[REF_LINE]]", refLine, StringComparison.Ordinal)
            .Replace("[[BODY]]", bodyInnerHtml, StringComparison.Ordinal);

    private const string LetterShell = """
<!DOCTYPE html>
<html>
<head><meta charset="utf-8">
<style>
  * { box-sizing: border-box; }
  body { margin: 0; font-family: Georgia, "Times New Roman", Times, serif; color: #1c1917; padding: 48px 54px 54px; line-height: 1.65; font-size: 14px; background: #fff; }
  .letterhead { text-align: center; margin-bottom: 2px; }
  .letterhead .company { margin: 0; font-size: 19px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #0f172a; }
  .letterhead .company-line { margin: 6px 0 0; font-family: Arial, Helvetica, sans-serif; font-size: 11px; letter-spacing: 0.06em; color: #78716c; }
  .letterhead .doc-title { margin: 12px 0 0; font-family: Arial, Helvetica, sans-serif; font-size: 10.5px; letter-spacing: 0.22em; text-transform: uppercase; color: #57534e; }
  .rule { border: 0; border-top: 1.5px solid #0f172a; margin: 16px 0 22px; }
  .meta-row { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; margin: 0 0 24px; font-family: Arial, Helvetica, sans-serif; font-size: 12.5px; color: #44403c; }
  .meta-row .ref-line { margin: 0; flex: 1; }
  .date-line { margin: 0; white-space: nowrap; text-align: right; }
  .date-label { color: #78716c; margin-right: 4px; }
  .recipient { margin: 0 0 20px; }
  .recipient-name { margin: 0; font-weight: 700; font-size: 15px; color: #0f172a; }
  .recipient-meta { margin: 4px 0 0; font-family: Arial, Helvetica, sans-serif; font-size: 12.5px; color: #57534e; }
  .salutation { margin: 0 0 14px; font-size: 15px; }
  .body-text p { margin: 0 0 13px; text-align: justify; }
  .section-title { margin: 18px 0 10px; font-family: Arial, Helvetica, sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: #57534e; }
  .detail-grid { display: grid; grid-template-columns: 11.5rem 0.75rem 1fr; column-gap: 0.35rem; row-gap: 0.35rem; margin: 0 0 18px; padding: 14px 16px; border: 1px solid #d6d3d1; background: #fafaf9; }
  .detail-label { font-family: Arial, Helvetica, sans-serif; font-size: 12.5px; color: #44403c; }
  .detail-colon { text-align: center; color: #78716c; }
  .detail-value { font-weight: 600; color: #0f172a; }
  .closing { margin-top: 26px; }
  .sig-space { height: 52px; }
  .sig-name { margin: 0; font-weight: 700; }
  .sig-role { margin: 2px 0 0; font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #57534e; line-height: 1.5; }
  .ack { margin-top: 40px; padding-top: 14px; border-top: 1px solid #d6d3d1; font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #57534e; }
  .ack p { margin: 0 0 8px; text-align: left; }
  .terms { margin: 10px 0 10px 18px; padding: 0; }
  .terms li { margin-bottom: 10px; text-align: justify; }
</style>
</head>
<body data-letter-version="2">
  <div class="letterhead">
    <p class="company">{{CompanyName}}</p>
    <p class="company-line">Human Resources Department</p>
    <p class="doc-title">[[DOC_TITLE]]</p>
  </div>
  <hr class="rule" />
  <div class="meta-row">
    <div class="ref-line">[[REF_LINE]]</div>
    <div class="date-line"><span class="date-label">Date:</span> {{CurrentDate}}</div>
  </div>
  <div class="body-text">
[[BODY]]
  </div>
</body>
</html>
""";

    private static string SignatureBlock(string closing = "Yours faithfully,") =>
        "    <div class=\"closing\">\n" +
        $"      <p>{closing}</p>\n" +
        "      <div class=\"sig-space\"></div>\n" +
        "      <p class=\"sig-name\">_______________________________</p>\n" +
        "      <p class=\"sig-role\">Authorized Signatory<br/>{{CompanyName}}</p>\n" +
        "    </div>\n";

    private static string AcknowledgementBlock() => """
    <div class="ack">
      <p><strong>Employee acknowledgement</strong></p>
      <p>I have received this letter and accept the terms stated herein.</p>
      <p>Signature: _______________________________ &nbsp;&nbsp; Date: _______________</p>
    </div>
""";

    private static string RecipientBlock() => """
    <div class="recipient">
      <p class="recipient-name">{{EmployeeName}}</p>
      <p class="recipient-meta">{{JobTitle}} · {{Department}}</p>
    </div>
""";

    private static string JobConfirmationTemplate => FormalLetter(
        "Job Confirmation Letter",
        "<strong>Ref:</strong> Employment confirmation — {{EmployeeCode}}",
        RecipientBlock() +
        """
    <p class="salutation">Dear {{EmployeeName}},</p>
    <p>We are pleased to confirm your appointment at <strong>{{CompanyName}}</strong>. Your employment details are as follows:</p>
    <p class="section-title">Employment details</p>
""" +
        DetailGrid(
            ("Employee Code", "EmployeeCode"),
            ("Job Title", "JobTitle"),
            ("Department", "Department"),
            ("Location", "Location"),
            ("Date of Joining", "JoinDate"),
            ("Employment Status", "Status"),
            ("Reporting To", "ManagerName")) +
        """
    <p>We are confident that you will be a valuable addition to our team and look forward to a long and successful association with you.</p>
    <p>Please sign and return a copy of this letter as acknowledgement of receipt.</p>
""" + SignatureBlock("Sincerely,") + AcknowledgementBlock());

    private static string ProbationConfirmationTemplate => FormalLetter(
        "Probation Confirmation Letter",
        "<strong>Ref:</strong> Confirmation of permanent employment — {{EmployeeCode}}",
        RecipientBlock() +
        """
    <p class="salutation">Dear {{EmployeeName}},</p>
    <p>We are pleased to inform you that you have successfully completed your probationary period at <strong>{{CompanyName}}</strong>.</p>
    <p class="section-title">Employment details</p>
""" +
        DetailGrid(
            ("Employee Code", "EmployeeCode"),
            ("Name", "EmployeeName"),
            ("Job Title", "JobTitle"),
            ("Department", "Department"),
            ("Date of Joining", "JoinDate"),
            ("Probation End Date", "ProbationEndDate"),
            ("Date of Permanency", "DateOfPermanency")) +
        """
    <p>Effective <strong>{{DateOfPermanency}}</strong>, your employment has been confirmed as permanent. All other terms and conditions of your employment remain unchanged.</p>
    <p>Congratulations on this achievement. We look forward to your continued contribution and growth within the organization.</p>
""" + SignatureBlock("Sincerely,"));

    private static string ExperienceLetterTemplate => FormalLetter(
        "Experience / Service Certificate",
        "<strong>Ref:</strong> Service certificate — {{EmployeeCode}}",
        """
    <p class="salutation"><strong>To Whom It May Concern,</strong></p>
    <p>This is to certify that <strong>{{EmployeeName}}</strong> (Employee Code: <strong>{{EmployeeCode}}</strong>) was employed with <strong>{{CompanyName}}</strong> from <strong>{{JoinDate}}</strong> to <strong>{{TerminationDate}}</strong>.</p>
    <p class="section-title">Service details</p>
""" +
        DetailGrid(
            ("Employee Name", "EmployeeName"),
            ("Employee Code", "EmployeeCode"),
            ("Job Title", "JobTitle"),
            ("Department", "Department"),
            ("Date of Joining", "JoinDate"),
            ("Date of Leaving", "TerminationDate")) +
        """
    <p>During their tenure, {{FirstName}} demonstrated professionalism, dedication, and commitment to their role. We wish them all the best in their future endeavours.</p>
    <p>This certificate is issued upon request for whatever purpose it may serve.</p>
""" + SignatureBlock("Sincerely,"));

    private static string ResignationLetterHtml => FormalLetter(
        "Resignation — Acknowledgement",
        "<strong>Ref:</strong> Acknowledgement of resignation — {{EmployeeCode}}",
        RecipientBlock() +
        """
    <p class="salutation">Dear {{EmployeeName}},</p>
    <p>We acknowledge receipt of your resignation from the position of <strong>{{JobTitle}}</strong> within <strong>{{Department}}</strong>.</p>
    <p class="section-title">Separation details</p>
""" +
        DetailGrid(
            ("Employee Code", "EmployeeCode"),
            ("Job Title", "JobTitle"),
            ("Department", "Department"),
            ("Location", "Location"),
            ("Date of Joining", "JoinDate"),
            ("Last Working Day", "TerminationDate"),
            ("Reporting Manager", "ManagerName")) +
        """
    <p>Your separation will be processed in accordance with company policy, your employment contract, and applicable law, including settlement of dues and return of company property.</p>
    <p>Where your relieving date is not yet finalised, your manager or HR will confirm the same separately.</p>
    <p>We thank you for your contributions to {{CompanyName}} and wish you success in your future endeavours.</p>
""" + SignatureBlock("Sincerely,"));

    private static string AppointmentLetterHtml => FormalLetter(
        "Letter of Appointment",
        "<strong>Subject:</strong> Appointment to the position of {{JobTitle}}",
        RecipientBlock() +
        """
    <p class="salutation">Dear {{EmployeeName}},</p>
    <p>With reference to your application and the subsequent selection process, we are pleased to appoint you to the following role at <strong>{{CompanyName}}</strong>:</p>
    <p class="section-title">Appointment details</p>
""" +
        DetailGrid(
            ("Employee Code", "EmployeeCode"),
            ("Position / Job Title", "JobTitle"),
            ("Department", "Department"),
            ("Business Unit", "BusinessUnit"),
            ("Location", "Location"),
            ("Grade", "Grade"),
            ("Reporting To", "ManagerName"),
            ("Date of Joining", "JoinDate"),
            ("Employment Status", "Status")) +
        """
    <p>Your appointment is subject to the terms and conditions set out in your employment contract, the employee handbook, and the policies of {{CompanyName}} as may be amended from time to time.</p>
    <p>Please sign and return a copy of this letter to HR as acceptance of this appointment.</p>
""" + SignatureBlock("Yours faithfully,") + AcknowledgementBlock());

    private static string ConfirmationLetterHtml => FormalLetter(
        "Employment Confirmation",
        "<strong>Ref:</strong> Employment confirmation — {{EmployeeCode}}",
        """
    <p class="salutation"><strong>To Whom It May Concern,</strong></p>
    <p>This is to confirm that <strong>{{EmployeeName}}</strong> (Employee Code: <strong>{{EmployeeCode}}</strong>) is currently employed with <strong>{{CompanyName}}</strong> in the capacity detailed below. This letter is issued without financial liability to the company and upon the employee's request.</p>
    <p class="section-title">Employment details</p>
""" +
        DetailGrid(
            ("Full Name", "EmployeeName"),
            ("Employee Code", "EmployeeCode"),
            ("Job Title", "JobTitle"),
            ("Department", "Department"),
            ("Location", "Location"),
            ("Date of Joining", "JoinDate"),
            ("Current Status", "Status"),
            ("Reporting Manager", "ManagerName")) +
        """
    <p>For any further verification, HR may be contacted using official channels only.</p>
""" + SignatureBlock("Sincerely,"));

    private static string ContractLetterHtml => FormalLetter(
        "Employment Contract — Summary",
        "<strong>Ref:</strong> Summary of employment terms — {{EmployeeCode}}",
        RecipientBlock() +
        """
    <p class="salutation">Dear {{EmployeeName}},</p>
    <p>This letter summarises key terms of employment between <strong>{{CompanyName}}</strong> ("Company") and <strong>{{EmployeeName}}</strong> ("Employee"). The full contract, schedules, and policies referenced below form part of the understanding between the parties.</p>
    <p class="section-title">Contract summary</p>
""" +
        DetailGrid(
            ("Employee Code", "EmployeeCode"),
            ("Role", "JobTitle"),
            ("Position", "Position"),
            ("Department", "Department"),
            ("Business Unit", "BusinessUnit"),
            ("Work Location", "Location"),
            ("Grade", "Grade"),
            ("Reporting Manager", "ManagerName"),
            ("Date of Joining", "JoinDate"),
            ("Probation End Date", "ProbationEndDate"),
            ("Employment Status", "Status")) +
        """
    <ol class="terms">
      <li><strong>Role and duties.</strong> The Employee shall perform the duties of the role reasonably assigned by the Company, including those consistent with {{JobTitle}} and departmental objectives.</li>
      <li><strong>Policies.</strong> The Employee shall comply with the employee handbook, code of conduct, IT and security policies, and other internal policies as updated from time to time.</li>
      <li><strong>Compensation and benefits.</strong> Remuneration, allowances, and benefits shall be as set out in the applicable compensation schedule, payroll records, and benefit plans communicated by HR.</li>
      <li><strong>Confidentiality.</strong> The Employee shall not disclose the Company's confidential information during or after employment, except as required by law or with written consent.</li>
      <li><strong>Probation.</strong> Where applicable, probation shall be governed by the dates above and company policy until confirmed in writing.</li>
      <li><strong>Governing terms.</strong> In case of conflict, the executed employment contract and applicable law prevail over this summary.</li>
    </ol>
    <p>By signing below, the Employee acknowledges receipt of this summary and confirms that the full contract and policies have been made available for review.</p>
    <div class="closing">
      <p><strong>For the Company</strong></p>
      <div class="sig-space"></div>
      <p class="sig-name">_______________________________</p>
      <p class="sig-role">Authorized Signatory — {{CompanyName}}</p>
    </div>
    <div class="closing" style="margin-top: 36px;">
      <p><strong>Employee acceptance</strong></p>
      <div class="sig-space"></div>
      <p class="sig-name">_______________________________</p>
      <p class="sig-role">{{EmployeeName}} &nbsp;&nbsp; Date: _______________</p>
    </div>
""");
}
