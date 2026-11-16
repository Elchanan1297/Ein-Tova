using EinTova.Api.Application;
using EinTova.Business.Dashboard;
using EinTova.Models.Dashboard;

namespace EinTova.Api.Mapping;

/// <summary>
/// דשבורדים. מנהל: תמיד, בזמן אמת. אורחים: /api/results רק אחרי "סיום המשחק" (אחרת 404 NotPublished).
/// </summary>
public static class DashboardMapping
{
    public static void MapDashboardEndpoints(this WebApplication app)
    {
        var admin = app.MapGroup("/api/admin").RequireAuthorization(AuthPolicies.Admin);
        admin.MapGet("/dashboard", async (IDashboardService svc) => Results.Ok(await svc.GetAdminAsync()));
        // הדשבורד המתקדם: המספרים והגרפים בטעינה אחת
        admin.MapGet("/dash", async (IDashboardService svc) => Results.Ok(await svc.GetAdminFullAsync()));

        // סיום המשחק: סוגר לכולם ומפרסם את הדשבורדים (או מבטל את הפרסום)
        admin.MapPost("/game/results", async (PublishRequest r, IDashboardService svc) =>
        {
            await svc.SetPublishedAsync(r.Publish);
            return Results.Ok(new { published = r.Publish });
        });

        app.MapGet("/api/results", async (IDashboardService svc) =>
            await svc.GetPublicAsync() is { } data ? Results.Ok(data) : Results.NotFound(new { status = "NotPublished" }))
            .RequireAuthorization(AuthPolicies.Guest);
    }
}
