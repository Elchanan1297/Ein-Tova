using System.Text.Json;
using EinTova.Api.Application;
using EinTova.Business.Content;
using EinTova.Business.Media;
using EinTova.Models.Admin;

namespace EinTova.Api.Mapping;

/// <summary>ניהול תוכן: ברכות, תוכנית, קליפי קול, והעלאת קבצים</summary>
public static class ContentMapping
{
    public static void MapContentEndpoints(this WebApplication app)
    {
        var admin = app.MapGroup("/api/admin").RequireAuthorization(AuthPolicies.Admin);

        MapKind(admin, "greetings", ContentKind.Greetings);
        MapKind(admin, "program", ContentKind.Program);
        MapKind(admin, "voices", ContentKind.Voices);

        admin.MapPut("/greetings/order", async (int[] ids, IContentService svc) =>
            MappingResults.FromStatus(await svc.ReorderGreetingsAsync(ids)));

        // טוקן Bearer, בלי עוגיות: אין צורך ב־antiforgery
        admin.MapPost("/upload/image", async (IFormFile file, IMediaService media) =>
        {
            await using var stream = file.OpenReadStream();
            return Upload(await media.UploadImageAsync(stream, file.Length));
        }).DisableAntiforgery();

        admin.MapPost("/upload/audio", async (IFormFile file, IMediaService media) =>
        {
            await using var stream = file.OpenReadStream();
            return Upload(await media.UploadAudioAsync(stream, file.Length, file.FileName));
        }).DisableAntiforgery();
    }

    /// <summary>רשימה / שמירה (JSON לפרוצדורה) / מחיקה</summary>
    static void MapKind(RouteGroupBuilder admin, string path, ContentKind kind)
    {
        admin.MapGet($"/{path}", async (IContentService svc) => Results.Ok(await svc.AdminListAsync(kind)));

        admin.MapPost($"/{path}", async (JsonElement body, IContentService svc) =>
            MappingResults.FromStatus(await svc.AdminSaveAsync(kind, body.GetRawText())));

        admin.MapDelete($"/{path}/{{id:int}}", async (int id, IContentService svc) =>
            MappingResults.FromStatus(await svc.AdminDeleteAsync(kind, id)));
    }

    static IResult Upload(MediaUploadResult r) =>
        r.Status == "OK" ? Results.Ok(new { status = r.Status, url = r.Url }) : Results.BadRequest(new { status = r.Status });
}
