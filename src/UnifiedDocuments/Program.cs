using UnifiedDocuments.Data;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddOpenApi();
builder.Services.AddUnifiedDocumentsData(
    builder.Configuration.GetConnectionString("UnifiedDocuments")
    ?? throw new InvalidOperationException("Connection string 'UnifiedDocuments' is not configured."));

var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.Run();
