using Microsoft.EntityFrameworkCore;
using OpenSkyHRM.Application.DTOs.Payroll;
using OpenSkyHRM.Application.Interfaces;
using OpenSkyHRM.Domain;
using OpenSkyHRM.Domain.Entities;
using OpenSkyHRM.Domain.Enums;
using OpenSkyHRM.Persistence;

namespace OpenSkyHRM.Application.Services;

public class PayrollAttendanceImportService : IPayrollAttendanceImportService
{
    private readonly AppDbContext _db;
    private readonly IAttendanceService _attendance;
    private readonly ISystemSettingService _settings;
    private readonly PayrollCalculationEngine _engine;

    public PayrollAttendanceImportService(
        AppDbContext db,
        IAttendanceService attendance,
        ISystemSettingService settings,
        PayrollCalculationEngine engine)
    {
        _db = db;
        _attendance = attendance;
        _settings = settings;
        _engine = engine;
    }

    public Task<PayrollAttendanceImportPreviewDto> PreviewImportAsync(Guid batchId)
        => BuildPreviewAsync(batchId, persist: false);

    public async Task<PayrollAttendanceImportResultDto> ImportAsync(Guid batchId)
    {
        var preview = await BuildPreviewAsync(batchId, persist: true);
        var (recalculated, recalcError) = await TryRecalculateAfterImportAsync(batchId);
        return new PayrollAttendanceImportResultDto
        {
            ImportedCount = preview.Lines.Count,
            OtLinesUpdated = preview.Lines.Count(l => l.OtApproved && l.OtAmount > 0),
            Recalculated = recalculated,
            RecalculateError = recalcError,
            Preview = preview,
        };
    }

    public async Task<PayrollEmployeeWorkedHoursDto> GetEmployeeWorkedHoursAsync(Guid batchId, Guid employeeId)
    {
        var batch = await _db.PayrollBatches.AsNoTracking().FirstOrDefaultAsync(b => b.Id == batchId)
            ?? throw new InvalidOperationException("Batch not found.");

        var periodFrom = batch.EffectiveFrom.Date;
        var periodTo = (batch.EffectiveTo ?? batch.EffectiveFrom).Date;
        var rows = await _attendance.CalculateOvertimeNopayAsync(
            periodFrom, periodTo, employeeId: employeeId, includeEmployeeIds: new[] { employeeId });
        var att = rows.FirstOrDefault();
        var leaveDays = (await GetUnpaidLeaveDaysAsync(new[] { employeeId }, periodFrom, periodTo))
            .GetValueOrDefault(employeeId);
        var attendanceNopay = att?.NopayDays ?? 0;
        var poyaDays = (await PayrollPoyaAttendance.GetDaysWorkedByEmployeeAsync(
                _db, new[] { employeeId }, periodFrom, periodTo))
            .GetValueOrDefault(employeeId);
        return new PayrollEmployeeWorkedHoursDto
        {
            EmployeeId = employeeId,
            TotalWorkedHours = Math.Round(att?.TotalWorkedHours ?? 0m, 2),
            AttendanceNopayDays = attendanceNopay,
            LeaveNopayDays = leaveDays,
            TotalNopayDays = attendanceNopay + leaveDays,
            PoyaDaysWorked = poyaDays,
        };
    }

    private async Task<(bool Recalculated, string? Error)> TryRecalculateAfterImportAsync(Guid batchId)
    {
        var batch = await _db.PayrollBatches.AsNoTracking().FirstOrDefaultAsync(b => b.Id == batchId);
        if (batch is null)
            return (false, "Batch not found.");

        if (batch.Status != BatchStatus.Draft && batch.Status != BatchStatus.Calculated)
            return (false, null);

        try
        {
            await _engine.CalculateBatchAsync(batchId);
            return (true, null);
        }
        catch (InvalidOperationException ex)
        {
            return (false, ex.Message);
        }
    }

