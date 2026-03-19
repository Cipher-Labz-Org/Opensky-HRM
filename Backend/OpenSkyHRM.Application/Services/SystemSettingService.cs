using Microsoft.EntityFrameworkCore;
using OpenSkyHRM.Application.Interfaces;
using OpenSkyHRM.Domain.Entities;
using OpenSkyHRM.Persistence;

namespace OpenSkyHRM.Application.Services;

public class SystemSettingService : ISystemSettingService
{
    private readonly AppDbContext _db;

    public SystemSettingService(AppDbContext db)
    {
        _db = db;
    }

    public async Task<string?> GetAsync(string key)
    {
        var setting = await _db.SystemSettings.FindAsync(key);
        return setting?.Value;
    }

    public async Task<Dictionary<string, string>> GetAllAsync()
    {
        return await _db.SystemSettings
            .ToDictionaryAsync(s => s.Key, s => s.Value);
    }

    public async Task SetAsync(string key, string value)
    {
        var setting = await _db.SystemSettings.FindAsync(key);
        if (setting is null)
        {
            _db.SystemSettings.Add(new SystemSetting { Key = key, Value = value });
        }
        else
        {
            setting.Value = value;
        }
        await _db.SaveChangesAsync();
    }

    public async Task<string> GenerateNextEmployeeCodeAsync()
    {
        var prefix = await GetAsync("EmployeeCodePrefix") ?? "EMP";
        var lengthStr = await GetAsync("EmployeeCodeLength") ?? "6";
        var length = int.TryParse(lengthStr, out var l) ? l : 6;

        var allCodes = await _db.Employees
            .IgnoreQueryFilters()
            .Where(e => e.EmployeeCode.StartsWith(prefix + "-"))
            .Select(e => e.EmployeeCode)
            .ToListAsync();

        int maxNumber = 0;
        foreach (var code in allCodes)
        {
            var numericPart = code[(prefix.Length + 1)..];
            if (int.TryParse(numericPart, out var num) && num > maxNumber)
                maxNumber = num;
        }

        return $"{prefix}-{(maxNumber + 1).ToString().PadLeft(length, '0')}";
    }
}
