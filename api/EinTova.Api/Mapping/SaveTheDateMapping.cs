using EinTova.Api.Application;
using EinTova.Business.SaveTheDate;
using EinTova.Models.SaveTheDate;

namespace EinTova.Api.Mapping;

/// <summary>ניהול מצב Save the date (הקריאה הציבורית ב־/api/config)</summary>
public static class SaveTheDateMapping
{
    public static void MapSaveTheDateEndpoints(this WebApplication app)
    {
        var admin = app.MapGroup("/api/admin/save-the-date").RequireAuthorization(AuthPolicies.Admin);

        admin.MapGet("", async (ISaveTheDateService svc) => Results.Ok(await svc.GetAsync()));

        admin.MapPut("", async (SaveTheDateRequest req, ISaveTheDateService svc) =>
        {
            var res = await svc.SaveAsync(req);
            return res.Status == "OK" ? Results.Ok(await svc.GetAsync()) : Results.BadRequest(res);
        });
    }
}
