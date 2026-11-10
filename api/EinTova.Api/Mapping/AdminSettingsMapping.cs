using EinTova.Api.Application;
using EinTova.Business.Admin;

namespace EinTova.Api.Mapping;

/// <summary>ניהול: הגדרות, סטטיסטיקה ואיפוס המשחק</summary>
public static class AdminSettingsMapping
{
    public static void MapAdminSettingsEndpoints(this WebApplication app)
    {
        var admin = app.MapGroup("/api/admin").RequireAuthorization(AuthPolicies.Admin);

        admin.MapGet("/settings", async (ISettingsService svc) => Results.Ok(await svc.GetAllAsync()));

        admin.MapPut("/settings", async (Dictionary<string, string?> values, ISettingsService svc) =>
        {
            var res = await svc.SaveAsync(values);
            return res.Status == "OK" ? Results.Ok(res) : Results.BadRequest(res);
        });

        admin.MapGet("/stats", async (ISettingsService svc) => Results.Ok(await svc.GameStatsAsync()));

        // איפוס המשחק לכולם: כל אחד יכול לשחק שוב
        admin.MapPost("/game/reset-all", async (ISettingsService svc) => Results.Ok(await svc.ResetAllAttemptsAsync()));
    }
}
