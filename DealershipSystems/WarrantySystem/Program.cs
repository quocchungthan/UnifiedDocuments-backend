using WarrantySystem.Features.DownloadDocument;
using WarrantySystem.Features.SearchDocuments;
using WarrantySystem.Shared;

var builder = WebApplication.CreateBuilder(args);

// Legacy contract: PascalCase JSON property names.
builder.Services.ConfigureHttpJsonOptions(options => options.SerializerOptions.PropertyNamingPolicy = null);
builder.Services.AddOpenApi();
builder.Services.AddSingleton(sp =>
    WarrantyDocumentStore.Load(Path.Combine(sp.GetRequiredService<IWebHostEnvironment>().ContentRootPath, "Documents")));

var app = builder.Build();
app.MapOpenApi();
app.UseSwaggerUI(options => options.SwaggerEndpoint("/openapi/v1.json", "Warranty System v1"));

app.MapSearchDocuments();
app.MapDownloadDocument();

app.Run();
