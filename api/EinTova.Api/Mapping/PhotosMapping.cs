using System.Security.Claims;
using System.Text.Json.Nodes;
using EinTova.Api.Application;
using EinTova.Business.Auth;
using EinTova.Business.Photos;
using EinTova.Models.Photos;

namespace EinTova.Api.Mapping;

/// <summary>"מסע בזמן": רק המנהל מעלה ועורך; אורחים צופים ועושים ❤️; המצגת מקבלת רשימה</summary>
public static class PhotosMapping
{
    public static void MapPhotosEndpoints(this WebApplication app)
    {
        var admin = app.MapGroup("/api/admin/photos").RequireAuthorization(AuthPolicies.Admin);

        // העלאה מהמכשיר: קובץ אחד לבקשה (הלקוח שולח עד 3 במקביל). שגיאות PhotoException → ErrorHandlingMiddleware
        admin.MapPost("", async (HttpRequest req, IPhotoService photos) =>
        {
            var form = await req.ReadFormAsync();
            var file = form.Files["file"];
            if (file is null) return MappingResults.Error(400, PhotoException.BadType, "לא נבחר קובץ");

            using var ms = new MemoryStream();
            await file.CopyToAsync(ms);
            short? year = short.TryParse(form["year"], out var y) ? y : null;
            var upload = new PhotoUpload(ms.ToArray(), file.FileName, form["caption"], year, form["yearApprox"] == "true");
            return Results.Ok(await photos.UploadAsync(upload));
        }).DisableAntiforgery();

        admin.MapGet("", async (byte? status, int? decade, int? skip, int? take, IPhotoService photos) =>
            Results.Ok(await photos.AdminListAsync(status, decade, skip, take)));

        // עריכה של תמונה אחת: אותה פרוצדורה כמו עדכון בכמות
        admin.MapPatch("/{publicId:guid}", async (Guid publicId, JsonObject body, IPhotoService photos) =>
        {
            body["ids"] = new JsonArray(publicId.ToString());
            return Update(await photos.UpdateAsync(body));
        });

        admin.MapPost("/bulk", async (JsonObject body, IPhotoService photos) => Update(await photos.UpdateAsync(body)));

        admin.MapPut("/order", async (Guid[] ids, IPhotoService photos) => Results.Ok(await photos.ReorderAsync(ids)));

        admin.MapDelete("/{publicId:guid}", async (Guid publicId, IPhotoService photos) =>
        {
            var (ok, status) = await photos.DeleteAsync(publicId);
            return ok ? Results.Ok(new { status }) : Results.NotFound(new { status });
        });

        // ---------- אורחים: צפייה בלבד ----------
        app.MapGet("/api/photos", async (int? decade, int? skip, int? take, ClaimsPrincipal u, IPhotoService photos) =>
            Results.Ok(await photos.ListPublishedAsync(TokenService.GuestId(u), decade, skip, take)))
            .RequireAuthorization(AuthPolicies.Guest);

        app.MapPut("/api/photos/{publicId:guid}/like", async (Guid publicId, ClaimsPrincipal u, IPhotoService photos) =>
        {
            var r = await photos.ToggleLikeAsync(publicId, TokenService.GuestId(u));
            return (string)r.Status == "OK" ? Results.Ok((object)r) : Results.NotFound((object)r);
        }).RequireAuthorization(AuthPolicies.Guest);

        // מצגת (מסך גדול, נכנס עם טוקן מנהל כמו שאר המצגת)
        app.MapGet("/api/slideshow/photos", async (IPhotoService photos) => Results.Ok(await photos.SlideshowAsync()))
            .RequireAuthorization(AuthPolicies.Admin);

        // ---------- הקבצים עצמם: לפי חתימה, בלי כותרת הזדהות ----------
        app.MapGet("/api/photos/{publicId:guid}/{size}", async (Guid publicId, string size, string? k, long? e, string? s,
            HttpContext ctx, IPhotoService photos) =>
        {
            if (!photos.IsSignedUrlValid(publicId, size, k, e, s)) return Results.NotFound();
            // לפני ה־DB: הדפדפן כבר מחזיק את הקובץ
            if (ctx.Request.Headers.IfNoneMatch == $"\"{publicId:N}-{size}\"") return Results.StatusCode(304);

            var file = await photos.OpenFileAsync(publicId, size, k, e, s);
            if (file is null) return Results.NotFound();

            var headers = ctx.Response.Headers;
            headers.CacheControl = "private, max-age=31536000, immutable";
            headers.ETag = file.ETag;
            headers.XContentTypeOptions = "nosniff";
            return Results.File(file.Content, file.ContentType, file.DownloadName);
        });
    }

    static IResult Update((bool Ok, dynamic Result) r) => r.Ok ? Results.Ok((object)r.Result) : Results.BadRequest((object)r.Result);
}
