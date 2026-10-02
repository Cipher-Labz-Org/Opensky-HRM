using Microsoft.EntityFrameworkCore;
using OpenSkyHRM.Domain.Entities;

namespace OpenSkyHRM.Persistence.Seeders;

/// <summary>Seeds editable transactional email templates (DocumentTemplates with TemplateKey prefix Email_).</summary>
public static class TransactionalEmailTemplateSeeder
{
    public const string LeaveApplicationKey = "Email_LeaveApplication";
    public const string LeaveApplicationSupervisorKey = "Email_LeaveApplicationSupervisor";
    public const string LeaveApplicationCoveringKey = "Email_LeaveApplicationCovering";
    public const string LeaveApprovedKey = "Email_LeaveApproved";
    public const string LeaveRejectedKey = "Email_LeaveRejected";
    public const string RecruitmentOfferKey = "Email_RecruitmentOffer";
    public const string RecruitmentInterviewCandidateKey = "Email_RecruitmentInterviewCandidate";
    public const string RecruitmentInterviewInterviewerKey = "Email_RecruitmentInterviewInterviewer";

    public static async Task EnsureAsync(AppDbContext context)
    {
        if (!await context.DocumentTemplates.AnyAsync(t => t.TemplateKey == LeaveApplicationKey))
        {
            context.DocumentTemplates.Add(new DocumentTemplate
            {
                Name = "Email: Leave application confirmation",
                TemplateKey = LeaveApplicationKey,
                Subject = "Leave request received",
                HtmlContent = LeaveApplicationHtml,
                IsActive = true,
            });
        }

        if (!await context.DocumentTemplates.AnyAsync(t => t.TemplateKey == LeaveApplicationSupervisorKey))
        {
            context.DocumentTemplates.Add(new DocumentTemplate
            {
                Name = "Email: Leave application (supervisor)",
                TemplateKey = LeaveApplicationSupervisorKey,
                Subject = "{{EmployeeName}} submitted a leave request",
                HtmlContent = LeaveApplicationSupervisorHtml,
                IsActive = true,
            });
        }
        else
        {
            var supervisorTemplate = await context.DocumentTemplates.FirstAsync(t => t.TemplateKey == LeaveApplicationSupervisorKey);
            UpgradeSupervisorApprovalLink(supervisorTemplate);
        }

        if (!await context.DocumentTemplates.AnyAsync(t => t.TemplateKey == LeaveApplicationCoveringKey))
        {
            context.DocumentTemplates.Add(new DocumentTemplate
            {
                Name = "Email: Leave application (covering person)",
                TemplateKey = LeaveApplicationCoveringKey,
                Subject = "You are covering for {{EmployeeName}}",
                HtmlContent = LeaveApplicationCoveringHtml,
                IsActive = true,
            });
        }

        if (!await context.DocumentTemplates.AnyAsync(t => t.TemplateKey == LeaveApprovedKey))
        {
            context.DocumentTemplates.Add(new DocumentTemplate
            {
                Name = "Email: Leave request approved",
                TemplateKey = LeaveApprovedKey,
                Subject = "Leave request approved",
                HtmlContent = LeaveApprovedHtml,
                IsActive = true,
            });
        }

        if (!await context.DocumentTemplates.AnyAsync(t => t.TemplateKey == LeaveRejectedKey))
        {
            context.DocumentTemplates.Add(new DocumentTemplate
            {
                Name = "Email: Leave request rejected",
                TemplateKey = LeaveRejectedKey,
                Subject = "Leave request rejected",
                HtmlContent = LeaveRejectedHtml,
                IsActive = true,
            });
        }

        if (!await context.DocumentTemplates.AnyAsync(t => t.TemplateKey == RecruitmentOfferKey))
        {
            context.DocumentTemplates.Add(new DocumentTemplate
            {
                Name = "Email: Recruitment offer",
                TemplateKey = RecruitmentOfferKey,
                Subject = "Offer of Employment – {{PositionTitle}}",
                HtmlContent = RecruitmentOfferHtml,
                IsActive = true,
            });
        }

        if (!await context.DocumentTemplates.AnyAsync(t => t.TemplateKey == RecruitmentInterviewCandidateKey))
        {
            context.DocumentTemplates.Add(new DocumentTemplate
            {
                Name = "Email: Interview scheduled (candidate)",
                TemplateKey = RecruitmentInterviewCandidateKey,
                Subject = "Interview scheduled: {{InterviewTitle}}",
                HtmlContent = RecruitmentInterviewCandidateHtml,
                IsActive = true,
            });
        }

        if (!await context.DocumentTemplates.AnyAsync(t => t.TemplateKey == RecruitmentInterviewInterviewerKey))
        {
            context.DocumentTemplates.Add(new DocumentTemplate
            {
                Name = "Email: Interview scheduled (interviewer)",
                TemplateKey = RecruitmentInterviewInterviewerKey,
                Subject = "Interview assignment: {{CandidateName}}",
                HtmlContent = RecruitmentInterviewInterviewerHtml,
                IsActive = true,
            });
        }

        await context.SaveChangesAsync();
    }

