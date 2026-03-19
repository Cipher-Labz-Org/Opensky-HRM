using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using OpenSkyHRM.Domain.Entities;

namespace OpenSkyHRM.Persistence.Configurations;

public class EmployeeSupervisorConfiguration : IEntityTypeConfiguration<EmployeeSupervisor>
{
    public void Configure(EntityTypeBuilder<EmployeeSupervisor> builder)
    {
        builder.ToTable("EmployeeSupervisors");
        builder.HasKey(x => x.Id);

        builder.Property(x => x.ReportingMethod).HasMaxLength(50).IsRequired();

        builder.HasOne(x => x.Employee)
            .WithMany()
            .HasForeignKey(x => x.EmployeeId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(x => x.Supervisor)
            .WithMany()
            .HasForeignKey(x => x.SupervisorId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasQueryFilter(x => !x.IsDeleted);
    }
}
