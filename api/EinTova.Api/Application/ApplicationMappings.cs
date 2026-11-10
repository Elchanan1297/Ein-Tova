using EinTova.Api.Hubs;
using EinTova.Api.Mapping;

namespace EinTova.Api.Application;

/// <summary>כל נקודות הקצה, לפי תחום</summary>
public static class ApplicationMappings
{
    public static WebApplication MapApplicationEndpoints(this WebApplication app)
    {
        app.MapPublicEndpoints();
        app.MapLoginEndpoints();
        app.MapGameEndpoints();

        app.MapAdminSettingsEndpoints();
        app.MapQuestionsEndpoints();
        app.MapGuestsEndpoints();
        app.MapContentEndpoints();
        app.MapPhotosEndpoints();
        app.MapShowEndpoints();

        app.MapHub<ShowHub>("/hubs/show");

        // ניווט ישיר לכתובת באפליקציה (למשל /photos) מחזיר את Angular
        app.MapFallbackToFile("index.html");
        return app;
    }
}