    private static void UpgradeSupervisorApprovalLink(DocumentTemplate template)
    {
        if (string.IsNullOrWhiteSpace(template.HtmlContent))
            return;
        if (template.HtmlContent.Contains("{{ApprovalUrl}}", StringComparison.Ordinal)
            || template.HtmlContent.Contains("/app/approvals", StringComparison.OrdinalIgnoreCase))
            return;

        const string needle = "Open Leave &amp; Absence in OpenSky HRM to approve or reject this request.";
        const string replacement = """
            Open Leave &amp; Absence in OpenSky HRM to approve or reject this request.
                  </p>
                  <p style="margin: 24px 0 8px; text-align: center;">
                    <a href="{{ApprovalUrl}}" style="display:inline-block;background:#2B7DE9;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:600;">Review waiting approvals</a>
                  </p>
                  <p style="font-size: 13px; line-height: 1.55; color: #666; margin: 0; text-align: center;">
                    Sign in with your username and password if prompted, then you will see all leave requests waiting for your approval.
            """;
        if (template.HtmlContent.Contains(needle, StringComparison.Ordinal))
            template.HtmlContent = template.HtmlContent.Replace(needle, replacement);
    }

    private const string LeaveApplicationHtml = """
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: 'Segoe UI', Arial, sans-serif; color: #1a1a2e; margin: 0; padding: 0; background: #f5f6fa;">
  <div style="max-width: 600px; margin: 20px auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,0.08);">
    <div style="background: linear-gradient(135deg, #1e3a5f 0%, #2B7DE9 100%); padding: 28px 36px; color: white;">
      <h1 style="margin: 0; font-size: 22px; font-weight: 600;">Leave request received</h1>
      <p style="margin: 8px 0 0; opacity: 0.9; font-size: 14px;">OpenSky HRM</p>
    </div>
    <div style="padding: 28px 36px;">
      <p style="font-size: 16px; margin: 0 0 16px;">Hi <strong>{{EmployeeName}}</strong>,</p>
      <p style="font-size: 15px; line-height: 1.6; margin: 0 0 20px;">
        Your leave application has been submitted successfully and is now <strong>{{Status}}</strong>.
      </p>
      <div style="background: #f8f9fe; border-radius: 8px; padding: 18px 22px; margin: 0 0 20px;">
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
          <tr><td style="padding: 8px 0; color: #666;">Leave type</td><td style="padding: 8px 0; font-weight: 600; text-align: right;">{{LeaveTypeName}}</td></tr>
          <tr><td style="padding: 8px 0; color: #666;">Start</td><td style="padding: 8px 0; font-weight: 600; text-align: right;">{{StartDate}}</td></tr>
          <tr><td style="padding: 8px 0; color: #666;">End</td><td style="padding: 8px 0; font-weight: 600; text-align: right;">{{EndDate}}</td></tr>
          <tr><td style="padding: 8px 0; color: #666;">Total days</td><td style="padding: 8px 0; font-weight: 600; text-align: right;">{{TotalDays}}</td></tr>
          <tr><td style="padding: 8px 0; color: #666;">Reason</td><td style="padding: 8px 0; text-align: right;">{{Reason}}</td></tr>
        </table>
      </div>
      <p style="font-size: 14px; line-height: 1.6; color: #555; margin: 0;">
        You will be notified when your request is approved or rejected. If you have questions, contact HR.
      </p>
    </div>
    <div style="background: #f5f6fa; padding: 16px 36px; text-align: center; font-size: 12px; color: #999;">
      This is an automated message from OpenSky HRM.
    </div>
  </div>
</body>
</html>
""";

