using EinTova.Business.Auth;
using EinTova.Business.SaveTheDate;

namespace EinTova.Api.Middleware;

/// <summary>
/// נעילת Save the date בשרת: כשנעול, כל /api מחזיר 423 { code: "SaveTheDate" }, גם עם JWT תקף של מוזמן.
/// פתוחים: /api/config (המסך עצמו), /api/admin/** (דורש מנהל כרגיל, כולל הכניסה), קבצי תמונות חתומים
/// (החתימה היא ההרשאה, ומקבלים אותה רק מרשימה שנחסמת), ומי שמחזיק טוקן מנהל.
/// מחוץ ל־/api: /health, /hubs, הקבצים של האפליקציה.
/// </summary>
public sealed class SaveTheDateMiddleware(RequestDelegate next)
{
    /// <summary>הלקוח שולח את טוקן המנהל גם לבקשות שאינן /api/admin, כדי שהמנהל יראה את האפליקציה בזמן נעילה</summary>
    public const string AdminHeader = "X-Admin-Token";

    public async Task InvokeAsync(HttpContext ctx, SaveTheDateGate gate, TokenService tokens)
    {
        if (IsOpenPath(ctx.Request) || !await gate.IsLockedAsync() || await IsAdmin(ctx, tokens))
        {
            await next(ctx);
            return;
        }
        ctx.Response.StatusCode = StatusCodes.Status423Locked;
        ctx.Response.Headers.CacheControl = "no-store";
        await ctx.Response.WriteAsJsonAsync(new { code = "SaveTheDate", message = "האפליקציה נפתחת בקרוב" });
    }

    static bool IsOpenPath(HttpRequest req)
    {
        var p = req.Path;
        if (!p.StartsWithSegments("/api")) return true;
        if (p.StartsWithSegments("/api/config") || p.StartsWithSegments("/api/admin")) return true;
        // /api/photos/{guid}/{size}?k=..&e=..&s=.. (קובץ חתום, לא הרשימה)
        var parts = p.Value!.Split('/', StringSplitOptions.RemoveEmptyEntries);
        return HttpMethods.IsGet(req.Method) && parts.Length == 4 && parts[1] == "photos"
            && Guid.TryParse(parts[2], out _) && req.Query.ContainsKey("s");
    }

    static async Task<bool> IsAdmin(HttpContext ctx, TokenService tokens) =>
        ctx.User.HasClaim(TokenService.RoleClaim, TokenService.AdminRole)
        || await tokens.IsAdminTokenAsync(ctx.Request.Headers[AdminHeader].ToString());
}
