using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using OpenSkyHRM.Domain.Entities;

namespace OpenSkyHRM.Persistence.Configurations;

public class EmployeeCompensationConfiguration : IEntityTypeConfiguration<EmployeeCompensation>
{
    public void Configure(EntityTypeBuilder<EmployeeCompensation> builder)
    {
        builder.ToTable("EmployeeCompensations");
        builder.HasKey(ec => ec.Id);

        builder.Property(ec => ec.Amount).HasColumnType("numeric(18,2)");
        builder.Property(ec => ec.Currency).HasMaxLength(10).HasDefaultValue("LKR");

        builder.HasOne(ec => ec.Employee)
            .WithMany()
            .HasForeignKey(ec => ec.EmployeeId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(ec => ec.Component)
            .WithMany(c => c.EmployeeCompensations)
            .HasForeignKey(ec => ec.ComponentId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
