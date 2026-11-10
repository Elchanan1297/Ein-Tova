using EinTova.Business.Photos;

namespace EinTova.Api.Middleware;

/// <summary>
/// שגיאות במקום אחד: שגיאה מוכרת (PhotoException) → סטטוס מתאים והודעה בעברית;
/// כל השאר → נרשם ביומן, והלקוח מקבל 500 בלי פרטים פנימיים.
/// </summary>
public sealed class ErrorHandlingMiddleware(RequestDelegate next, ILogger<ErrorHandlingMiddleware> log)
{
    public async Task InvokeAsync(HttpContext ctx)
    {
        try
        {
            await next(ctx);
        }
        catch (PhotoException e) when (!ctx.Response.HasStarted)
        {
            var code = e.Code switch
            {
                PhotoException.BadType => StatusCodes.Status415UnsupportedMediaType,
                PhotoException.StorageFull => StatusCodes.Status507InsufficientStorage,
                _ => StatusCodes.Status413PayloadTooLarge,
            };
            await Write(ctx, code, e.Code, e.Message);
        }
        catch (Exception e) when (!ctx.Response.HasStarted && !ctx.RequestAborted.IsCancellationRequested)
        {
            log.LogError(e, "Unhandled error on {Method} {Path}", ctx.Request.Method, ctx.Request.Path);
            await Write(ctx, StatusCodes.Status500InternalServerError, "Error", "משהו השתבש. נסו שוב.");
        }
    }

    static Task Write(HttpContext ctx, int statusCode, string status, string message)
    {
        ctx.Response.Clear();
        ctx.Response.StatusCode = statusCode;
        return ctx.Response.WriteAsJsonAsync(new { status, message });
    }
}
