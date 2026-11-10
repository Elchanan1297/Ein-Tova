using EinTova.Api.Application;

var builder = WebApplication.CreateBuilder(args);

builder.AddApplicationServices()
       .AddInfrastructureServices()
       .AddApplicationBusinessServices();

var app = builder.Build();

app.UseApplicationMiddleware()
   .MapApplicationEndpoints();

app.Run();
