using System.Text.Json;

namespace WarrantySystem.Shared;

public sealed record ManifestEntry(
    string Id,
    string ClaimNumber,
    string Title,
    string DocumentType,
    DateOnly IssuedOn,
    string MediaType,
    string Path);

public sealed record WarrantyDocument(ManifestEntry Entry, string FullPath);

// Documents are discovered from Documents/manifest.json, not from the folder layout.
public sealed class WarrantyDocumentStore(IReadOnlyList<WarrantyDocument> documents)
{
    public static WarrantyDocumentStore Load(string documentsRoot)
    {
        var manifestPath = Path.Combine(documentsRoot, "manifest.json");
        var entries = JsonSerializer.Deserialize<List<ManifestEntry>>(
            File.ReadAllText(manifestPath),
            new JsonSerializerOptions(JsonSerializerDefaults.Web)) ?? [];

        var root = Path.GetFullPath(documentsRoot) + System.IO.Path.DirectorySeparatorChar;
        var documents = entries
            .Select(e => new WarrantyDocument(e, System.IO.Path.GetFullPath(System.IO.Path.Combine(root, e.Path))))
            .Where(d => d.FullPath.StartsWith(root, StringComparison.OrdinalIgnoreCase) && File.Exists(d.FullPath))
            .OrderBy(d => d.Entry.IssuedOn)
            .ThenBy(d => d.Entry.Id, StringComparer.Ordinal)
            .ToList();

        return new WarrantyDocumentStore(documents);
    }

    public IReadOnlyList<WarrantyDocument> Find(string? claimNumber) =>
        string.IsNullOrWhiteSpace(claimNumber)
            ? documents
            : documents.Where(d => string.Equals(d.Entry.ClaimNumber, claimNumber.Trim(), StringComparison.OrdinalIgnoreCase)).ToList();

    public WarrantyDocument? ById(string id) =>
        documents.FirstOrDefault(d => d.Entry.Id == id);
}