    private async Task<PayrollAttendanceImportPreviewDto> BuildPreviewAsync(Guid batchId, bool persist)
    {
        var batch = await _db.PayrollBatches.FirstOrDefaultAsync(b => b.Id == batchId)
            ?? throw new InvalidOperationException("Batch not found.");

        if (batch.Status != BatchStatus.Draft && batch.Status != BatchStatus.Calculated)
            throw new InvalidOperationException($"Batch is in '{batch.Status}' status and cannot import attendance data.");

        if (batch.ProcessType != PayrollProcessType.Salary && batch.ProcessType != PayrollProcessType.OtherTransactions)
            throw new InvalidOperationException("Attendance import is only supported for Salary and Other Transactions batches.");

        var selectedIds = ParseSelectedEmployeeIds(batch);
        if (selectedIds.Count == 0)
            throw new InvalidOperationException("No employees selected on this batch.");

        var periodFrom = batch.EffectiveFrom.Date;
        var periodTo = (batch.EffectiveTo ?? batch.EffectiveFrom).Date;

        var otSettings = await LoadOtSettingsAsync();
        var mapping = await LoadComponentMappingAsync();
        var otComponent = await _db.CompensationComponents
                .FirstOrDefaultAsync(c => c.Code == mapping.OtComponentCode && c.IsActive)
            ?? throw new InvalidOperationException(
                $"OT compensation component '{mapping.OtComponentCode}' not found. Map it under Payroll Settings.");

        var attendanceRows = await _attendance.CalculateOvertimeNopayAsync(
            periodFrom, periodTo, includeEmployeeIds: selectedIds);
        var attendanceByEmp = attendanceRows.ToDictionary(r => r.EmployeeId);

        var leaveNopayDays = await GetUnpaidLeaveDaysAsync(selectedIds, periodFrom, periodTo);
        var basicByEmp = await GetBasePayByEmployeeAsync(selectedIds, periodFrom, periodTo, mapping.BaseComponentCode);
        var workingHoursByEmp = await GetWorkingHoursByEmployeeAsync(
            selectedIds, periodFrom, periodTo, mapping.WorkingHoursComponentCode);
        var employees = await _db.Employees
            .Where(e => selectedIds.Contains(e.Id))
            .ToDictionaryAsync(e => e.Id);

        var lines = new List<PayrollAttendanceImportLineDto>();
        foreach (var empId in selectedIds)
        {
            attendanceByEmp.TryGetValue(empId, out var att);
            basicByEmp.TryGetValue(empId, out var basic);
            workingHoursByEmp.TryGetValue(empId, out var mappedHours);
            leaveNopayDays.TryGetValue(empId, out var leaveDays);
            employees.TryGetValue(empId, out var emp);

            var otApproved = string.Equals(att?.OvertimeApprovalStatus, ApprovalStatus.Approved.ToString(), StringComparison.OrdinalIgnoreCase);
            var approvedHours = otApproved ? (att?.ApprovedOvertimeHoursSnapshot ?? 0m) : 0m;
            var otOutdated = att?.OvertimeHoursOutdated ?? false;
            var attendanceNopay = att?.NopayDays ?? 0;
            var totalNopay = attendanceNopay + leaveDays;
            var divisor = mappedHours > 0 ? mappedHours : otSettings.Divisor;

            decimal otAmount = 0m;
            if (otApproved && approvedHours > 0 && basic > 0 && divisor > 0)
                otAmount = PayrollCalculationEngine.CalculateOtAmount(
                    basic, divisor, otSettings.Multiplier, approvedHours);

            string? warning = null;
            if ((att?.OvertimeHours ?? 0) > 0 && !otApproved)
            {
                warning = string.Equals(att?.OtStatus, "SupervisorNotAssigned", StringComparison.OrdinalIgnoreCase)
                    ? "Supervisor not assigned — OT cannot be paid until a supervisor is assigned and approves."
                    : "OT hours are pending approval and will not be included in payroll.";
            }
            else if (otOutdated)
                warning = "Approved OT hours are outdated — re-approve in Attendance/Approvals.";
            else if (otApproved && approvedHours > 0 && basic <= 0)
                warning = $"No '{mapping.BaseComponentCode}' salary found for OT rate calculation.";

            lines.Add(new PayrollAttendanceImportLineDto
            {
                EmployeeId = empId,
                EmployeeName = emp != null ? $"{emp.FirstName} {emp.LastName}" : att?.EmployeeName ?? "",
                EmployeeCode = emp?.EmployeeCode ?? att?.EmployeeCode,
                ApprovedOtHours = approvedHours,
                OtAmount = otAmount,
                OtApproved = otApproved,
                OtOutdated = otOutdated,
                AttendanceNopayDays = attendanceNopay,
                LeaveNopayDays = leaveDays,
                TotalNopayDays = totalNopay,
                PoyaDaysWorked = 0,
                TotalWorkedHours = Math.Round(att?.TotalWorkedHours ?? 0m, 2),
                BasicPay = basic,
                Warning = warning,
            });
        }

        var preview = new PayrollAttendanceImportPreviewDto
        {
            BatchId = batch.Id,
            BatchCode = batch.BatchCode,
            EffectiveFrom = periodFrom,
            EffectiveTo = periodTo,
            Lines = lines.OrderBy(l => l.EmployeeName).ToList(),
            EmployeesWithApprovedOt = lines.Count(l => l.OtApproved && l.ApprovedOtHours > 0),
            EmployeesMissingOtApproval = lines.Count(l =>
            {
                attendanceByEmp.TryGetValue(l.EmployeeId, out var a);
                return !l.OtApproved && (a?.OvertimeHours ?? 0) > 0;
            }),
            EmployeesWithNopay = lines.Count(l => l.TotalNopayDays > 0),
            EmployeesWithPoya = 0,
        };

        if (persist)
            await PersistImportAsync(batch, otComponent.Id, periodFrom, periodTo, lines);

        return preview;
    }

