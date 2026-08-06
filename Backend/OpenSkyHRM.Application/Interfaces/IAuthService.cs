using OpenSkyHRM.Application.Common;
using OpenSkyHRM.Application.DTOs.Auth;

namespace OpenSkyHRM.Application.Interfaces;

public interface IAuthService
{
    Task<AuthResponseDto> LoginAsync(LoginDto dto);
    Task<UserProfileDto> GetProfileAsync(Guid userId);
    Task ChangePasswordAsync(Guid userId, ChangePasswordDto dto);
    Task<ForgotPasswordVerifyResponseDto> VerifyForgotPasswordAsync(ForgotPasswordVerifyDto dto);
    Task ResetPasswordWithTokenAsync(ForgotPasswordResetDto dto);

    Task<UserListDto> CreateUserAsync(CreateUserDto dto);
    Task<UserListDto> UpdateUserAsync(Guid id, UpdateUserDto dto);
    Task DeleteUserAsync(Guid id);
    Task ResetPasswordAsync(Guid id, string newPassword);
    Task<List<UserListDto>> GetUsersAsync();
    Task<PagedResult<UserListDto>> GetUsersPagedAsync(int page = 1, int pageSize = 20, string? search = null, string? role = null, bool? isActive = null);
    Task<UserSummaryDto> GetUserSummaryAsync();
    Task<UserListDto?> GetUserByIdAsync(Guid id);
    Task<List<SecurityRoleDto>> GetRolesAsync();
    Task<SecurityRoleDto> CreateRoleAsync(CreateRoleDto dto);
    Task<SecurityRoleDto?> UpdateRolePermissionsAsync(Guid roleId, UpdateRolePermissionsDto dto);
}
