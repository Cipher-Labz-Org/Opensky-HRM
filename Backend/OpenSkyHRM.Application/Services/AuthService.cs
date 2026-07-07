using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;
using OpenSkyHRM.Application.Common;
using OpenSkyHRM.Application.DTOs.Auth;
using OpenSkyHRM.Application.Interfaces;
using OpenSkyHRM.Domain.Entities;
using OpenSkyHRM.Persistence;

namespace OpenSkyHRM.Application.Services;

public class AuthService : IAuthService
{
    private readonly AppDbContext _db;
    private readonly IConfiguration _config;
    private readonly ILicensingService _licensing;

    public AuthService(AppDbContext db, IConfiguration config, ILicensingService licensing)
    {
        _db = db;
        _config = config;
        _licensing = licensing;
    }

    public async Task<AuthResponseDto> LoginAsync(LoginDto dto)
    {
        var loginInput = (dto.Username ?? "").Trim();
        if (string.IsNullOrEmpty(loginInput))
            throw new UnauthorizedAccessException("Invalid username or password.");

        // Allow login by username or email (case-insensitive)
        var loginLower = loginInput.ToLower();
        // Keep login query minimal — optional assignment tables may be absent if migrations lag behind.
        var user = await _db.Users
            .Include(u => u.UserRoles).ThenInclude(ur => ur.Role).ThenInclude(r => r.Permissions)
            .Include(u => u.Employee)
            .FirstOrDefaultAsync(u => !u.IsDeleted && (
                u.Username.ToLower() == loginLower ||
                (u.Email != null && u.Email.ToLower() == loginLower)));

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

        var licensedModules = (await _licensing.GetEffectiveModuleCodesAsync()).ToList();

        return new AuthResponseDto
        {
            Token = token,
            ExpiresAt = expiresAt,
            User = MapProfile(user, licensedModules)
        };
    }

    public async Task<UserProfileDto> GetProfileAsync(Guid userId)
    {
        var user = await _db.Users
            .Include(u => u.UserRoles).ThenInclude(ur => ur.Role).ThenInclude(r => r.Permissions)
            .Include(u => u.Employee)
            .Include(u => u.AssignedLocations)
            .Include(u => u.AssignedBusinessUnits)
            .Include(u => u.AssignedGrades)
            .Include(u => u.AssignedJobTitles)
            .FirstOrDefaultAsync(u => u.Id == userId && !u.IsDeleted)
            ?? throw new KeyNotFoundException("User not found.");

        var licensedModules = (await _licensing.GetEffectiveModuleCodesAsync()).ToList();
        return MapProfile(user, licensedModules);
    }

