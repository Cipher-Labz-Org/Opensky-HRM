using System.Reflection;
using ClosedXML.Excel;
using ClosedXML.Graphics;

namespace OpenSkyHRM.Api.Infrastructure;

/// <summary>
/// ClosedXML measures column text with Calibri or Microsoft Sans Serif.
/// IIS and locked-down Windows accounts often cannot read those fonts, and every
/// bulk-import template then fails inside AdjustToContents. The fonts shipped
/// inside ClosedXML are metric-compatible and do not need the Windows font folder.
/// </summary>
public static class ExcelExportBootstrap
{
    private static int _fontsReady;

    public static void UseEmbeddedFonts()
    {
        if (Interlocked.Exchange(ref _fontsReady, 1) == 1)
            return;

        try
        {
            var assembly = typeof(XLWorkbook).Assembly;
            LoadOptions.DefaultGraphicEngine = DefaultGraphicEngine.CreateOnlyWithFonts(
                CopyFont(assembly, "CarlitoBare-Regular.ttf"),
                CopyFont(assembly, "CarlitoBare-Bold.ttf"),
                CopyFont(assembly, "CarlitoBare-Italic.ttf"),
                CopyFont(assembly, "CarlitoBare-BoldItalic.ttf"));
        }
        catch
        {
            Interlocked.Exchange(ref _fontsReady, 0);
            throw;
        }
    }

    /// <summary>Size the used columns. A missing font must not fail the download.</summary>
    public static void FitColumns(IXLWorksheet worksheet)
    {
        var lastColumn = worksheet.LastColumnUsed()?.ColumnNumber() ?? 1;
        try
        {
            if (Volatile.Read(ref _fontsReady) == 0)
                UseEmbeddedFonts();
            worksheet.Columns(1, lastColumn).AdjustToContents();
        }
        catch
        {
            for (var column = 1; column <= lastColumn; column++)
            {
                var header = worksheet.Cell(1, column).GetString();
                var width = Math.Clamp(header.Length + 4, 14, 42);
                worksheet.Column(column).Width = width;
            }
        }
    }

    private static MemoryStream CopyFont(Assembly assembly, string suffix)
    {
        var name = assembly.GetManifestResourceNames()
            .First(resource => resource.EndsWith(suffix, StringComparison.OrdinalIgnoreCase));
        using var raw = assembly.GetManifestResourceStream(name)
            ?? throw new InvalidOperationException($"ClosedXML font {suffix} is missing.");
        var copy = new MemoryStream();
        raw.CopyTo(copy);
        copy.Position = 0;
        return copy;
    }
}
