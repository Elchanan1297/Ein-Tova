using EinTova.Api.Middleware;
using EinTova.Infrastructure.Options;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Options;

namespace EinTova.Api.Application;

/// <summary>סדר ה־Middleware. הסדר חשוב: שגיאות קודם, הרשאות לפני הקבצים והנקודות.</summary>
public static class ApplicationMiddleware
{
    public static WebApplication UseApplicationMiddleware(this WebApplication app)
    {
        app.UseMiddleware<ErrorHandlingMiddleware>();
        app.UseCors();
        app.UseRateLimiter();
        app.UseAuthentication();
        app.UseAuthorization();

        // קבצים שהמנהל העלה: שמות ייחודיים, ולכן מטמון ארוך
        var mediaRoot = app.Services.GetRequiredService<IOptions<MediaOptions>>().Value.Root;
        Directory.CreateDirectory(mediaRoot);
        app.UseStaticFiles(new StaticFileOptions
        {
            FileProvider = new PhysicalFileProvider(mediaRoot),
            RequestPath = "/media",
            OnPrepareResponse = c => c.Context.Response.Headers.CacheControl = "public, max-age=31536000, immutable",
        });

        // האפליקציה של Angular (wwwroot, או --webroot)
        app.UseDefaultFiles();
        app.UseStaticFiles();
        return app;
    }
}
