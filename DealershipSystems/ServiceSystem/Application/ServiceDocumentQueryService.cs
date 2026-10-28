namespace ServiceSystem.Application;

public sealed record ServiceDocument(
    string RecordId,
    string DocumentKind,
    string FileName,
    string MimeType,
    long ByteSize,
    DateTimeOffset UploadedAt,
    string PhysicalPath);

public sealed record PagedResult<T>(IReadOnlyList<T> Items, int Offset, int Limit, int Total);

public interface IServiceDocumentRepository
{
    IReadOnlyList<ServiceDocument> All();
    ServiceDocument? FindById(string recordId);
}

public sealed class ServiceDocumentQueryService(IServiceDocumentRepository repository)
{
    public const int MaxLimit = 50;

    public PagedResult<ServiceDocument> List(int offset, int limit)
    {
        var documents = repository.All();
        var items = documents.Skip(offset).Take(limit).ToList();
        return new PagedResult<ServiceDocument>(items, offset, limit, documents.Count);
    }

    public ServiceDocument? Get(string recordId) => repository.FindById(recordId);
}
