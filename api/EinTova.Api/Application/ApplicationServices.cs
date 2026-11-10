using System.Text.Json;
using EinTova.Business.Auth;
using EinTova.Infrastructure.Options;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.IdentityModel.Tokens;

namespace EinTova.Api.Application;

/// <summary>שירותי HTTP: הגדרות (עם בדיקה בעלייה), JWT, הרשאות, מגבלות קצב, CORS, SignalR</summary>
public static class ApplicationServices
{
    public static WebApplicationBuilder AddApplicationServices(this WebApplicationBuilder builder)
    {
        var services = builder.Services;
        var config = builder.Configuration;
        var isDev = builder.Environment.IsDevelopment();

        // ---------- הגדרות: חסר או ערך של פיתוח בייצור = השרת לא עולה ----------
        services.AddOptions<JwtOptions>().Bind(config.GetSection(JwtOptions.Section))
            .Validate(o => o.Key.Length >= 32, "Jwt__Key חסר או קצר מ־32 תווים")
            .Validate(o => isDev || o.Key != DevDefaults.JwtKey, "Jwt__Key של פיתוח לא מותר בייצור")
            .ValidateOnStart();
        services.AddOptions<AdminOptions>().Bind(config.GetSection(AdminOptions.Section))
            .Validate(o => o.Password.Length > 0, "Admin__Password חסר")
            .Validate(o => isDev || (o.Password != DevDefaults.AdminPassword && o.Password.Length >= 10),
                "Admin__Password בייצור: לא סיסמת הפיתוח, ולפחות 10 תווים")
            .ValidateOnStart();

        services.ConfigureHttpJsonOptions(o => o.SerializerOptions.DictionaryKeyPolicy = JsonNamingPolicy.CamelCase);

        // ---------- JWT ----------
        services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer();
        services.AddOptions<JwtBearerOptions>(JwtBearerDefaults.AuthenticationScheme).Configure<TokenService>((o, tokens) =>
        {
            o.MapInboundClaims = false;
            // SignalR ב־WebSocket לא שולח כותרות: הטוקן מגיע ב־query string, רק ל־/hubs
            o.Events = new JwtBearerEvents
            {
                OnMessageReceived = c =>
                {
                    if (c.Request.Path.StartsWithSegments("/hubs")) c.Token = c.Request.Query["access_token"];
                    return Task.CompletedTask;
                },
            };
            o.TokenValidationParameters = new TokenValidationParameters
            {
                IssuerSigningKey = tokens.SigningKey, ValidateIssuer = false, ValidateAudience = false, ValidateLifetime = true,
            };
        });
        services.AddAuthorization(o =>
        {
            o.AddPolicy(AuthPolicies.Guest, p => p.RequireClaim(TokenService.GuestClaim));
            o.AddPolicy(AuthPolicies.Admin, p => p.RequireClaim(TokenService.RoleClaim, TokenService.AdminRole));
        });

        // ---------- מגבלות קצב ----------
        services.AddRateLimiter(o =>
        {
            o.RejectionStatusCode = 429;
            // משותפת לכל השרת, ונדיבה: גם אם כל האולם נכנס באותה דקה, אף אחד לא נחסם.
            // ניחוש קוד (6 תווים מתוך 31) לא מעשי גם בקצב הזה.
            o.AddFixedWindowLimiter(RateLimits.Login, c => { c.PermitLimit = 300; c.Window = TimeSpan.FromMinutes(1); c.QueueLimit = 0; });
            o.AddFixedWindowLimiter(RateLimits.AdminLogin, c => { c.PermitLimit = 10; c.Window = TimeSpan.FromMinutes(1); c.QueueLimit = 0; });
        });

        var origins = config.GetSection("Cors:Origins").Get<string[]>() ?? Array.Empty<string>();
        services.AddCors(o => o.AddDefaultPolicy(p => p.WithOrigins(origins).AllowAnyHeader().AllowAnyMethod()));

        services.AddSignalR();
        return builder;
    }
}
