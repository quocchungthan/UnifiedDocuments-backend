using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.StaticFiles;
using ServiceSystem.Application;

namespace ServiceSystem.Infrastructure;

// Indexed once at startup; restart to pick up new files.
public sealed class FileSystemServiceDocumentRepository : IServiceDocumentRepository
{
    private readonly IReadOnlyList<ServiceDocument> _documents;

    public FileSystemServiceDocumentRepository(string documentsRoot)
    {
        var contentTypes = new FileExtensionContentTypeProvider();
        _documents = Directory.Exists(documentsRoot)
            ? Directory.EnumerateFiles(documentsRoot, "*", SearchOption.AllDirectories)
                .Select(path => ToDocument(documentsRoot, path, contentTypes))
                .OrderByDescending(d => d.UploadedAt)
                .ThenBy(d => d.RecordId, StringComparer.Ordinal)
                .ToList()
            : [];
    }

    public IReadOnlyList<ServiceDocument> All() => _documents;

    public ServiceDocument? FindById(string recordId) =>
        _documents.FirstOrDefault(d => d.RecordId == recordId);

    private static ServiceDocument ToDocument(string root, string path, FileExtensionContentTypeProvider contentTypes)
    {
        var relative = Path.GetRelativePath(root, path).Replace('\\', '/');
        var info = new FileInfo(path);

        return new ServiceDocument(
            "SR-" + Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(relative)))[..12],
            relative.Contains('/') ? relative[..relative.IndexOf('/')] : "other",
            info.Name,
            contentTypes.TryGetContentType(path, out var type) ? type : "application/octet-stream",
            info.Length,
            info.LastWriteTimeUtc,
            path);
    }
}
