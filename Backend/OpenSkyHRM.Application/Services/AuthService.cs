using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;
using OpenSkyHRM.Application.DTOs.Auth;
using OpenSkyHRM.Application.Interfaces;
using OpenSkyHRM.Domain.Entities;
using OpenSkyHRM.Persistence;

namespace OpenSkyHRM.Application.Services;

public class AuthService : IAuthService
{
    private readonly AppDbContext _db;
    private readonly IConfiguration _config;

    public AuthService(AppDbContext db, IConfiguration config)
    {
        _db = db;
        _config = config;
    }

    public async Task<AuthResponseDto> LoginAsync(LoginDto dto)
    {
        var loginInput = (dto.Username ?? "").Trim();
        if (string.IsNullOrEmpty(loginInput))
            throw new UnauthorizedAccessException("Invalid username or password.");

        // Allow login by username or email (case-insensitive)
        var loginLower = loginInput.ToLower();
        var user = await _db.Users
            .Include(u => u.UserRoles).ThenInclude(ur => ur.Role).ThenInclude(r => r.Permissions)
            .Include(u => u.Employee)
            .FirstOrDefaultAsync(u => !u.IsDeleted && (
                u.Username == loginInput ||
                u.Email!.ToLower() == loginLower));

        if (user == null)
            throw new UnauthorizedAccessException("Invalid username or password.");

        var passwordValid = false;
        try
        {
            if (!string.IsNullOrEmpty(user.PasswordHash))
                passwordValid = BCrypt.Net.BCrypt.Verify(dto.Password, user.PasswordHash);
        }
        catch
        {
            // Invalid hash format - treat as wrong password
        }

        if (!passwordValid)
            throw new UnauthorizedAccessException("Invalid username or password.");

        if (!user.IsActive)
            throw new UnauthorizedAccessException("Account is disabled. Contact your administrator.");

        user.LastLoginAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        var (token, expiresAt) = GenerateJwt(user);

        return new AuthResponseDto
        {
            Token = token,
            ExpiresAt = expiresAt,
            User = MapProfile(user)
        };
    }

    public async Task<UserProfileDto> GetProfileAsync(Guid userId)
    {
        var user = await _db.Users
            .Include(u => u.UserRoles).ThenInclude(ur => ur.Role).ThenInclude(r => r.Permissions)
            .Include(u => u.Employee)
            .FirstOrDefaultAsync(u => u.Id == userId && !u.IsDeleted)
            ?? throw new KeyNotFoundException("User not found.");

        return MapProfile(user);
    }

