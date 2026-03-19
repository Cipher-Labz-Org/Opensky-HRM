using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using OpenSkyHRM.Domain.Entities;

namespace OpenSkyHRM.Persistence.Configurations;

public class DependentConfiguration : IEntityTypeConfiguration<Dependent>
{
    public void Configure(EntityTypeBuilder<Dependent> builder)
    {
        builder.ToTable("Dependents");
        builder.HasKey(d => d.Id);

        builder.Property(d => d.FirstName).HasMaxLength(100).IsRequired();
        builder.Property(d => d.LastName).HasMaxLength(100).IsRequired();
        builder.Property(d => d.Relationship).HasMaxLength(100).IsRequired();
        builder.Property(d => d.MaritalStatus).HasMaxLength(30);
        builder.Property(d => d.Occupation).HasMaxLength(200);
        builder.Property(d => d.Organization).HasMaxLength(200);

        builder.HasOne(d => d.Employee)
            .WithMany(e => e.Dependents)
            .HasForeignKey(d => d.EmployeeId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasQueryFilter(d => !d.IsDeleted);
    }
}