    public async Task ChangePasswordAsync(Guid userId, ChangePasswordDto dto)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == userId && !u.IsDeleted)
            ?? throw new KeyNotFoundException("User not found.");

        if (!BCrypt.Net.BCrypt.Verify(dto.CurrentPassword, user.PasswordHash))
            throw new UnauthorizedAccessException("Current password is incorrect.");

        if (string.IsNullOrWhiteSpace(dto.NewPassword) || dto.NewPassword.Length < 6)
            throw new UnauthorizedAccessException("New password must be at least 6 characters.");

        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.NewPassword);
        user.MustChangePassword = false;
        user.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
    }

    public async Task<ForgotPasswordVerifyResponseDto> VerifyForgotPasswordAsync(ForgotPasswordVerifyDto dto)
    {
        var employeeCode = (dto.EmployeeCode ?? "").Trim();
        var employeeName = NormalizePersonName(dto.EmployeeName ?? "");

        if (string.IsNullOrEmpty(employeeCode) || string.IsNullOrEmpty(employeeName))
            throw new UnauthorizedAccessException("Employee number and name do not match our records.");

        var user = await FindUserForForgotPasswordAsync(employeeCode, employeeName);
        if (user == null)
            throw new UnauthorizedAccessException("Employee number and name do not match our records.");

        if (!user.IsActive)
            throw new UnauthorizedAccessException("Employee number and name do not match our records.");

        var (token, expiresAt) = GeneratePasswordResetJwt(user.Id);
        return new ForgotPasswordVerifyResponseDto
        {
            ResetToken = token,
            ExpiresAt = expiresAt
        };
    }

    public async Task ResetPasswordWithTokenAsync(ForgotPasswordResetDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.ResetToken))
            throw new UnauthorizedAccessException("Password reset link has expired. Please start again.");

        if (string.IsNullOrWhiteSpace(dto.NewPassword) || dto.NewPassword.Length < 6)
            throw new UnauthorizedAccessException("New password must be at least 6 characters.");

        var userId = ValidatePasswordResetJwt(dto.ResetToken);
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == userId && !u.IsDeleted)
            ?? throw new UnauthorizedAccessException("Password reset link has expired. Please start again.");

        if (!user.IsActive)
            throw new UnauthorizedAccessException("Account is disabled. Contact your administrator.");

        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.NewPassword);
        user.MustChangePassword = false;
        user.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
    }

    public async Task<UserListDto> CreateUserAsync(CreateUserDto dto)
    {
        InputValidators.ValidateUsername(dto.Username, "Username");
        dto.Username = dto.Username.Trim();
        InputValidators.ValidateEmailInput(dto.Email, "Email", required: false);

        if (string.IsNullOrWhiteSpace(dto.Password) || dto.Password.Length < 6)
            throw new InvalidOperationException("Password must be at least 6 characters.");

        if (dto.RoleIds == null || dto.RoleIds.Count == 0)
            throw new InvalidOperationException("At least one role is required.");

        if (await _db.Users.AnyAsync(u => u.Username == dto.Username))
            throw new InvalidOperationException(
                $"Username '{dto.Username}' is already in use (including archived accounts). Choose a different username.");

        var normalizedEmail = string.IsNullOrWhiteSpace(dto.Email)
            ? $"user-{Guid.NewGuid():N}@noemail.opensky.hrm"
            : dto.Email.Trim();

        if (!string.IsNullOrWhiteSpace(dto.Email) &&
            await _db.Users.AnyAsync(u => u.Email == normalizedEmail))
            throw new InvalidOperationException(
                $"Email '{normalizedEmail}' is already in use (including archived accounts). Choose a different email.");

        var user = new User
        {
            Username = dto.Username,
            Email = normalizedEmail,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.Password),
            IsActive = dto.IsActive,
            EmployeeId = dto.EmployeeId,
            MustChangePassword = dto.MustChangePassword,
        };

        foreach (var roleId in dto.RoleIds)
        {
            user.UserRoles.Add(new UserRole { RoleId = roleId });
        }

        _db.Users.Add(user);
        await _db.SaveChangesAsync();

        await AddUserScopeAssignmentsAsync(
            user.Id,
            dto.AssignedLocationIds,
            dto.AssignedBusinessUnitIds,
            dto.AssignedGradeIds,
            dto.AssignedJobTitleIds);

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
            InputValidators.ValidateUsername(dto.Username, "Username");
            dto.Username = dto.Username.Trim();

            if (await _db.Users.AnyAsync(u => u.Username == dto.Username && u.Id != id))
                throw new InvalidOperationException(
                    $"Username '{dto.Username}' is already in use (including archived accounts). Choose a different username.");
            user.Username = dto.Username;
        }

        if (dto.Email != null)
        {
            InputValidators.ValidateEmailInput(dto.Email, "Email", required: false);
            if (await _db.Users.AnyAsync(u => u.Email == dto.Email && u.Id != id))
                throw new InvalidOperationException(
                    $"Email '{dto.Email}' is already in use (including archived accounts). Choose a different email.");
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

        if (dto.AssignedLocationIds != null)
        {
            var existingLocs = await _db.UserAssignedLocations.Where(x => x.UserId == id).ToListAsync();
            _db.UserAssignedLocations.RemoveRange(existingLocs);
            await _db.SaveChangesAsync();
            if (dto.AssignedLocationIds.Count > 0)
            {
                var validLocIds = await _db.Locations
                    .Where(l => !l.IsDeleted && dto.AssignedLocationIds.Contains(l.Id))
                    .Select(l => l.Id)
                    .ToListAsync();
                foreach (var lid in validLocIds.Distinct())
                    _db.UserAssignedLocations.Add(new UserAssignedLocation { UserId = id, LocationId = lid });
            }
            await _db.SaveChangesAsync();
        }

        if (dto.AssignedBusinessUnitIds != null)
        {
            var existing = await _db.UserAssignedBusinessUnits.Where(x => x.UserId == id).ToListAsync();
            _db.UserAssignedBusinessUnits.RemoveRange(existing);
            await _db.SaveChangesAsync();
            if (dto.AssignedBusinessUnitIds.Count > 0)
            {
                var validIds = await _db.BusinessUnits
                    .Where(b => !b.IsDeleted && dto.AssignedBusinessUnitIds.Contains(b.Id))
                    .Select(b => b.Id)
                    .ToListAsync();
                foreach (var bid in validIds.Distinct())
                    _db.UserAssignedBusinessUnits.Add(new UserAssignedBusinessUnit { UserId = id, BusinessUnitId = bid });
            }
            await _db.SaveChangesAsync();
        }

        if (dto.AssignedGradeIds != null)
        {
            var existing = await _db.UserAssignedGrades.Where(x => x.UserId == id).ToListAsync();
            _db.UserAssignedGrades.RemoveRange(existing);
            await _db.SaveChangesAsync();
            if (dto.AssignedGradeIds.Count > 0)
            {
                var validIds = await _db.Grades
                    .Where(g => !g.IsDeleted && dto.AssignedGradeIds.Contains(g.Id))
                    .Select(g => g.Id)
                    .ToListAsync();
                foreach (var gid in validIds.Distinct())
                    _db.UserAssignedGrades.Add(new UserAssignedGrade { UserId = id, GradeId = gid });
            }
            await _db.SaveChangesAsync();
        }

        if (dto.AssignedJobTitleIds != null)
        {
            var existing = await _db.UserAssignedJobTitles.Where(x => x.UserId == id).ToListAsync();
            _db.UserAssignedJobTitles.RemoveRange(existing);
            await _db.SaveChangesAsync();
            if (dto.AssignedJobTitleIds.Count > 0)
            {
                var validIds = await _db.JobTitles
                    .Where(j => !j.IsDeleted && dto.AssignedJobTitleIds.Contains(j.Id))
                    .Select(j => j.Id)
                    .ToListAsync();
                foreach (var jid in validIds.Distinct())
                    _db.UserAssignedJobTitles.Add(new UserAssignedJobTitle { UserId = id, JobTitleId = jid });
            }
            await _db.SaveChangesAsync();
        }

        user.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        return await GetUserByIdAsync(id) ?? throw new InvalidOperationException("Failed to retrieve updated user.");
    }

    public async Task DeleteUserAsync(Guid id)
    {
        var user = await _db.Users
            .Include(u => u.UserRoles).ThenInclude(ur => ur.Role)
            .FirstOrDefaultAsync(u => u.Id == id && !u.IsDeleted)
            ?? throw new KeyNotFoundException("User not found.");

        var isProtectedAdmin =
            string.Equals(user.Username, "admin", StringComparison.OrdinalIgnoreCase) ||
            user.UserRoles.Any(ur => string.Equals(ur.Role.Code, "ADMIN", StringComparison.OrdinalIgnoreCase) ||
                                    string.Equals(ur.Role.Name, "Admin", StringComparison.OrdinalIgnoreCase));

        if (isProtectedAdmin)
            throw new InvalidOperationException("The primary admin account cannot be deleted.");

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
        var result = await GetUsersPagedAsync(1, 200);
        return result.Items.ToList();
    }

    public async Task<PagedResult<UserListDto>> GetUsersPagedAsync(
        int page = 1,
        int pageSize = 20,
        string? search = null,
        string? role = null,
        bool? isActive = null)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 200);

        var query = _db.Users
            .AsNoTracking()
            .Where(u => !u.IsDeleted);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLower();
            query = query.Where(u =>
                u.Username.ToLower().Contains(term)
                || u.Email.ToLower().Contains(term)
                || (u.Employee != null && (u.Employee.FirstName + " " + u.Employee.LastName).ToLower().Contains(term)));
        }

        if (!string.IsNullOrWhiteSpace(role))
            query = query.Where(u => u.UserRoles.Any(ur => ur.Role.Name == role));

        if (isActive.HasValue)
            query = query.Where(u => u.IsActive == isActive.Value);

        var total = await query.CountAsync();
        var items = await query
            .OrderBy(u => u.Username)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
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
                CreatedAt = u.CreatedAt,
                AssignedLocationIds = u.AssignedLocations.Select(a => a.LocationId).ToList(),
                AssignedBusinessUnitIds = u.AssignedBusinessUnits.Select(a => a.BusinessUnitId).ToList(),
                AssignedGradeIds = u.AssignedGrades.Select(a => a.GradeId).ToList(),
                AssignedJobTitleIds = u.AssignedJobTitles.Select(a => a.JobTitleId).ToList()
            })
            .ToListAsync();

        return new PagedResult<UserListDto>
        {
            Items = items,
            TotalCount = total,
            Page = page,
            PageSize = pageSize,
        };
    }

    public async Task<UserListDto?> GetUserByIdAsync(Guid id)
    {
        return await _db.Users
            .Include(u => u.UserRoles).ThenInclude(ur => ur.Role)
            .Include(u => u.Employee)
            .Include(u => u.AssignedLocations)
            .Include(u => u.AssignedBusinessUnits)
            .Include(u => u.AssignedGrades)
            .Include(u => u.AssignedJobTitles)
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
                CreatedAt = u.CreatedAt,
                AssignedLocationIds = u.AssignedLocations.Select(a => a.LocationId).ToList(),
                AssignedBusinessUnitIds = u.AssignedBusinessUnits.Select(a => a.BusinessUnitId).ToList(),
                AssignedGradeIds = u.AssignedGrades.Select(a => a.GradeId).ToList(),
                AssignedJobTitleIds = u.AssignedJobTitles.Select(a => a.JobTitleId).ToList()
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

    public async Task<SecurityRoleDto> CreateRoleAsync(CreateRoleDto dto)
    {
        var name = (dto.Name ?? "").Trim();
        if (string.IsNullOrEmpty(name))
            throw new InvalidOperationException("Role name is required.");

        var code = NormalizeRoleCode(string.IsNullOrWhiteSpace(dto.Code) ? name : dto.Code!);
        if (await _db.SecurityRoles.AnyAsync(r => !r.IsDeleted && r.Code == code))
            throw new InvalidOperationException($"A role with code '{code}' already exists.");

        var role = new SecurityRole
        {
            Name = name,
            Code = code,
            Description = string.IsNullOrWhiteSpace(dto.Description) ? null : dto.Description.Trim(),
            IsSystemRole = false
        };
        _db.SecurityRoles.Add(role);
        await _db.SaveChangesAsync();

        var roles = await GetRolesAsync();
        return roles.First(r => r.Id == role.Id);
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

    private static string NormalizeRoleCode(string raw)
    {
        var code = raw.Trim().ToUpperInvariant();
        code = System.Text.RegularExpressions.Regex.Replace(code, @"[^A-Z0-9]+", "_");
        code = code.Trim('_');
        return string.IsNullOrEmpty(code) ? "ROLE" : code;
    }

    private async Task<User?> FindUserForForgotPasswordAsync(string employeeCode, string employeeNameNormalized)
    {
        var codeLower = employeeCode.ToLowerInvariant();
        var candidates = await _db.Users
            .Include(u => u.Employee)
            .Where(u =>
                !u.IsDeleted &&
                u.Employee != null &&
                !u.Employee.IsDeleted &&
                u.Employee.EmployeeCode.ToLower() == codeLower)
            .ToListAsync();

        return candidates.FirstOrDefault(u => EmployeeNameMatches(u.Employee!, employeeNameNormalized));
    }

    private static bool EmployeeNameMatches(Employee employee, string employeeNameNormalized)
    {
        if (NormalizePersonName(employee.FullName) == employeeNameNormalized)
            return true;

        var withoutMiddle = NormalizePersonName($"{employee.FirstName} {employee.LastName}");
        return withoutMiddle == employeeNameNormalized;
    }

    private static string NormalizePersonName(string name)
    {
        return string.Join(' ',
            name.Trim().ToLowerInvariant().Split(' ', StringSplitOptions.RemoveEmptyEntries));
    }

    private (string token, DateTime expiresAt) GeneratePasswordResetJwt(Guid userId)
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(
            _config["Jwt:Key"] ?? "OpenSkyHRM-Default-Key-256bit-ChangeMe!!"));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var expiresAt = DateTime.UtcNow.AddMinutes(15);

        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, userId.ToString()),
            new("purpose", "password-reset"),
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
        };

        var token = new JwtSecurityToken(
            issuer: _config["Jwt:Issuer"] ?? "OpenSkyHRM",
            audience: _config["Jwt:Audience"] ?? "OpenSkyHRM",
            claims: claims,
            expires: expiresAt,
            signingCredentials: creds);

        return (new JwtSecurityTokenHandler().WriteToken(token), expiresAt);
    }

    private Guid ValidatePasswordResetJwt(string token)
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(
            _config["Jwt:Key"] ?? "OpenSkyHRM-Default-Key-256bit-ChangeMe!!"));
        var handler = new JwtSecurityTokenHandler();
        try
        {
            var principal = handler.ValidateToken(token, new TokenValidationParameters
            {
                ValidateIssuer = true,
                ValidIssuer = _config["Jwt:Issuer"] ?? "OpenSkyHRM",
                ValidateAudience = true,
                ValidAudience = _config["Jwt:Audience"] ?? "OpenSkyHRM",
                ValidateIssuerSigningKey = true,
                IssuerSigningKey = key,
                ValidateLifetime = true,
                ClockSkew = TimeSpan.FromMinutes(1),
            }, out _);

            var purpose = principal.FindFirst("purpose")?.Value;
            if (!string.Equals(purpose, "password-reset", StringComparison.Ordinal))
                throw new UnauthorizedAccessException("Invalid reset token.");

            var sub = principal.FindFirst(JwtRegisteredClaimNames.Sub)?.Value
                      ?? principal.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (!Guid.TryParse(sub, out var userId))
                throw new UnauthorizedAccessException("Invalid reset token.");

            return userId;
        }
        catch (SecurityTokenException)
        {
            throw new UnauthorizedAccessException("Password reset link has expired. Please start again.");
        }
    }

    private (string token, DateTime expiresAt) GenerateJwt(User user)
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(
            _config["Jwt:Key"] ?? "OpenSkyHRM-Default-Key-256bit-ChangeMe!!"));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var expiresMinutes = int.TryParse(_config["Jwt:ExpiresInMinutes"], out var m) ? m : 480;
        var expiresAt = DateTime.UtcNow.AddMinutes(expiresMinutes);

        var roles = user.UserRoles
            .Select(ur => ur.Role)
            .Where(r => r != null)
            .ToList();
        var allPermissions = roles
            .SelectMany(r => r!.Permissions.Where(p => !p.IsDeleted))
            .Select(p => $"{p.Module}:{p.Action}:{p.Scope}")
            .Distinct()
            .ToList();

        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new(JwtRegisteredClaimNames.Email, user.Email ?? string.Empty),
            new("username", user.Username),
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
        };

        if (user.EmployeeId.HasValue)
            claims.Add(new Claim("employeeId", user.EmployeeId.Value.ToString()));

        foreach (var role in roles)
            claims.Add(new Claim(ClaimTypes.Role, role!.Code));

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

    private static UserProfileDto MapProfile(User user, IReadOnlyList<string> licensedModules)
    {
        var roles = user.UserRoles
            .Select(ur => ur.Role)
            .Where(r => r != null)
            .ToList();
        var allPermissions = roles
            .SelectMany(r => r!.Permissions.Where(p => !p.IsDeleted))
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
            Roles = roles.Select(r => r!.Code).ToList(),
            Permissions = allPermissions,
            LicensedModules = licensedModules.ToList(),
            AssignedLocationIds = user.AssignedLocations.Count > 0
                ? user.AssignedLocations.Select(a => a.LocationId).ToList()
                : [],
            AssignedBusinessUnitIds = user.AssignedBusinessUnits.Count > 0
                ? user.AssignedBusinessUnits.Select(a => a.BusinessUnitId).ToList()
                : [],
            AssignedGradeIds = user.AssignedGrades.Count > 0
                ? user.AssignedGrades.Select(a => a.GradeId).ToList()
                : [],
            AssignedJobTitleIds = user.AssignedJobTitles.Count > 0
                ? user.AssignedJobTitles.Select(a => a.JobTitleId).ToList()
                : [],
            MustChangePassword = user.MustChangePassword
        };
    }

    private async Task AddUserScopeAssignmentsAsync(
        Guid userId,
        List<Guid>? locationIds,
        List<Guid>? businessUnitIds,
        List<Guid>? gradeIds,
        List<Guid>? jobTitleIds)
    {
        if (locationIds is { Count: > 0 })
        {
            var valid = await _db.Locations
                .Where(l => !l.IsDeleted && locationIds.Contains(l.Id))
                .Select(l => l.Id)
                .ToListAsync();
            foreach (var id in valid.Distinct())
                _db.UserAssignedLocations.Add(new UserAssignedLocation { UserId = userId, LocationId = id });
        }

        if (businessUnitIds is { Count: > 0 })
        {
            var valid = await _db.BusinessUnits
                .Where(b => !b.IsDeleted && businessUnitIds.Contains(b.Id))
                .Select(b => b.Id)
                .ToListAsync();
            foreach (var id in valid.Distinct())
                _db.UserAssignedBusinessUnits.Add(new UserAssignedBusinessUnit { UserId = userId, BusinessUnitId = id });
        }

        if (gradeIds is { Count: > 0 })
        {
            var valid = await _db.Grades
                .Where(g => !g.IsDeleted && gradeIds.Contains(g.Id))
                .Select(g => g.Id)
                .ToListAsync();
            foreach (var id in valid.Distinct())
                _db.UserAssignedGrades.Add(new UserAssignedGrade { UserId = userId, GradeId = id });
        }

        if (jobTitleIds is { Count: > 0 })
        {
            var valid = await _db.JobTitles
                .Where(j => !j.IsDeleted && jobTitleIds.Contains(j.Id))
                .Select(j => j.Id)
                .ToListAsync();
            foreach (var id in valid.Distinct())
                _db.UserAssignedJobTitles.Add(new UserAssignedJobTitle { UserId = userId, JobTitleId = id });
        }

        await _db.SaveChangesAsync();
    }
}