    private async Task PersistImportAsync(
        PayrollBatch batch, Guid otComponentId, DateTime periodFrom, DateTime periodTo,
        List<PayrollAttendanceImportLineDto> lines)
    {
        var now = DateTime.UtcNow;
        var existingSnapshots = await _db.PayrollBatchAttendanceSnapshots
            .Where(s => s.BatchId == batch.Id)
            .ToListAsync();
        _db.PayrollBatchAttendanceSnapshots.RemoveRange(existingSnapshots);

        var hoursComponent = (await _db.CompensationComponents
                .Where(c => c.IsActive)
                .ToListAsync())
            .FirstOrDefault(c => PayrollComponentMapping.IsWorkedHoursQuantity(c.Code));

        foreach (var line in lines)
        {
            _db.PayrollBatchAttendanceSnapshots.Add(new PayrollBatchAttendanceSnapshot
            {
                BatchId = batch.Id,
                EmployeeId = line.EmployeeId,
                ApprovedOtHours = line.ApprovedOtHours,
                OtAmount = line.OtAmount,
                AttendanceNopayDays = line.AttendanceNopayDays,
                LeaveNopayDays = line.LeaveNopayDays,
                TotalNopayDays = line.TotalNopayDays,
                PoyaDaysWorked = 0,
                TotalWorkedHours = line.TotalWorkedHours,
                OtApproved = line.OtApproved,
                OtOutdated = line.OtOutdated,
                ImportedAt = now,
            });

            await UpsertBatchCompensationAsync(batch.Id, line.EmployeeId, otComponentId, line.OtAmount, periodFrom, periodTo);
            if (hoursComponent != null)
                await UpsertBatchCompensationAsync(batch.Id, line.EmployeeId, hoursComponent.Id, line.TotalWorkedHours, periodFrom, periodTo);
        }

        await _db.SaveChangesAsync();
    }

    private async Task UpsertBatchCompensationAsync(
        Guid batchId, Guid employeeId, Guid componentId, decimal amount,
        DateTime periodFrom, DateTime periodTo)
    {
        amount = PayrollCalculationEngine.RoundPayrollAmount(amount);
        var existing = await _db.EmployeeCompensations
            .FirstOrDefaultAsync(ec => ec.BatchId == batchId && ec.EmployeeId == employeeId && ec.ComponentId == componentId);

        if (amount <= 0)
        {
            if (existing != null)
                _db.EmployeeCompensations.Remove(existing);
            return;
        }

        if (existing == null)
        {
            _db.EmployeeCompensations.Add(new EmployeeCompensation
            {
                EmployeeId = employeeId,
                ComponentId = componentId,
                Amount = amount,
                Currency = "LKR",
                EffectiveFrom = periodFrom,
                EffectiveTo = periodTo,
                BatchId = batchId,
                IsActive = true,
            });
        }
        else
        {
            existing.Amount = amount;
            existing.EffectiveFrom = periodFrom;
            existing.EffectiveTo = periodTo;
            existing.IsActive = true;
        }
    }

