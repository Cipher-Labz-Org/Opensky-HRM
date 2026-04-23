namespace OpenSkyHRM.Application.DTOs.Auth;

public class LoginDto
{
    public string Username { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
}

public class AuthResponseDto
{
    public string Token { get; set; } = string.Empty;
    public DateTime ExpiresAt { get; set; }
    public UserProfileDto User { get; set; } = null!;
}

public class UserProfileDto
{
    public Guid Id { get; set; }
    public string Username { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public bool IsActive { get; set; }
    public Guid? EmployeeId { get; set; }
    public string? EmployeeName { get; set; }
    public string? ProfileImageUrl { get; set; }
    public List<string> Roles { get; set; } = new();
    public List<PermissionDto> Permissions { get; set; } = new();
    /// <summary>Instance entitlements: RBAC still applies per user.</summary>
    public List<string> LicensedModules { get; set; } = new();
    /// <summary>When non-empty, People access is limited to employees at these work locations.</summary>
    public List<Guid> AssignedLocationIds { get; set; } = new();
    public List<Guid> AssignedBusinessUnitIds { get; set; } = new();
    public List<Guid> AssignedGradeIds { get; set; } = new();
    public List<Guid> AssignedJobTitleIds { get; set; } = new();
}

public class PermissionDto
{
    public string Module { get; set; } = string.Empty;
    public string Action { get; set; } = string.Empty;
    public string Scope { get; set; } = "Own";
}

public class ChangePasswordDto
{
    public string CurrentPassword { get; set; } = string.Empty;
    public string NewPassword { get; set; } = string.Empty;
}

public class CreateUserDto
{
    public string Username { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
    public Guid? EmployeeId { get; set; }
    public List<Guid> RoleIds { get; set; } = new();
    /// <summary>Optional. When set and non-empty, restricts People (and related) access to these locations.</summary>
    public List<Guid>? AssignedLocationIds { get; set; }
    public List<Guid>? AssignedBusinessUnitIds { get; set; }
    public List<Guid>? AssignedGradeIds { get; set; }
    public List<Guid>? AssignedJobTitleIds { get; set; }
}

public class UpdateUserDto
{
    public string? Username { get; set; }
    public string? Email { get; set; }
    public bool? IsActive { get; set; }
    public Guid? EmployeeId { get; set; }
    public List<Guid>? RoleIds { get; set; }
    /// <summary>When null, assigned locations are unchanged. When set (including empty), replaces all assignments.</summary>
    public List<Guid>? AssignedLocationIds { get; set; }
    /// <summary>When null, business unit scope unchanged. When set (including empty), replaces.</summary>
    public List<Guid>? AssignedBusinessUnitIds { get; set; }
    /// <summary>When null, grade scope unchanged. When set (including empty), replaces.</summary>
    public List<Guid>? AssignedGradeIds { get; set; }
    /// <summary>When null, job title scope unchanged. When set (including empty), replaces.</summary>
    public List<Guid>? AssignedJobTitleIds { get; set; }
}

public class UserListDto
{
    public Guid Id { get; set; }
    public string Username { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public bool IsActive { get; set; }
    public Guid? EmployeeId { get; set; }
    public string? EmployeeName { get; set; }
    public List<string> Roles { get; set; } = new();
    public DateTime? LastLoginAt { get; set; }
    public DateTime CreatedAt { get; set; }
    public List<Guid> AssignedLocationIds { get; set; } = new();
    public List<Guid> AssignedBusinessUnitIds { get; set; } = new();
    public List<Guid> AssignedGradeIds { get; set; } = new();
    public List<Guid> AssignedJobTitleIds { get; set; } = new();
}

public class SecurityRoleDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public string? Description { get; set; }
    public bool IsSystemRole { get; set; }
    public List<PermissionDto> Permissions { get; set; } = new();
}

public class UpdateRolePermissionsDto
{
    public List<PermissionDto> Permissions { get; set; } = new();
}

public class AvailableModuleDto
{
    public string Module { get; set; } = string.Empty;
    public string Label { get; set; } = string.Empty;
}
