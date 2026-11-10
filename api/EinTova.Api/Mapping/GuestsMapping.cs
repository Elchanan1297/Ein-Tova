using System.Text.Json;
using EinTova.Api.Application;
using EinTova.Business.Admin;
using EinTova.Models.Admin;

namespace EinTova.Api.Mapping;

/// <summary>ניהול מוזמנים ומשפחות</summary>
public static class GuestsMapping
{
    public static void MapGuestsEndpoints(this WebApplication app)
    {
        var admin = app.MapGroup("/api/admin").RequireAuthorization(AuthPolicies.Admin);

        admin.MapGet("/guests", async (IGuestsService svc) => Results.Ok(await svc.ListAsync()));

        admin.MapPost("/families", async (FamilyRequest r, IGuestsService svc) =>
            MappingResults.FromStatus(await svc.SaveFamilyAsync(r.FamilyId, r.Name)));

        admin.MapDelete("/families/{id:int}", async (int id, IGuestsService svc) =>
            MappingResults.FromStatus(await svc.DeleteFamilyAsync(id)));

        admin.MapPost("/guests", async (JsonElement body, IGuestsService svc) =>
            MappingResults.FromStatus(await svc.SaveGuestAsync(body.GetRawText())));

        admin.MapDelete("/guests/{id:int}", async (int id, IGuestsService svc) =>
            MappingResults.FromStatus(await svc.DeleteGuestAsync(id)));

        admin.MapPost("/guests/{id:int}/new-code", async (int id, IGuestsService svc) =>
            MappingResults.FromStatus(await svc.NewCodeAsync(id)));

        admin.MapPost("/guests/{id:int}/reset", async (int id, IGuestsService svc) =>
        {
            await svc.ResetAttemptAsync(id);
            return Results.Ok(new { status = "OK" });
        });

        admin.MapPost("/guests/import", async (JsonElement rows, IGuestsService svc) =>
            MappingResults.FromStatus(await svc.ImportAsync(rows.GetRawText())));
    }
}
