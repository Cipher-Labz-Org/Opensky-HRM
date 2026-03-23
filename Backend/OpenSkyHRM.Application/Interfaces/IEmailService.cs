namespace OpenSkyHRM.Application.Interfaces;

public interface IEmailService
{
    Task SendOfferEmailAsync(string toEmail, string candidateName, string positionTitle,
        decimal salary, string currency, DateTime? joiningDate, string? remarks);
    Task<bool> IsConfiguredAsync();
}
