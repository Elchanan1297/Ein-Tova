using System.Security.Claims;
using EinTova.Api.Application;
using EinTova.Business.Auth;
using EinTova.Business.Game;
using EinTova.Models.Game;

namespace EinTova.Api.Mapping;

/// <summary>המשחק (דורש כניסה). הטיימר נמדד בשרת; התשובה הנכונה לא נשלחת לפני המענה.</summary>
public static class GameMapping
{
    public static void MapGameEndpoints(this WebApplication app)
    {
        var game = app.MapGroup("/api/game").RequireAuthorization(AuthPolicies.Guest);

        game.MapPost("/start", async (ClaimsPrincipal u, IGameService svc) =>
            Results.Ok(await svc.StartAsync(TokenService.GuestId(u))));

        game.MapGet("/next", async (ClaimsPrincipal u, IGameService svc) =>
            Results.Ok(await svc.NextAsync(TokenService.GuestId(u))));

        game.MapPost("/answer", async (AnswerRequest r, ClaimsPrincipal u, IGameService svc) =>
            Results.Ok(await svc.AnswerAsync(TokenService.GuestId(u), r.OptionId)));

        game.MapPost("/timeout", async (ClaimsPrincipal u, IGameService svc) =>
            Results.Ok(await svc.TimeoutAsync(TokenService.GuestId(u))));

        game.MapGet("/voice/{eventType}", async (string eventType, IGameService svc) =>
        {
            if (!svc.IsVoiceEvent(eventType)) return Results.BadRequest();
            var clip = await svc.VoiceClipAsync(eventType);
            return clip is null ? Results.NoContent() : Results.Ok((object)clip);
        });
    }
}
