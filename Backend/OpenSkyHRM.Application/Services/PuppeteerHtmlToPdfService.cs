using OpenSkyHRM.Application.Interfaces;
using PuppeteerSharp;
using PuppeteerSharp.Media;

namespace OpenSkyHRM.Application.Services;

/// <summary>Renders HTML offer letters (and similar) to PDF via headless Chromium.</summary>
public sealed class PuppeteerHtmlToPdfService : IHtmlToPdfService, IAsyncDisposable
{
    private readonly SemaphoreSlim _gate = new(1, 1);
    private IBrowser? _browser;
    private bool _fetchAttempted;

    public async Task<byte[]> ConvertHtmlToPdfAsync(string html, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(html))
            throw new ArgumentException("HTML content is required.", nameof(html));

        var browser = await GetBrowserAsync(cancellationToken);
        await using var page = await browser.NewPageAsync();
        await page.SetContentAsync(html, new NavigationOptions
        {
            WaitUntil = new[] { WaitUntilNavigation.Networkidle0 },
            Timeout = 60_000,
        });

        return await page.PdfDataAsync(new PdfOptions
        {
            Format = PaperFormat.A4,
            PrintBackground = true,
            MarginOptions = new MarginOptions
            {
                Top = "18mm",
                Bottom = "18mm",
                Left = "14mm",
                Right = "14mm",
            },
        });
    }

    private async Task<IBrowser> GetBrowserAsync(CancellationToken cancellationToken)
    {
        if (_browser is { IsConnected: true })
            return _browser;

        await _gate.WaitAsync(cancellationToken);
        try
        {
            if (_browser is { IsConnected: true })
                return _browser;

            if (!_fetchAttempted)
            {
                var fetcher = new BrowserFetcher();
                await fetcher.DownloadAsync();
                _fetchAttempted = true;
            }

            _browser = await Puppeteer.LaunchAsync(new LaunchOptions
            {
                Headless = true,
                Args = new[] { "--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage" },
            });
            return _browser;
        }
        finally
        {
            _gate.Release();
        }
    }

    public async ValueTask DisposeAsync()
    {
        if (_browser != null)
        {
            await _browser.CloseAsync();
            await _browser.DisposeAsync();
            _browser = null;
        }
        _gate.Dispose();
    }
}
