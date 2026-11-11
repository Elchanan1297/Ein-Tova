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
            await svc.SetSceneAsync(r.Scene) is { } snap ? Results.Ok(snap)
                : Results.BadRequest(new { status = r.Scene == Scenes.Quiz ? "NoQuestions" : "BadValue" }));

        // החידון על המסך (למי שאין סמארטפון): אותן שאלות וזמנים כמו במשחק
        var quiz = show.MapGroup("/quiz");
        quiz.MapPost("/start", async (IShowService svc) => QuizResult(await svc.QuizStartAsync()));
        quiz.MapPost("/next", async (IShowService svc) => QuizResult(await svc.QuizNextAsync()));
        quiz.MapPost("/prev", async (IShowService svc) => QuizResult(await svc.QuizPrevAsync()));
        quiz.MapPost("/reveal", async (IShowService svc) => QuizResult(await svc.QuizRevealAsync()));
        quiz.MapPost("/auto", async (QuizAutoRequest r, IShowService svc) => QuizResult(await svc.QuizAutoAsync(r.On)));

        show.MapPost("/winner", async (IShowService svc) =>
            await svc.AnnounceWinnerAsync() is { } snap ? Results.Ok(snap) : Results.BadRequest(new { status = "NoScores" }));
    }

    static IResult QuizResult(object? snap) => snap is null ? Results.BadRequest(new { status = "NoQuestions" }) : Results.Ok(snap);
}