    public async Task ChangePasswordAsync(Guid userId, ChangePasswordDto dto)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == userId && !u.IsDeleted)
            ?? throw new KeyNotFoundException("User not found.");

        if (!BCrypt.Net.BCrypt.Verify(dto.CurrentPassword, user.PasswordHash))
            throw new UnauthorizedAccessException("Current password is incorrect.");

        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.NewPassword);
        user.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
    }

    public async Task<UserListDto> CreateUserAsync(CreateUserDto dto)
    {
        if (await _db.Users.AnyAsync(u => u.Username == dto.Username && !u.IsDeleted))
            throw new InvalidOperationException($"Username '{dto.Username}' already exists.");

        if (await _db.Users.AnyAsync(u => u.Email == dto.Email && !u.IsDeleted))
            throw new InvalidOperationException($"Email '{dto.Email}' already exists.");

        var user = new User
        {
            Username = dto.Username,
            Email = dto.Email,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.Password),
            IsActive = dto.IsActive,
            EmployeeId = dto.EmployeeId
        };

        foreach (var roleId in dto.RoleIds)
        {
            user.UserRoles.Add(new UserRole { RoleId = roleId });
        }

        _db.Users.Add(user);
        await _db.SaveChangesAsync();

        return await GetUserByIdAsync(user.Id) ?? throw new InvalidOperationException("Failed to retrieve created user.");
    }

    public async Task<UserListDto> UpdateUserAsync(Guid id, UpdateUserDto dto)
    {
        var user = await _db.Users
            .Include(u => u.UserRoles)
            .FirstOrDefaultAsync(u => u.Id == id && !u.IsDeleted)
            ?? throw new KeyNotFoundException("User not found.");

        if (dto.Username != null)
        {
            if (await _db.Users.AnyAsync(u => u.Username == dto.Username && u.Id != id && !u.IsDeleted))
                throw new InvalidOperationException($"Username '{dto.Username}' already exists.");
            user.Username = dto.Username;
        }

        if (dto.Email != null)
        {
            if (await _db.Users.AnyAsync(u => u.Email == dto.Email && u.Id != id && !u.IsDeleted))
                throw new InvalidOperationException($"Email '{dto.Email}' already exists.");
            user.Email = dto.Email;
        }

        if (dto.IsActive.HasValue) user.IsActive = dto.IsActive.Value;
        user.EmployeeId = dto.EmployeeId;

        if (dto.RoleIds != null)
        {
            _db.UserRoles.RemoveRange(user.UserRoles);
            await _db.SaveChangesAsync();

            foreach (var roleId in dto.RoleIds)
                _db.UserRoles.Add(new UserRole { UserId = id, RoleId = roleId });
        }

        user.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        return await GetUserByIdAsync(id) ?? throw new InvalidOperationException("Failed to retrieve updated user.");
    }

    public async Task DeleteUserAsync(Guid id)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == id && !u.IsDeleted)
            ?? throw new KeyNotFoundException("User not found.");

        user.IsDeleted = true;
        user.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
    }

    public async Task ResetPasswordAsync(Guid id, string newPassword)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == id && !u.IsDeleted)
            ?? throw new KeyNotFoundException("User not found.");

        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(newPassword);
        user.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
    }

    public async Task<List<UserListDto>> GetUsersAsync()
    {
        return await _db.Users
            .Include(u => u.UserRoles).ThenInclude(ur => ur.Role)
            .Include(u => u.Employee)
            .Where(u => !u.IsDeleted)
            .OrderBy(u => u.Username)
            .Select(u => new UserListDto
            {
                Id = u.Id,
                Username = u.Username,
                Email = u.Email,
                IsActive = u.IsActive,
                EmployeeId = u.EmployeeId,
                EmployeeName = u.Employee != null ? u.Employee.FirstName + " " + u.Employee.LastName : null,
                Roles = u.UserRoles.Select(ur => ur.Role.Name).ToList(),
                LastLoginAt = u.LastLoginAt,
                CreatedAt = u.CreatedAt
            })
            .ToListAsync();
    }

    public async Task<UserListDto?> GetUserByIdAsync(Guid id)
    {
        return await _db.Users
            .Include(u => u.UserRoles).ThenInclude(ur => ur.Role)
            .Include(u => u.Employee)
            .Where(u => u.Id == id && !u.IsDeleted)
            .Select(u => new UserListDto
            {
                Id = u.Id,
                Username = u.Username,
                Email = u.Email,
                IsActive = u.IsActive,
                EmployeeId = u.EmployeeId,
                EmployeeName = u.Employee != null ? u.Employee.FirstName + " " + u.Employee.LastName : null,
                Roles = u.UserRoles.Select(ur => ur.Role.Name).ToList(),
                LastLoginAt = u.LastLoginAt,
                CreatedAt = u.CreatedAt
            })
            .FirstOrDefaultAsync();
    }

    public async Task<List<SecurityRoleDto>> GetRolesAsync()
    {
        return await _db.SecurityRoles
            .Where(r => !r.IsDeleted)
            .Include(r => r.Permissions.Where(p => !p.IsDeleted))
            .OrderBy(r => r.Name)
            .Select(r => new SecurityRoleDto
            {
                Id = r.Id,
                Name = r.Name,
                Code = r.Code,
                Description = r.Description,
                IsSystemRole = r.IsSystemRole,
                Permissions = r.Permissions.Select(p => new PermissionDto
                {
                    Module = p.Module,
                    Action = p.Action,
                    Scope = p.Scope
                }).ToList()
            })
            .ToListAsync();
    }

    public async Task<SecurityRoleDto?> UpdateRolePermissionsAsync(Guid roleId, UpdateRolePermissionsDto dto)
    {
        var role = await _db.SecurityRoles
            .Include(r => r.Permissions)
            .FirstOrDefaultAsync(r => r.Id == roleId && !r.IsDeleted);
        if (role is null) return null;

        _db.Permissions.RemoveRange(role.Permissions);
        await _db.SaveChangesAsync();

        foreach (var p in dto.Permissions)
        {
            if (string.IsNullOrWhiteSpace(p.Module) || string.IsNullOrWhiteSpace(p.Action))
                continue;
            _db.Permissions.Add(new Permission
            {
                RoleId = roleId,
                Module = p.Module.Trim(),
                Action = p.Action.Trim(),
                Scope = string.IsNullOrWhiteSpace(p.Scope) ? "All" : p.Scope.Trim()
            });
        }

        role.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        var roles = await GetRolesAsync();
        return roles.FirstOrDefault(r => r.Id == roleId);
    }

    private (string token, DateTime expiresAt) GenerateJwt(User user)
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(
            _config["Jwt:Key"] ?? "OpenSkyHRM-Default-Key-256bit-ChangeMe!!"));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var expiresMinutes = int.TryParse(_config["Jwt:ExpiresInMinutes"], out var m) ? m : 480;
        var expiresAt = DateTime.UtcNow.AddMinutes(expiresMinutes);

        var roles = user.UserRoles.Select(ur => ur.Role).ToList();
        var allPermissions = roles
            .SelectMany(r => r.Permissions.Where(p => !p.IsDeleted))
            .Select(p => $"{p.Module}:{p.Action}:{p.Scope}")
            .Distinct()
            .ToList();

        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new(JwtRegisteredClaimNames.Email, user.Email),
            new("username", user.Username),
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
        };

        if (user.EmployeeId.HasValue)
            claims.Add(new Claim("employeeId", user.EmployeeId.Value.ToString()));

        foreach (var role in roles)
            claims.Add(new Claim(ClaimTypes.Role, role.Code));

        foreach (var perm in allPermissions)
            claims.Add(new Claim("permission", perm));

        var token = new JwtSecurityToken(
            issuer: _config["Jwt:Issuer"] ?? "OpenSkyHRM",
            audience: _config["Jwt:Audience"] ?? "OpenSkyHRM",
            claims: claims,
            expires: expiresAt,
            signingCredentials: creds);

        return (new JwtSecurityTokenHandler().WriteToken(token), expiresAt);
    }

    private static UserProfileDto MapProfile(User user)
    {
        var roles = user.UserRoles.Select(ur => ur.Role).ToList();
        var allPermissions = roles
            .SelectMany(r => r.Permissions.Where(p => !p.IsDeleted))
            .Select(p => new PermissionDto { Module = p.Module, Action = p.Action, Scope = p.Scope })
            .GroupBy(p => $"{p.Module}:{p.Action}:{p.Scope}")
            .Select(g => g.First())
            .ToList();

        return new UserProfileDto
        {
            Id = user.Id,
            Username = user.Username,
            Email = user.Email,
            IsActive = user.IsActive,
            EmployeeId = user.EmployeeId,
            EmployeeName = user.Employee != null ? $"{user.Employee.FirstName} {user.Employee.LastName}" : null,
            ProfileImageUrl = user.Employee?.ProfileImageUrl,
            Roles = roles.Select(r => r.Code).ToList(),
            Permissions = allPermissions
        };
    }
}
