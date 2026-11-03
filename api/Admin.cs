using System.Data;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Dapper;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Caching.Memory;

/// <summary>נקודות קצה של מסך הניהול. כניסה בסיסמה ממשתנה סביבה (Admin__Password).</summary>
static class AdminEndpoints
{
    const CommandType Sp = CommandType.StoredProcedure;

    public static void MapAdmin(this WebApplication app, string? password, Func<string> adminToken, string mediaRoot)
    {
        app.MapPost("/api/admin/login", (AdminLogin req) =>
        {
            // בלי סיסמה מוגדרת, הניהול סגור
            if (string.IsNullOrEmpty(password)) return Results.NotFound();
            var ok = CryptographicOperations.FixedTimeEquals(
                SHA256.HashData(Encoding.UTF8.GetBytes(req.Password ?? "")),
                SHA256.HashData(Encoding.UTF8.GetBytes(password)));
            return ok ? Results.Ok(new { token = adminToken() }) : Results.Unauthorized();
        }).RequireRateLimiting("admin-login");

        var admin = app.MapGroup("/api/admin").RequireAuthorization("admin");

        admin.MapGet("/settings", async (SqlConnection db) =>
        {
            var rows = await db.QueryAsync<(string Key, string? Value)>("usp_AdminGetSettings", commandType: Sp);
            return Results.Ok(rows.ToDictionary(r => r.Key, r => r.Value));
        });

        admin.MapPut("/settings", async (Dictionary<string, string?> values, SqlConnection db, IMemoryCache cache) =>
        {
            // המפתחות מגיעים ב־camelCase (כמו ב־GET), ב־DB הם PascalCase
            var json = JsonSerializer.Serialize(values.ToDictionary(kv => char.ToUpperInvariant(kv.Key[0]) + kv.Key[1..], kv => kv.Value));
            var res = await db.QueryFirstAsync<SaveResult>("usp_AdminSaveSettings", new { Json = json }, commandType: Sp);
            if (res.Status != "OK") return Results.BadRequest(res with { Field = res.Field is null ? null : char.ToLowerInvariant(res.Field[0]) + res.Field[1..] });
            cache.Remove("leaderboard"); // LeaderboardRank משפיע מיד
            return Results.Ok(res);
        });

        admin.MapGet("/stats", async (SqlConnection db) =>
        {
            using var m = await db.QueryMultipleAsync("usp_AdminGameStats", commandType: Sp);
            var summary = await m.ReadFirstAsync();
            var questions = (await m.ReadAsync()).ToList();
            return Results.Ok(new { summary, questions });
        });

        // ---------- שאלות ----------
        admin.MapGet("/questions", async (SqlConnection db) =>
        {
            using var m = await db.QueryMultipleAsync("usp_AdminListQuestions", commandType: Sp);
            var questions = (await m.ReadAsync<QuestionRow>()).ToList();
            var options = (await m.ReadAsync<OptionRow>()).ToLookup(o => o.QuestionId);
            return Results.Ok(questions.Select(q => new
            {
                q.QuestionId, q.SortOrder, q.Body, q.ImageUrl, q.Fact, q.TimeLimitSec, q.IsActive, q.InUse,
                options = options[q.QuestionId].Select(o => new { o.OptionId, o.Body, o.IsCorrect })
            }));
        });

        // הגוף עובר כמו שהוא לפרוצדורה (JSON); האימות שם
        admin.MapPost("/questions", async (JsonElement body, SqlConnection db) =>
            StatusResult(await db.QueryFirstAsync("usp_AdminSaveQuestion", new { Json = body.GetRawText() }, commandType: Sp)));

        admin.MapDelete("/questions/{id:int}", async (int id, SqlConnection db) =>
            StatusResult(await db.QueryFirstAsync("usp_AdminDeleteQuestion", new { QuestionId = id }, commandType: Sp)));

        admin.MapPut("/questions/order", async (int[] ids, SqlConnection db) =>
            StatusResult(await db.QueryFirstAsync("usp_AdminReorderQuestions", new { Json = JsonSerializer.Serialize(ids) }, commandType: Sp)));

        admin.MapPost("/questions/import", async (JsonElement rows, SqlConnection db) =>
            StatusResult(await db.QueryFirstAsync("usp_AdminImportQuestions", new { Json = rows.GetRawText() }, commandType: Sp)));

        // ---------- מוזמנים ומשפחות ----------
        admin.MapGet("/guests", async (SqlConnection db) =>
        {
            using var m = await db.QueryMultipleAsync("usp_AdminListGuests", commandType: Sp);
            var families = (await m.ReadAsync()).ToList();
            var guests = (await m.ReadAsync()).ToList();
            return Results.Ok(new { families, guests });
        });

        admin.MapPost("/families", async (FamilyReq r, SqlConnection db, IMemoryCache cache) =>
        {
            cache.Remove("leaderboard"); // שם משפחה מופיע בלוח
            return StatusResult(await db.QueryFirstAsync("usp_AdminSaveFamily", new { r.FamilyId, r.Name }, commandType: Sp));
        });

        admin.MapDelete("/families/{id:int}", async (int id, SqlConnection db) =>
            StatusResult(await db.QueryFirstAsync("usp_AdminDeleteFamily", new { FamilyId = id }, commandType: Sp)));

        admin.MapPost("/guests", async (JsonElement body, SqlConnection db) =>
            StatusResult(await db.QueryFirstAsync("usp_AdminSaveGuest", new { Json = body.GetRawText() }, commandType: Sp)));

        admin.MapDelete("/guests/{id:int}", async (int id, SqlConnection db) =>
            StatusResult(await db.QueryFirstAsync("usp_AdminDeleteGuest", new { GuestId = id }, commandType: Sp)));

        admin.MapPost("/guests/{id:int}/new-code", async (int id, SqlConnection db) =>
            StatusResult(await db.QueryFirstAsync("usp_AdminNewGuestCode", new { GuestId = id }, commandType: Sp)));

        admin.MapPost("/guests/{id:int}/reset", async (int id, SqlConnection db, IMemoryCache cache) =>
        {
            await db.ExecuteAsync("usp_AdminResetAttempt", new { GuestId = id }, commandType: Sp);
            cache.Remove("leaderboard");
            return Results.Ok(new { status = "OK" });
        });

        admin.MapPost("/guests/import", async (JsonElement rows, SqlConnection db) =>
            StatusResult(await db.QueryFirstAsync("usp_AdminImportGuests", new { Json = rows.GetRawText() }, commandType: Sp)));

        // ---------- תוכן: ברכות, תוכנית, קליפי קול ----------
        admin.MapMediaUpload(mediaRoot);
        MapContent(admin, "greetings", "usp_AdminListGreetings", "usp_AdminSaveGreeting", "usp_AdminDeleteGreeting", cacheKey: "greetings");
        MapContent(admin, "program", "usp_AdminListProgram", "usp_AdminSaveProgramItem", "usp_AdminDeleteProgramItem", cacheKey: "program");
        MapContent(admin, "voices", "usp_AdminListVoiceClips", "usp_AdminSaveVoiceClip", "usp_AdminDeleteVoiceClip", cacheKey: null);

        admin.MapPut("/greetings/order", async (int[] ids, SqlConnection db, IMemoryCache cache) =>
        {
            cache.Remove("greetings");
            return StatusResult(await db.QueryFirstAsync("usp_AdminReorderGreetings", new { Json = JsonSerializer.Serialize(ids) }, commandType: Sp));
        });
    }

