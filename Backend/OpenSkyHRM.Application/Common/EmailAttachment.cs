namespace OpenSkyHRM.Application.Common;

public sealed record EmailAttachment(string FileName, string ContentType, byte[] Content);
