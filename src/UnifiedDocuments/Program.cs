using UnifiedDocuments.Data;
using UnifiedDocuments.Endpoints;
using UnifiedDocuments.Sync;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddOpenApi();
builder.Services.AddCors(options => options.AddDefaultPolicy(policy => policy
    .SetIsOriginAllowed(origin => Uri.TryCreate(origin, UriKind.Absolute, out var uri) && uri.IsLoopback)
    .AllowAnyHeader()
    .AllowAnyMethod()));
builder.Services.AddUnifiedDocumentsData(
    builder.Configuration.GetConnectionString("UnifiedDocuments")
    ?? throw new InvalidOperationException("Connection string 'UnifiedDocuments' is not configured."));
builder.Services.AddUnifiedDocumentsSync(builder.Configuration);

var app = builder.Build();
app.UseCors();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.MapVehicleDocumentsEndpoints();

app.Run();