    private async Task<Dictionary<Guid, int>> GetUnpaidLeaveDaysAsync(
        IReadOnlyList<Guid> employeeIds, DateTime periodFrom, DateTime periodTo)
    {
        var leaves = await _db.LeaveRequests
            .Include(lr => lr.LeaveType)
            .Where(lr => lr.Status == ApprovalStatus.Approved
                && employeeIds.Contains(lr.EmployeeId)
                && !lr.LeaveType.IsPaid
                && lr.StartDate.Date <= periodTo
                && lr.EndDate.Date >= periodFrom)
            .Select(lr => new { lr.EmployeeId, lr.StartDate, lr.EndDate })
            .ToListAsync();

        var result = new Dictionary<Guid, int>();
        foreach (var leave in leaves)
        {
            var start = leave.StartDate.Date < periodFrom ? periodFrom : leave.StartDate.Date;
            var end = leave.EndDate.Date > periodTo ? periodTo : leave.EndDate.Date;
            var days = (int)(end - start).TotalDays + 1;
            if (days <= 0) continue;
            result[leave.EmployeeId] = result.GetValueOrDefault(leave.EmployeeId) + days;
        }
        return result;
    }

    private async Task<Dictionary<Guid, decimal>> GetBasePayByEmployeeAsync(
        IReadOnlyList<Guid> employeeIds, DateTime periodFrom, DateTime periodTo, string baseComponentCode)
    {
        var baseComponent = await _db.CompensationComponents
            .FirstOrDefaultAsync(c => c.Code == baseComponentCode && c.IsActive);

        if (baseComponent == null)
            return new Dictionary<Guid, decimal>();

        var rows = await _db.EmployeeCompensations
            .Where(ec => ec.IsActive && ec.BatchId == null
                && employeeIds.Contains(ec.EmployeeId)
                && ec.ComponentId == baseComponent.Id
                && ec.EffectiveFrom.Date <= periodTo
                && (ec.EffectiveTo == null || ec.EffectiveTo.Value.Date >= periodFrom))
            .Select(ec => new { ec.EmployeeId, ec.Amount })
            .ToListAsync();

        return rows.GroupBy(r => r.EmployeeId)
            .ToDictionary(g => g.Key, g => g.First().Amount);
    }

    private async Task<Dictionary<Guid, decimal>> GetWorkingHoursByEmployeeAsync(
        IReadOnlyList<Guid> employeeIds, DateTime periodFrom, DateTime periodTo, string? workingHoursComponentCode)
    {
        if (string.IsNullOrWhiteSpace(workingHoursComponentCode))
            return new Dictionary<Guid, decimal>();

        var component = await _db.CompensationComponents
            .FirstOrDefaultAsync(c => c.Code == workingHoursComponentCode && c.IsActive);
        if (component == null)
            return new Dictionary<Guid, decimal>();

        var rows = await _db.EmployeeCompensations
            .Where(ec => ec.IsActive && ec.BatchId == null
                && employeeIds.Contains(ec.EmployeeId)
                && ec.ComponentId == component.Id
                && ec.EffectiveFrom.Date <= periodTo
                && (ec.EffectiveTo == null || ec.EffectiveTo.Value.Date >= periodFrom))
            .Select(ec => new { ec.EmployeeId, ec.Amount })
            .ToListAsync();

        return rows.GroupBy(r => r.EmployeeId)
            .ToDictionary(g => g.Key, g => g.First().Amount);
    }

    private async Task<(string OtComponentCode, string BaseComponentCode, string WorkingHoursComponentCode)> LoadComponentMappingAsync()
    {
        return (
            PayrollComponentMapping.NormalizeCode(
                await _settings.GetAsync(PayrollComponentMapping.OtComponentKey),
                PayrollComponentMapping.DefaultOtCode),
            PayrollComponentMapping.NormalizeCode(
                await _settings.GetAsync(PayrollComponentMapping.BaseComponentKey),
                PayrollComponentMapping.DefaultBaseCode),
            (await _settings.GetAsync(PayrollComponentMapping.WorkingHoursComponentKey) ?? "").Trim());
    }

    private async Task<(decimal Divisor, decimal Multiplier)> LoadOtSettingsAsync()
    {
        var divisor = decimal.TryParse(await _settings.GetAsync("Payroll_OT_HourlyDivisor"), out var d) ? d : 208m;
        var multiplier = decimal.TryParse(await _settings.GetAsync("Payroll_OT_Multiplier"), out var m) ? m : 1.5m;
        if (divisor <= 0) divisor = 208m;
        return (divisor, multiplier);
    }

    private static List<Guid> ParseSelectedEmployeeIds(PayrollBatch batch)
    {
        if (string.IsNullOrEmpty(batch.SelectedEmployeeIds)) return [];
        try
        {
            return System.Text.Json.JsonSerializer.Deserialize<List<Guid>>(batch.SelectedEmployeeIds) ?? [];
        }
        catch
        {
            return [];
        }
    }
}
