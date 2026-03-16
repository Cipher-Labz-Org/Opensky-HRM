using Microsoft.EntityFrameworkCore;
using OpenSkyHRM.Application.Common;
using OpenSkyHRM.Application.DTOs.Recruitment;
using OpenSkyHRM.Application.Interfaces;
using OpenSkyHRM.Domain.Entities;
using OpenSkyHRM.Domain.Enums;
using OpenSkyHRM.Persistence;

namespace OpenSkyHRM.Application.Services;

public class RecruitmentService : IRecruitmentService
{
    private readonly AppDbContext _db;
    public RecruitmentService(AppDbContext db) { _db = db; }

    public async Task<PagedResult<RequisitionDto>> GetRequisitionsAsync(int page = 1, int pageSize = 20, string? status = null)
    {
        var query = _db.Requisitions
            .Include(r => r.Department).Include(r => r.JobTitle).Include(r => r.HiringManager).Include(r => r.Candidates)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(status) && Enum.TryParse<ApprovalStatus>(status, true, out var s))
            query = query.Where(r => r.Status == s);

        var total = await query.CountAsync();
        var items = await query.OrderByDescending(r => r.CreatedAt).Skip((page - 1) * pageSize).Take(pageSize)
            .Select(r => new RequisitionDto
            {
                Id = r.Id, Title = r.Title, Code = r.Code, Description = r.Description,
                Vacancies = r.Vacancies, Status = r.Status.ToString(), TargetDate = r.TargetDate, Priority = r.Priority,
                DepartmentName = r.Department.Name, JobTitleName = r.JobTitle != null ? r.JobTitle.Title : null,
                HiringManagerName = r.HiringManager != null ? r.HiringManager.FirstName + " " + r.HiringManager.LastName : null,
                CandidateCount = r.Candidates.Count,
            }).ToListAsync();

        return new PagedResult<RequisitionDto> { Items = items, TotalCount = total, Page = page, PageSize = pageSize };
    }

    public async Task<RequisitionDto> CreateRequisitionAsync(CreateRequisitionDto dto)
    {
        var req = new Requisition
        {
            Title = dto.Title, Code = dto.Code, Description = dto.Description, Vacancies = dto.Vacancies,
            TargetDate = dto.TargetDate, Priority = dto.Priority, DepartmentId = dto.DepartmentId,
            JobTitleId = dto.JobTitleId, HiringManagerId = dto.HiringManagerId,
        };
        _db.Requisitions.Add(req);
        await _db.SaveChangesAsync();
        return (await GetRequisitionsAsync(1, 1)).Items.First();
    }

    public async Task<PagedResult<CandidateDto>> GetCandidatesAsync(int page = 1, int pageSize = 20, Guid? requisitionId = null)
    {
        var query = _db.Candidates.Include(c => c.Requisition).AsQueryable();
        if (requisitionId.HasValue) query = query.Where(c => c.RequisitionId == requisitionId.Value);

        var total = await query.CountAsync();
        var items = await query.OrderByDescending(c => c.CreatedAt).Skip((page - 1) * pageSize).Take(pageSize)
            .Select(c => new CandidateDto
            {
                Id = c.Id, FirstName = c.FirstName, LastName = c.LastName, Email = c.Email,
                Phone = c.Phone, Source = c.Source, Stage = c.Stage,
                RequisitionTitle = c.Requisition.Title, RequisitionId = c.RequisitionId,
            }).ToListAsync();

        return new PagedResult<CandidateDto> { Items = items, TotalCount = total, Page = page, PageSize = pageSize };
    }

    public async Task<CandidateDto> CreateCandidateAsync(CreateCandidateDto dto)
    {
        var candidate = new Candidate
        {
            FirstName = dto.FirstName, LastName = dto.LastName, Email = dto.Email,
            Phone = dto.Phone, Source = dto.Source, RequisitionId = dto.RequisitionId,
        };
        _db.Candidates.Add(candidate);
        await _db.SaveChangesAsync();
        return (await GetCandidatesAsync(1, 1, dto.RequisitionId)).Items.First();
    }
}