    private const string LeaveApplicationSupervisorHtml = """
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: 'Segoe UI', Arial, sans-serif; color: #1a1a2e; margin: 0; padding: 0; background: #f5f6fa;">
  <div style="max-width: 600px; margin: 20px auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,0.08);">
    <div style="background: linear-gradient(135deg, #1e3a5f 0%, #2B7DE9 100%); padding: 28px 36px; color: white;">
      <h1 style="margin: 0; font-size: 22px; font-weight: 600;">Leave request pending your approval</h1>
      <p style="margin: 8px 0 0; opacity: 0.9; font-size: 14px;">OpenSky HRM</p>
    </div>
    <div style="padding: 28px 36px;">
      <p style="font-size: 16px; margin: 0 0 16px;">Hi <strong>{{SupervisorName}}</strong>,</p>
      <p style="font-size: 15px; line-height: 1.6; margin: 0 0 20px;">
        <strong>{{EmployeeName}}</strong> has submitted a leave request and it is now <strong>{{Status}}</strong>. Please review it in Leave &amp; Absence.
      </p>
      <div style="background: #f8f9fe; border-radius: 8px; padding: 18px 22px; margin: 0 0 20px;">
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
          <tr><td style="padding: 8px 0; color: #666;">Employee</td><td style="padding: 8px 0; font-weight: 600; text-align: right;">{{EmployeeName}}</td></tr>
          <tr><td style="padding: 8px 0; color: #666;">Leave type</td><td style="padding: 8px 0; font-weight: 600; text-align: right;">{{LeaveTypeName}}</td></tr>
          <tr><td style="padding: 8px 0; color: #666;">Start</td><td style="padding: 8px 0; font-weight: 600; text-align: right;">{{StartDate}}</td></tr>
          <tr><td style="padding: 8px 0; color: #666;">End</td><td style="padding: 8px 0; font-weight: 600; text-align: right;">{{EndDate}}</td></tr>
          <tr><td style="padding: 8px 0; color: #666;">Total days</td><td style="padding: 8px 0; font-weight: 600; text-align: right;">{{TotalDays}}</td></tr>
          <tr><td style="padding: 8px 0; color: #666;">Reason</td><td style="padding: 8px 0; text-align: right;">{{Reason}}</td></tr>
        </table>
      </div>
      <p style="font-size: 14px; line-height: 1.6; color: #555; margin: 0;">
        Open Leave &amp; Absence in OpenSky HRM to approve or reject this request.
      </p>
      <p style="margin: 24px 0 8px; text-align: center;">
        <a href="{{ApprovalUrl}}" style="display:inline-block;background:#2B7DE9;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:600;">Review waiting approvals</a>
      </p>
      <p style="font-size: 13px; line-height: 1.55; color: #666; margin: 0; text-align: center;">
        Sign in with your username and password if prompted, then you will see all leave requests waiting for your approval.
      </p>
    </div>
    <div style="background: #f5f6fa; padding: 16px 36px; text-align: center; font-size: 12px; color: #999;">
      This is an automated message from OpenSky HRM.
    </div>
  </div>
</body>
</html>
""";

    private const string LeaveApplicationCoveringHtml = """
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: 'Segoe UI', Arial, sans-serif; color: #1a1a2e; margin: 0; padding: 0; background: #f5f6fa;">
  <div style="max-width: 600px; margin: 20px auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,0.08);">
    <div style="background: linear-gradient(135deg, #1e3a5f 0%, #2B7DE9 100%); padding: 28px 36px; color: white;">
      <h1 style="margin: 0; font-size: 22px; font-weight: 600;">You are named as covering person</h1>
      <p style="margin: 8px 0 0; opacity: 0.9; font-size: 14px;">OpenSky HRM</p>
    </div>
    <div style="padding: 28px 36px;">
      <p style="font-size: 16px; margin: 0 0 16px;">Hi <strong>{{CoveringPersonName}}</strong>,</p>
      <p style="font-size: 15px; line-height: 1.6; margin: 0 0 20px;">
        <strong>{{EmployeeName}}</strong> has submitted a leave request and named you as the covering person. The request is currently <strong>{{Status}}</strong>.
      </p>
      <div style="background: #f8f9fe; border-radius: 8px; padding: 18px 22px; margin: 0 0 20px;">
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
          <tr><td style="padding: 8px 0; color: #666;">Employee</td><td style="padding: 8px 0; font-weight: 600; text-align: right;">{{EmployeeName}}</td></tr>
          <tr><td style="padding: 8px 0; color: #666;">Leave type</td><td style="padding: 8px 0; font-weight: 600; text-align: right;">{{LeaveTypeName}}</td></tr>
          <tr><td style="padding: 8px 0; color: #666;">Start</td><td style="padding: 8px 0; font-weight: 600; text-align: right;">{{StartDate}}</td></tr>
          <tr><td style="padding: 8px 0; color: #666;">End</td><td style="padding: 8px 0; font-weight: 600; text-align: right;">{{EndDate}}</td></tr>
          <tr><td style="padding: 8px 0; color: #666;">Total days</td><td style="padding: 8px 0; font-weight: 600; text-align: right;">{{TotalDays}}</td></tr>
          <tr><td style="padding: 8px 0; color: #666;">Reason</td><td style="padding: 8px 0; text-align: right;">{{Reason}}</td></tr>
        </table>
      </div>
      <p style="font-size: 14px; line-height: 1.6; color: #555; margin: 0;">
        Please be available to cover duties during this period if the request is approved.
      </p>
    </div>
    <div style="background: #f5f6fa; padding: 16px 36px; text-align: center; font-size: 12px; color: #999;">
      This is an automated message from OpenSky HRM.
    </div>
  </div>
</body>
</html>
""";

