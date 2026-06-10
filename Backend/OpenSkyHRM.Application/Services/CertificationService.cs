using Microsoft.EntityFrameworkCore;
using OpenSkyHRM.Application.DTOs.Learning;
using OpenSkyHRM.Application.Interfaces;
using OpenSkyHRM.Domain.Entities;
using OpenSkyHRM.Persistence;

namespace OpenSkyHRM.Application.Services;

public class CertificationService : ICertificationService
{
    private readonly AppDbContext _db;

    public CertificationService(AppDbContext db) => _db = db;

    public async Task<List<CertificationCatalogDto>> GetCatalogAsync(CancellationToken cancellationToken = default)
    {
        return await _db.Certifications.AsNoTracking().OrderBy(c => c.Name)
            .Select(c => new CertificationCatalogDto
            {
                Id = c.Id,
                Name = c.Name,
                IssuingBody = c.IssuingBody,
                Description = c.Description,
                IsActive = c.IsActive,
            }).ToListAsync(cancellationToken);
    }

    public async Task<CertificationCatalogDto> CreateCatalogEntryAsync(CreateCertificationRequest request,
        CancellationToken cancellationToken = default)
    {
        var entity = new Certification
        {
            Name = request.Name.Trim(),
            IssuingBody = string.IsNullOrWhiteSpace(request.IssuingBody) ? null : request.IssuingBody.Trim(),
            Description = string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim(),
            IsActive = request.IsActive,
        };
        _db.Certifications.Add(entity);
        await _db.SaveChangesAsync(cancellationToken);
        return MapCatalog(entity);
    }

    public async Task<CertificationCatalogDto?> UpdateCatalogEntryAsync(Guid id, UpdateCertificationRequest request,
        CancellationToken cancellationToken = default)
    {
        var entity = await _db.Certifications.FirstOrDefaultAsync(c => c.Id == id, cancellationToken);
        if (entity is null)
            return null;
        entity.Name = request.Name.Trim();
        entity.IssuingBody = string.IsNullOrWhiteSpace(request.IssuingBody) ? null : request.IssuingBody.Trim();
        entity.Description = string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim();
        entity.IsActive = request.IsActive;
        await _db.SaveChangesAsync(cancellationToken);
        return MapCatalog(entity);
    }

    public async Task<bool> DeleteCatalogEntryAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var entity = await _db.Certifications.FirstOrDefaultAsync(c => c.Id == id, cancellationToken);
        if (entity is null)
            return false;
        entity.IsDeleted = true;
        await _db.SaveChangesAsync(cancellationToken);
        return true;
    }

    public async Task<List<EmployeeCertificationDto>> GetEmployeeCertificationsAsync(Guid employeeId,
        IReadOnlyList<Guid>? allowedEmployeeIds, CancellationToken cancellationToken = default)
    {
        if (allowedEmployeeIds is not null && !allowedEmployeeIds.Contains(employeeId))
            return [];

        return await _db.EmployeeCertifications.AsNoTracking()
            .Include(ec => ec.Certification)
            .Where(ec => ec.EmployeeId == employeeId)
            .OrderBy(ec => ec.Certification.Name)
            .Select(ec => new EmployeeCertificationDto
            {
                Id = ec.Id,
                CertificationId = ec.CertificationId,
                CertificationName = ec.Certification.Name,
                ObtainedDate = ec.ObtainedDate,
                ExpiryDate = ec.ExpiryDate,
                CertificateNumber = ec.CertificateNumber,
                Status = ec.Status,
            }).ToListAsync(cancellationToken);
    }

    public async Task<List<EmployeeCertificationListItemDto>> GetAllEmployeeCertificationsAsync(
        IReadOnlyList<Guid>? allowedEmployeeIds, CancellationToken cancellationToken = default)
    {
        var query = _db.EmployeeCertifications.AsNoTracking()
            .Include(ec => ec.Certification)
            .Include(ec => ec.Employee)
            .AsQueryable();

        if (allowedEmployeeIds is not null)
            query = query.Where(ec => allowedEmployeeIds.Contains(ec.EmployeeId));

        return await query
            .OrderBy(ec => ec.Employee.LastName)
            .ThenBy(ec => ec.Employee.FirstName)
            .ThenBy(ec => ec.Certification.Name)
            .Select(ec => new EmployeeCertificationListItemDto
            {
                Id = ec.Id,
                EmployeeId = ec.EmployeeId,
                EmployeeName = ec.Employee.FirstName + " " + ec.Employee.LastName,
                CertificationId = ec.CertificationId,
                CertificationName = ec.Certification.Name,
                ObtainedDate = ec.ObtainedDate,
                ExpiryDate = ec.ExpiryDate,
                CertificateNumber = ec.CertificateNumber,
                Status = ec.Status,
            }).ToListAsync(cancellationToken);
    }

    public async Task<EmployeeCertificationDto> CreateEmployeeCertificationAsync(Guid employeeId,
        CreateEmployeeCertificationRequest request, IReadOnlyList<Guid>? allowedEmployeeIds,
        CancellationToken cancellationToken = default)
    {
        if (allowedEmployeeIds is not null && !allowedEmployeeIds.Contains(employeeId))
            throw new UnauthorizedAccessException();

        var cert = await _db.Certifications.AsNoTracking()
            .FirstOrDefaultAsync(c => c.Id == request.CertificationId && c.IsActive, cancellationToken);
        if (cert is null)
            throw new InvalidOperationException("Certification type not found or inactive.");

        var empExists = await _db.Employees.AnyAsync(e => e.Id == employeeId, cancellationToken);
        if (!empExists)
            throw new InvalidOperationException("Employee not found.");

        var entity = new EmployeeCertification
        {
            EmployeeId = employeeId,
            CertificationId = request.CertificationId,
            ObtainedDate = request.ObtainedDate,
            ExpiryDate = request.ExpiryDate,
            CertificateNumber = string.IsNullOrWhiteSpace(request.CertificateNumber)
                ? null
                : request.CertificateNumber.Trim(),
            Status = string.IsNullOrWhiteSpace(request.Status) ? "Active" : request.Status.Trim(),
        };
        _db.EmployeeCertifications.Add(entity);
        await _db.SaveChangesAsync(cancellationToken);

        await _db.Entry(entity).Reference(ec => ec.Certification).LoadAsync(cancellationToken);
        return MapEmployeeCert(entity);
    }

    public async Task<EmployeeCertificationDto?> UpdateEmployeeCertificationAsync(Guid employeeId, Guid id,
        UpdateEmployeeCertificationRequest request, IReadOnlyList<Guid>? allowedEmployeeIds,
        CancellationToken cancellationToken = default)
    {
        if (allowedEmployeeIds is not null && !allowedEmployeeIds.Contains(employeeId))
            throw new UnauthorizedAccessException();

        var entity = await _db.EmployeeCertifications
            .Include(ec => ec.Certification)
            .FirstOrDefaultAsync(ec => ec.Id == id && ec.EmployeeId == employeeId, cancellationToken);
        if (entity is null)
            return null;

        entity.ObtainedDate = request.ObtainedDate;
        entity.ExpiryDate = request.ExpiryDate;
        entity.CertificateNumber = string.IsNullOrWhiteSpace(request.CertificateNumber)
            ? null
            : request.CertificateNumber.Trim();
        entity.Status = string.IsNullOrWhiteSpace(request.Status) ? "Active" : request.Status.Trim();
        await _db.SaveChangesAsync(cancellationToken);
        return MapEmployeeCert(entity);
    }

    public async Task<bool> DeleteEmployeeCertificationAsync(Guid employeeId, Guid id,
        IReadOnlyList<Guid>? allowedEmployeeIds, CancellationToken cancellationToken = default)
    {
        if (allowedEmployeeIds is not null && !allowedEmployeeIds.Contains(employeeId))
            throw new UnauthorizedAccessException();

        var entity = await _db.EmployeeCertifications
            .FirstOrDefaultAsync(ec => ec.Id == id && ec.EmployeeId == employeeId, cancellationToken);
        if (entity is null)
            return false;
        entity.IsDeleted = true;
        await _db.SaveChangesAsync(cancellationToken);
        return true;
    }

    public async Task<List<LearningCertificationSummaryDto>> GetCertificationSummariesAsync(
        CancellationToken cancellationToken = default)
    {
        var today = DateTime.UtcNow.Date;
        var in90 = today.AddDays(90);

        var catalog = await _db.Certifications.AsNoTracking()
            .Where(c => c.IsActive)
            .Select(c => new { c.Id, c.Name })
            .ToListAsync(cancellationToken);

        var assigned = await _db.EmployeeCertifications.AsNoTracking()
            .Where(ec => ec.Status != "Revoked")
            .GroupBy(ec => ec.CertificationId)
            .Select(g => new { CertId = g.Key, Count = g.Count() })
            .ToListAsync(cancellationToken);

        var expiring = await _db.EmployeeCertifications.AsNoTracking()
            .Where(ec => ec.ExpiryDate != null && ec.ExpiryDate >= today && ec.ExpiryDate <= in90
                                                  && ec.Status == "Active")
            .GroupBy(ec => ec.CertificationId)
            .Select(g => new { CertId = g.Key, Count = g.Count() })
            .ToListAsync(cancellationToken);

        var assignedMap = assigned.ToDictionary(x => x.CertId, x => x.Count);
        var expiringMap = expiring.ToDictionary(x => x.CertId, x => x.Count);

        return catalog.Select(c => new LearningCertificationSummaryDto
        {
            CertificationId = c.Id,
            Name = c.Name,
            AssignedCount = assignedMap.GetValueOrDefault(c.Id),
            ExpiringWithin90Days = expiringMap.GetValueOrDefault(c.Id),
        }).OrderBy(x => x.Name).ToList();
    }

    public async Task<List<LearningSkillCoverageDto>> GetSkillCoverageAsync(
        CancellationToken cancellationToken = default)
    {
        var totalActive = await _db.Employees.AsNoTracking()
            .CountAsync(e => e.Status == "Active", cancellationToken);

        var flat = await _db.SkillMatrices.AsNoTracking()
            .Where(sm => sm.ProficiencyLevel > 0)
            .Select(sm => new { sm.SkillId, SkillName = sm.Skill.Name })
            .ToListAsync(cancellationToken);

        return flat
            .GroupBy(x => new { x.SkillId, x.SkillName })
            .Select(g => new LearningSkillCoverageDto
            {
                SkillId = g.Key.SkillId,
                SkillName = g.Key.SkillName,
                EmployeeCountWithSkill = g.Count(),
                TotalActiveEmployees = totalActive,
            })
            .OrderByDescending(r => r.EmployeeCountWithSkill)
            .ToList();
    }

    private static CertificationCatalogDto MapCatalog(Certification c) => new()
    {
        Id = c.Id,
        Name = c.Name,
        IssuingBody = c.IssuingBody,
        Description = c.Description,
        IsActive = c.IsActive,
    };

    private static EmployeeCertificationDto MapEmployeeCert(EmployeeCertification ec) => new()
    {
        Id = ec.Id,
        CertificationId = ec.CertificationId,
        CertificationName = ec.Certification.Name,
        ObtainedDate = ec.ObtainedDate,
        ExpiryDate = ec.ExpiryDate,
        CertificateNumber = ec.CertificateNumber,
        Status = ec.Status,
    };
}
