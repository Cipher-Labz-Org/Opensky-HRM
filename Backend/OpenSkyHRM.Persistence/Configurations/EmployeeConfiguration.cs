using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using OpenSkyHRM.Domain.Entities;

namespace OpenSkyHRM.Persistence.Configurations;

public class EmployeeConfiguration : IEntityTypeConfiguration<Employee>
{
    public void Configure(EntityTypeBuilder<Employee> builder)
    {
        builder.ToTable("Employees");
        builder.HasKey(e => e.Id);
        builder.HasIndex(e => e.EmployeeCode).IsUnique();
        builder.HasIndex(e => e.Email).IsUnique();
        builder.HasIndex(e => e.FingerprintId)
            .IsUnique()
            .HasFilter("\"FingerprintId\" IS NOT NULL AND \"FingerprintId\" <> ''");

        builder.Property(e => e.EmployeeCode).HasMaxLength(50).IsRequired();
        builder.Property(e => e.FirstName).HasMaxLength(100).IsRequired();
        builder.Property(e => e.MiddleName).HasMaxLength(100);
        builder.Property(e => e.LastName).HasMaxLength(100).IsRequired();
        builder.Property(e => e.Email).HasMaxLength(255);
        builder.Property(e => e.Phone).HasMaxLength(100);
        builder.Property(e => e.AddressStreet1).HasMaxLength(255);
        builder.Property(e => e.AddressStreet2).HasMaxLength(255);
        builder.Property(e => e.City).HasMaxLength(100);
        builder.Property(e => e.Country).HasMaxLength(100);
        builder.Property(e => e.StateProvince).HasMaxLength(100);
        builder.Property(e => e.ZipPostalCode).HasMaxLength(40);
        builder.Property(e => e.PollingDivision).HasMaxLength(200);
        builder.Property(e => e.DistanceToOffice).HasMaxLength(50);
        builder.Property(e => e.ModeOfTransport).HasMaxLength(50);
        builder.Property(e => e.HomeTelephone).HasMaxLength(100);
        builder.Property(e => e.WorkTelephone).HasMaxLength(100);
        builder.Property(e => e.OtherEmail).HasMaxLength(255);
        builder.Property(e => e.PermanentStreet1).HasMaxLength(255);
        builder.Property(e => e.PermanentStreet2).HasMaxLength(255);
        builder.Property(e => e.PermanentCity).HasMaxLength(100);
        builder.Property(e => e.PermanentCountry).HasMaxLength(100);
        builder.Property(e => e.PermanentStateProvince).HasMaxLength(100);
        builder.Property(e => e.PermanentZipPostalCode).HasMaxLength(40);
        builder.Property(e => e.PermanentPollingDivision).HasMaxLength(200);
        builder.Property(e => e.PermanentDistanceToOffice).HasMaxLength(50);
        builder.Property(e => e.ProfileImageUrl).HasMaxLength(500);
        builder.Property(e => e.MaritalStatus).HasMaxLength(30);
        builder.Property(e => e.Nationality).HasMaxLength(100);
        builder.Property(e => e.Religion).HasMaxLength(100);
        builder.Property(e => e.Ethnicity).HasMaxLength(100);
        builder.Property(e => e.OtherId).HasMaxLength(50);
        builder.Property(e => e.FingerprintId).HasMaxLength(50);
        builder.Property(e => e.NationalId).HasMaxLength(50);
        builder.Property(e => e.TinNumber).HasMaxLength(50);
        builder.Property(e => e.EpfNumber).HasMaxLength(50);
        builder.Property(e => e.EtfNumber).HasMaxLength(50);
        builder.Property(e => e.DriversLicenseNumber).HasMaxLength(50);
        builder.Property(e => e.DriversLicenseType).HasMaxLength(80);
        builder.Property(e => e.DriversLicenseIssuingCountry).HasMaxLength(100);
        builder.Property(e => e.Status).HasMaxLength(50);
        builder.Property(e => e.Gender).HasConversion<string>().HasMaxLength(10);

        builder.Ignore(e => e.FullName);

        builder.HasOne(e => e.Department)
            .WithMany(d => d.Employees)
            .HasForeignKey(e => e.DepartmentId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(e => e.BusinessUnit)
            .WithMany(b => b.Employees)
            .HasForeignKey(e => e.BusinessUnitId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasOne(e => e.Position)
            .WithMany(p => p.Employees)
            .HasForeignKey(e => e.PositionId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasOne(e => e.Location)
            .WithMany(l => l.Employees)
            .HasForeignKey(e => e.LocationId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasOne(e => e.Grade)
            .WithMany(g => g.Employees)
            .HasForeignKey(e => e.GradeId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasOne(e => e.JobTitle)
            .WithMany(j => j.Employees)
            .HasForeignKey(e => e.JobTitleId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasOne(e => e.ShiftPattern)
            .WithMany()
            .HasForeignKey(e => e.ShiftPatternId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasOne(e => e.Manager)
            .WithMany(e => e.DirectReports)
            .HasForeignKey(e => e.ManagerId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}