    private const string LeaveApprovedHtml = """
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: 'Segoe UI', Arial, sans-serif; color: #1a1a2e; margin: 0; padding: 0; background: #f5f6fa;">
  <div style="max-width: 600px; margin: 20px auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,0.08);">
    <div style="background: linear-gradient(135deg, #1e3a5f 0%, #2B7DE9 100%); padding: 28px 36px; color: white;">
      <h1 style="margin: 0; font-size: 22px; font-weight: 600;">Leave request approved</h1>
      <p style="margin: 8px 0 0; opacity: 0.9; font-size: 14px;">OpenSky HRM</p>
    </div>
    <div style="padding: 28px 36px;">
      <p style="font-size: 16px; margin: 0 0 16px;">Hi <strong>{{EmployeeName}}</strong>,</p>
      <p style="font-size: 15px; line-height: 1.6; margin: 0 0 20px;">
        Good news — <strong>{{ApproverName}}</strong> has approved your leave request.
      </p>
      <div style="background: #f8f9fe; border-radius: 8px; padding: 18px 22px; margin: 0 0 20px;">
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
          <tr><td style="padding: 8px 0; color: #666;">Leave type</td><td style="padding: 8px 0; font-weight: 600; text-align: right;">{{LeaveTypeName}}</td></tr>
          <tr><td style="padding: 8px 0; color: #666;">Start</td><td style="padding: 8px 0; font-weight: 600; text-align: right;">{{StartDate}}</td></tr>
          <tr><td style="padding: 8px 0; color: #666;">End</td><td style="padding: 8px 0; font-weight: 600; text-align: right;">{{EndDate}}</td></tr>
          <tr><td style="padding: 8px 0; color: #666;">Total days</td><td style="padding: 8px 0; font-weight: 600; text-align: right;">{{TotalDays}}</td></tr>
          <tr><td style="padding: 8px 0; color: #666;">Decided by</td><td style="padding: 8px 0; font-weight: 600; text-align: right;">{{ApproverName}}</td></tr>
          <tr><td style="padding: 8px 0; color: #666;">Remarks</td><td style="padding: 8px 0; text-align: right;">{{Remarks}}</td></tr>
        </table>
      </div>
      <p style="font-size: 14px; line-height: 1.6; color: #555; margin: 0;">
        You can review this request in Leave &amp; Absence. If you have questions, contact HR or your supervisor.
      </p>
    </div>
    <div style="background: #f5f6fa; padding: 16px 36px; text-align: center; font-size: 12px; color: #999;">
      This is an automated message from OpenSky HRM.
    </div>
  </div>
</body>
</html>
""";

