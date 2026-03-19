namespace OpenSkyHRM.Application.Interfaces;

public interface ISystemSettingService
{
    Task<string?> GetAsync(string key);
    Task<Dictionary<string, string>> GetAllAsync();
    Task SetAsync(string key, string value);
    Task<string> GenerateNextEmployeeCodeAsync();
}
