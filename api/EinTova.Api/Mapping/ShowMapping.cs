using EinTova.Api.Application;
using EinTova.Business.Show;
using EinTova.Models.Show;

namespace EinTova.Api.Mapping;

/// <summary>שלט המצגת (/admin/show): בחירת סצנה והכרזת זוכה. המסך מקבל ב־SignalR.</summary>
public static class ShowMapping
{
    public static void MapShowEndpoints(this WebApplication app)
    {
        var show = app.MapGroup("/api/admin/show").RequireAuthorization(AuthPolicies.Admin);

        show.MapGet("", (IShowService svc) => Results.Ok(svc.Snapshot()));

        show.MapPost("/scene", async (SceneRequest r, IShowService svc) =>
            await svc.SetSceneAsync(r.Scene) is { } snap ? Results.Ok(snap) : Results.BadRequest(new { status = "BadValue" }));

        show.MapPost("/winner", async (IShowService svc) =>
            await svc.AnnounceWinnerAsync() is { } snap ? Results.Ok(snap) : Results.BadRequest(new { status = "NoScores" }));
    }
}