    private const string LeaveRejectedHtml = """
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: 'Segoe UI', Arial, sans-serif; color: #1a1a2e; margin: 0; padding: 0; background: #f5f6fa;">
  <div style="max-width: 600px; margin: 20px auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,0.08);">
    <div style="background: linear-gradient(135deg, #1e3a5f 0%, #2B7DE9 100%); padding: 28px 36px; color: white;">
      <h1 style="margin: 0; font-size: 22px; font-weight: 600;">Leave request rejected</h1>
      <p style="margin: 8px 0 0; opacity: 0.9; font-size: 14px;">OpenSky HRM</p>
    </div>
    <div style="padding: 28px 36px;">
      <p style="font-size: 16px; margin: 0 0 16px;">Hi <strong>{{EmployeeName}}</strong>,</p>
      <p style="font-size: 15px; line-height: 1.6; margin: 0 0 20px;">
        <strong>{{ApproverName}}</strong> has rejected your leave request.
      </p>
      <div style="background: #f8f9fe; border-radius: 8px; padding: 18px 22px; margin: 0 0 20px;">
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
          <tr><td style="padding: 8px 0; color: #666;">Leave type</td><td style="padding: 8px 0; font-weight: 600; text-align: right;">{{LeaveTypeName}}</td></tr>
          <tr><td style="padding: 8px 0; color: #666;">Start</td><td style="padding: 8px 0; font-weight: 600; text-align: right;">{{StartDate}}</td></tr>
          <tr><td style="padding: 8px 0; color: #666;">End</td><td style="padding: 8px 0; font-weight: 600; text-align: right;">{{EndDate}}</td></tr>
          <tr><td style="padding: 8px 0; color: #666;">Total days</td><td style="padding: 8px 0; font-weight: 600; text-align: right;">{{TotalDays}}</td></tr>
          <tr><td style="padding: 8px 0; color: #666;">Decided by</td><td style="padding: 8px 0; font-weight: 600; text-align: right;">{{ApproverName}}</td></tr>
          <tr><td style="padding: 8px 0; color: #666;">Remarks</td><td style="padding: 8px 0; text-align: right;">{{Remarks}}</td></tr>
        </table>
      </div>
      <p style="font-size: 14px; line-height: 1.6; color: #555; margin: 0;">
        You can review this request in Leave &amp; Absence. If you have questions, contact HR or your supervisor.
      </p>
    </div>
    <div style="background: #f5f6fa; padding: 16px 36px; text-align: center; font-size: 12px; color: #999;">
      This is an automated message from OpenSky HRM.
    </div>
  </div>
</body>
</html>
""";

    private const string RecruitmentOfferHtml = """
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: 'Segoe UI', Arial, sans-serif; color: #1a1a2e; margin: 0; padding: 0; background: #f5f6fa;">
  <div style="max-width: 600px; margin: 20px auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,0.08);">
    <div style="background: linear-gradient(90deg, #1a3a6e 0%, #1e4a8c 50%, #2e78e6 100%); padding: 28px 36px; color: white;">
      {{CompanyHeaderHtml}}
    </div>
    <div style="padding: 32px 40px;">
      <p style="font-size: 16px; margin: 0 0 16px;">Dear <strong>{{CandidateName}}</strong>,</p>
      <p style="font-size: 15px; line-height: 1.6; margin: 0 0 20px;">
        We are pleased to extend an offer of employment for the position of
        <strong>{{PositionTitle}}</strong>. We were impressed with your qualifications
        and believe you will be a valuable addition to our team.
      </p>
      <div style="background: #f8f9fe; border-radius: 8px; padding: 20px 24px; margin: 0 0 20px;">
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
          <tr>
            <td style="padding: 8px 0; color: #666;">Position</td>
            <td style="padding: 8px 0; font-weight: 600; text-align: right;">{{PositionTitle}}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #666;">Salary</td>
            <td style="padding: 8px 0; font-weight: 600; text-align: right;">{{SalaryFormatted}}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #666;">Proposed Joining Date</td>
            <td style="padding: 8px 0; font-weight: 600; text-align: right;">{{JoiningDate}}</td>
          </tr>
        </table>
      </div>
      {{RemarksHtml}}
      <p style="font-size: 15px; line-height: 1.6; margin: 0 0 8px;">
        Please review the details and let us know your decision at your earliest convenience.
      </p>
      {{OfferActionsHtml}}
      <p style="font-size: 15px; margin: 24px 0 0;">
        Best regards,<br />
        <strong>Human Resources</strong><br />
        <span style="color: #666; font-size: 13px;">{{CompanyName}}</span>
      </p>
    </div>
    <div style="background: #f5f6fa; padding: 16px 40px; text-align: center; font-size: 12px; color: #999;">
      This is an automated email from OpenSky HRM. Please do not reply directly.
    </div>
  </div>
</body>
</html>
""";

