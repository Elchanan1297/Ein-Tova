using EinTova.Api.Application;
using EinTova.Business.Admin;
using EinTova.Business.Content;
using EinTova.Business.Leaderboard;
using EinTova.Business.SaveTheDate;

namespace EinTova.Api.Mapping;

/// <summary>הגדרות ציבוריות, לוח תוצאות, תוכנית, ברכות, ובדיקת תקינות</summary>
public static class PublicMapping
{
    public static void MapPublicEndpoints(this WebApplication app)
    {
        // בלי מטמון בכלל: ממנו הלקוח יודע אם האפליקציה נעולה (Save the date)
        app.MapGet("/api/config", async (HttpContext ctx, ISettingsService settings, ISaveTheDateService saveTheDate) =>
        {
            ctx.Response.Headers.CacheControl = "no-store";
            var config = new Dictionary<string, object?>((IDictionary<string, object?>)await settings.GetPublicConfigAsync())
            {
                ["SaveTheDate"] = await saveTheDate.GetPublicAsync(),
            };
            return Results.Ok(config);
        });

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