    /// <summary>רשימה / שמירה (JSON לפרוצדורה) / מחיקה, ומחיקת המטמון הציבורי אחרי שינוי</summary>
    static void MapContent(RouteGroupBuilder admin, string path, string list, string save, string delete, string? cacheKey)
    {
        admin.MapGet($"/{path}", async (SqlConnection db) => Results.Ok(await db.QueryAsync(list, commandType: Sp)));

        admin.MapPost($"/{path}", async (JsonElement body, SqlConnection db, IMemoryCache cache) =>
        {
            if (cacheKey is not null) cache.Remove(cacheKey);
            return StatusResult(await db.QueryFirstAsync(save, new { Json = body.GetRawText() }, commandType: Sp));
        });

        admin.MapDelete($"/{path}/{{id:int}}", async (int id, SqlConnection db, IMemoryCache cache) =>
        {
            if (cacheKey is not null) cache.Remove(cacheKey);
            return StatusResult(await db.QueryFirstAsync(delete, new { Id = id }, commandType: Sp));
        });
    }

    /// <summary>תוצאת פרוצדורה עם Status: OK → 200, אחרת 400 עם אותו גוף</summary>
    static IResult StatusResult(dynamic row) =>
        (string)row.Status == "OK" ? Results.Ok(row) : Results.BadRequest(row);
}

record QuestionRow(int QuestionId, int SortOrder, string Body, string? ImageUrl, string? Fact, int? TimeLimitSec, bool IsActive, bool InUse);
record OptionRow(int OptionId, int QuestionId, string Body, bool IsCorrect, int SortOrder);
record FamilyReq(int? FamilyId, string? Name);

record AdminLogin(string? Password);
record SaveResult(string Status, string? Field);
