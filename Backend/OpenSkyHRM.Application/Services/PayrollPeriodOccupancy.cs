using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using OpenSkyHRM.Domain.Entities;
using OpenSkyHRM.Domain.Enums;
using OpenSkyHRM.Persistence;

namespace OpenSkyHRM.Application.Services;

/// <summary>
/// Employees already covered by another payroll run for the same month, year, and process type.
/// Used so a new hire can be added in a later batch without reprinting slips for staff already paid.
/// </summary>
public static class PayrollPeriodOccupancy
{
    public static async Task<HashSet<Guid>> GetEmployeeIdsAsync(
        AppDbContext db,
        int year,
        int month,
        PayrollProcessType processType,
        Guid? exceptBatchId = null)
    {
        var batchQuery = db.PayrollBatches.AsNoTracking()
            .Where(b => b.Year == year && b.Month == month && b.ProcessType == processType);
        if (exceptBatchId.HasValue)
            batchQuery = batchQuery.Where(b => b.Id != exceptBatchId.Value);

        var batches = await batchQuery
            .Select(b => new { b.Id, b.SelectedEmployeeIds })
            .ToListAsync();

        var ids = new HashSet<Guid>();
        foreach (var batch in batches)
            AddSelectedIds(batch.SelectedEmployeeIds, ids);

        var fromStatements = await db.PayStatements.AsNoTracking()
            .Where(s => s.Year == year && s.Month == month)
            .Join(
                db.PayrollBatches.Where(b =>
                    b.ProcessType == processType
                    && (!exceptBatchId.HasValue || b.Id != exceptBatchId.Value)),
                s => s.BatchId,
                b => b.Id,
                (s, _) => s.EmployeeId)
            .ToListAsync();
        foreach (var id in fromStatements)
            ids.Add(id);

        return ids;
    }

    public static IReadOnlyList<Guid> CanonicalStatementIds(IEnumerable<PayStatementKey> keys)
    {
        return keys
            .GroupBy(k => new { k.EmployeeId, k.Month, k.Year, k.ProcessType })
            .Select(g => g
                .OrderByDescending(x => x.Status == PayStatementStatus.Finalized)
                .ThenByDescending(x => x.CreatedAt)
                .ThenByDescending(x => x.Id)
                .First().Id)
            .ToList();
    }

    public static void AddSelectedIds(string? selectedEmployeeIdsJson, HashSet<Guid> ids)
    {
        if (string.IsNullOrWhiteSpace(selectedEmployeeIdsJson))
            return;
        try
        {
            var list = JsonSerializer.Deserialize<List<Guid>>(selectedEmployeeIdsJson);
            if (list is null) return;
            foreach (var id in list)
                ids.Add(id);
        }
        catch (JsonException)
        {
            /* ignore malformed selection JSON */
        }
    }

    public readonly record struct PayStatementKey(
        Guid Id,
        Guid EmployeeId,
        int Month,
        int Year,
        PayrollProcessType ProcessType,
        PayStatementStatus Status,
        DateTime CreatedAt);
}
