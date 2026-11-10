using EinTova.Api.Application;
using EinTova.Business.Admin;
using EinTova.Business.Content;
using EinTova.Business.Leaderboard;

namespace EinTova.Api.Mapping;

/// <summary>הגדרות ציבוריות, לוח תוצאות, תוכנית, ברכות, ובדיקת תקינות</summary>
public static class PublicMapping
{
    public static void MapPublicEndpoints(this WebApplication app)
    {
        app.MapGet("/api/config", async (ISettingsService settings) =>
            Results.Ok(await settings.GetPublicConfigAsync()));

        // מטמון קצר: כל הטלפונים באולם מרעננים את הלוח כל כמה שניות
        app.MapGet("/api/leaderboard", async (ILeaderboardService leaderboard) =>
            Results.Ok(await leaderboard.GetAsync()));

        app.MapGet("/api/program", async (IContentService content) =>
            Results.Ok(await content.GetProgramAsync()));

        // ברכות (תמונות משפחתיות) רק למוזמנים מחוברים
        app.MapGet("/api/greetings", async (IContentService content) =>
            Results.Ok(await content.GetGreetingsAsync())).RequireAuthorization(AuthPolicies.Guest);

        // לאירוח (Azure / Docker): השרת חי וה־DB עונה
        app.MapGet("/health", async (ISettingsService settings) =>
        {
            try
            {
                await settings.GetPublicConfigAsync();
                return Results.Ok(new { status = "OK" });
            }
            catch
            {
                return Results.Json(new { status = "DbDown" }, statusCode: 503);
            }
        });
    }
}
