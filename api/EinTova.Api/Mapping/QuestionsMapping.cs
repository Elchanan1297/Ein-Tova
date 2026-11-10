using System.Text.Json;
using EinTova.Api.Application;
using EinTova.Business.Admin;

namespace EinTova.Api.Mapping;

/// <summary>ניהול שאלות. הגוף עובר כמו שהוא לפרוצדורה (JSON); האימות שם.</summary>
public static class QuestionsMapping
{
    public static void MapQuestionsEndpoints(this WebApplication app)
    {
        var questions = app.MapGroup("/api/admin/questions").RequireAuthorization(AuthPolicies.Admin);

        questions.MapGet("", async (IQuestionsService svc) => Results.Ok(await svc.ListAsync()));

        questions.MapPost("", async (JsonElement body, IQuestionsService svc) =>
            MappingResults.FromStatus(await svc.SaveAsync(body.GetRawText())));

        questions.MapDelete("/{id:int}", async (int id, IQuestionsService svc) =>
            MappingResults.FromStatus(await svc.DeleteAsync(id)));

        questions.MapPut("/order", async (int[] ids, IQuestionsService svc) =>
            MappingResults.FromStatus(await svc.ReorderAsync(ids)));

        questions.MapPost("/import", async (JsonElement rows, IQuestionsService svc) =>
            MappingResults.FromStatus(await svc.ImportAsync(rows.GetRawText())));
    }
}