    private const string RecruitmentInterviewCandidateHtml = """
<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="font-family:'Segoe UI',Arial,sans-serif;color:#1a1a2e;margin:0;padding:0;background:#f5f6fa;">
  <div style="max-width:600px;margin:20px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#1e3a5f 0%,#2B7DE9 100%);padding:28px 36px;color:white;">
      <h1 style="margin:0;font-size:22px;font-weight:600;">Your interview is scheduled</h1>
      <p style="margin:8px 0 0;opacity:0.9;font-size:14px;">OpenSky HRM</p>
    </div>
    <div style="padding:28px 36px;">
      <p style="font-size:16px;margin:0 0 16px;">Hi <strong>{{CandidateName}}</strong>,</p>
      <p style="font-size:15px;line-height:1.6;margin:0 0 20px;">You have been scheduled for an interview for <strong>{{RequisitionTitle}}</strong>.</p>
      <div style="background:#f8f9fe;border-radius:8px;padding:18px 22px;margin:0 0 20px;">
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <tr><td style="padding:8px 0;color:#666;">Session</td><td style="padding:8px 0;font-weight:600;text-align:right;">{{InterviewTitle}}</td></tr>
          <tr><td style="padding:8px 0;color:#666;">When</td><td style="padding:8px 0;font-weight:600;text-align:right;">{{ScheduledAt}}</td></tr>
          <tr><td style="padding:8px 0;color:#666;">Duration</td><td style="padding:8px 0;font-weight:600;text-align:right;">{{DurationMinutes}} minutes</td></tr>
          <tr><td style="padding:8px 0;color:#666;">Type</td><td style="padding:8px 0;text-align:right;">{{InterviewType}}</td></tr>
          <tr><td style="padding:8px 0;color:#666;">Location</td><td style="padding:8px 0;text-align:right;">{{Location}}</td></tr>
          <tr><td style="padding:8px 0;color:#666;">Interviewer</td><td style="padding:8px 0;text-align:right;">{{InterviewerName}}</td></tr>
        </table>
      </div>
      <p style="font-size:14px;line-height:1.6;color:#555;margin:0;">If you need to reschedule, please contact HR.</p>
    </div>
    <div style="background:#f5f6fa;padding:16px 36px;text-align:center;font-size:12px;color:#999;">This is an automated message from OpenSky HRM.</div>
  </div>
</body></html>
""";

    private const string RecruitmentInterviewInterviewerHtml = """
<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="font-family:'Segoe UI',Arial,sans-serif;color:#1a1a2e;margin:0;padding:0;background:#f5f6fa;">
  <div style="max-width:600px;margin:20px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#1a1a2e 0%,#16213e 100%);padding:28px 36px;color:white;">
      <h1 style="margin:0;font-size:22px;font-weight:600;">Interview assignment</h1>
      <p style="margin:8px 0 0;opacity:0.85;font-size:14px;">OpenSky HRM</p>
    </div>
    <div style="padding:28px 36px;">
      <p style="font-size:16px;margin:0 0 16px;">Hi <strong>{{InterviewerName}}</strong>,</p>
      <p style="font-size:15px;line-height:1.6;margin:0 0 20px;">You are scheduled to interview <strong>{{CandidateName}}</strong> for <strong>{{RequisitionTitle}}</strong>.</p>
      <div style="background:#f8f9fe;border-radius:8px;padding:18px 22px;margin:0 0 20px;">
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <tr><td style="padding:8px 0;color:#666;">Session</td><td style="padding:8px 0;font-weight:600;text-align:right;">{{InterviewTitle}}</td></tr>
          <tr><td style="padding:8px 0;color:#666;">When</td><td style="padding:8px 0;font-weight:600;text-align:right;">{{ScheduledAt}}</td></tr>
          <tr><td style="padding:8px 0;color:#666;">Duration</td><td style="padding:8px 0;font-weight:600;text-align:right;">{{DurationMinutes}} minutes</td></tr>
          <tr><td style="padding:8px 0;color:#666;">Type</td><td style="padding:8px 0;text-align:right;">{{InterviewType}}</td></tr>
          <tr><td style="padding:8px 0;color:#666;">Location</td><td style="padding:8px 0;text-align:right;">{{Location}}</td></tr>
        </table>
      </div>
      <p style="font-size:14px;line-height:1.6;color:#555;margin:0;">Please review the candidate in OpenSky HRM before the session.</p>
    </div>
    <div style="background:#f5f6fa;padding:16px 36px;text-align:center;font-size:12px;color:#999;">This is an automated message from OpenSky HRM.</div>
  </div>
</body></html>
""";
}
