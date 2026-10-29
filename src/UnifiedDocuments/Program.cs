using UnifiedDocuments.Data;
using UnifiedDocuments.Endpoints;
using UnifiedDocuments.Sync;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(new WebApplicationOptions
{
    Args = args,
    WebRootPath = "www",
});

// Add services to the container.
// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddOpenApi();
builder.Services.AddCors(options => options.AddDefaultPolicy(policy => policy
    .SetIsOriginAllowed(origin => Uri.TryCreate(origin, UriKind.Absolute, out var uri) && uri.IsLoopback)
    .AllowAnyHeader()
    .AllowAnyMethod()));
builder.Services.AddMemoryCache(options => options.SizeLimit = 64 * 1024 * 1024);
builder.Services.AddUnifiedDocumentsData(
    builder.Configuration.GetConnectionString("UnifiedDocuments")
    ?? throw new InvalidOperationException("Connection string 'UnifiedDocuments' is not configured."));
builder.Services.AddUnifiedDocumentsSync(builder.Configuration);

var app = builder.Build();
await using (var scope = app.Services.CreateAsyncScope())
{
    var database = scope.ServiceProvider.GetRequiredService<UnifiedDocumentsDbContext>();
    await database.Database.MigrateAsync();
}

app.UseCors();
app.UseDefaultFiles();
app.UseStaticFiles();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.MapVehicleDocumentsEndpoints();

app.Run();
