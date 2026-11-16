using EinTova.Api.Application;
using EinTova.Business.Ai;
using EinTova.Business.Dashboard;
using EinTova.Models.Ai;

namespace EinTova.Api.Mapping;

/// <summary>
/// תובנות AI (מנהל). כשהמתג כבוי: Disabled בלי שום קריאה חיצונית. שגיאת AI לא מפילה את הדף: סטטוס, לא 500.
/// לאורחים ולמסך: רק התובנות שהמנהל אישר, ורק אחרי פרסום התוצאות.
/// </summary>
public static class AiMapping
{
    public static void MapAiEndpoints(this WebApplication app)
    {
        var ai = app.MapGroup("/api/admin/ai").RequireAuthorization(AuthPolicies.Admin);

        ai.MapGet("/status", async (IInsightsService svc) => Results.Ok(await svc.StatusAsync()));
        ai.MapPost("/insights", async (InsightsRequest? r, IInsightsService svc) => Results.Ok(await svc.InsightsAsync(r?.Refresh ?? false)));
        ai.MapPost("/ask", async (AskRequest r, IInsightsService svc) => Results.Ok(await svc.AskAsync(r.Question)));
        ai.MapPost("/blessing", async (IInsightsService svc) => Results.Ok(await svc.BlessingAsync()));
        ai.MapPut("/published", async (PublishInsightsRequest r, IInsightsService svc) =>
        {
            await svc.PublishAsync(r.Insights);
            return Results.Ok(new { insights = await svc.PublishedAsync() });
        });
        ai.MapGet("/published", async (IInsightsService svc) => Results.Ok(new { insights = await svc.PublishedAsync() }));

        // לאורחים: רק אחרי "סיום המשחק ופרסום", ורק מה שאושר
        app.MapGet("/api/results/insights", async (IDashboardService dash, IInsightsService svc) =>
            await dash.GetPublicAsync() is null
                ? Results.NotFound(new { status = "NotPublished" })
                : Results.Ok(new { insights = await svc.PublishedAsync() }))
            .RequireAuthorization(AuthPolicies.Guest);
    }
}
