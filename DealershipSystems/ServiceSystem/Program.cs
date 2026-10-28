using System.Text.Json;
using ServiceSystem.Application;
using ServiceSystem.Infrastructure;

var builder = WebApplication.CreateBuilder(args);

builder.Services
    .AddControllers()
    .AddJsonOptions(options => options.JsonSerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower);
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

builder.Services.AddSingleton<IServiceDocumentRepository>(sp =>
    new FileSystemServiceDocumentRepository(Path.Combine(sp.GetRequiredService<IWebHostEnvironment>().ContentRootPath, "Documents")));
builder.Services.AddScoped<ServiceDocumentQueryService>();

var app = builder.Build();
app.UseSwagger();
app.UseSwaggerUI();
app.MapControllers();
app.Run();
