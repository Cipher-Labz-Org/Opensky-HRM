namespace OpenSkyHRM.Application.Interfaces;

public interface IHtmlToPdfService
{
    Task<byte[]> ConvertHtmlToPdfAsync(string html, CancellationToken cancellationToken = default);
}
