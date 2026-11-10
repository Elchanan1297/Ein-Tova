using EinTova.Api.Application;
using EinTova.Business.Auth;
using EinTova.Models.Auth;

namespace EinTova.Api.Mapping;

/// <summary>כניסת מוזמן (קוד מהקישור או טלפון) וכניסת מנהל (סיסמה ממשתנה סביבה)</summary>
public static class LoginMapping
{
    public static void MapLoginEndpoints(this WebApplication app)
    {
        app.MapPost("/api/login/code", async (LoginCodeRequest req, IAuthService auth) =>
            await auth.LoginByCodeAsync(req.Code) is { } res ? Results.Ok(res) : Results.Unauthorized())
            .RequireRateLimiting(RateLimits.Login);

        app.MapPost("/api/login/phone", async (LoginPhoneRequest req, IAuthService auth) =>
            await auth.LoginByPhoneAsync(req.Phone) is { } res ? Results.Ok(res) : Results.Unauthorized())
            .RequireRateLimiting(RateLimits.Login);

        app.MapPost("/api/admin/login", (AdminLoginRequest req, IAuthService auth) =>
            auth.AdminLogin(req.Password) is { } token ? Results.Ok(new { token }) : Results.Unauthorized())
            .RequireRateLimiting(RateLimits.AdminLogin);
    }
}
