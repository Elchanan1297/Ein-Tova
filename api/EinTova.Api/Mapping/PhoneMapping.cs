using System.Security.Cryptography;
using System.Text;
using EinTova.Business.Phone;
using EinTova.Infrastructure.Options;
using Microsoft.Extensions.Options;

namespace EinTova.Api.Mapping;

/// <summary>
/// קו הטלפון (ימות המשיח, שלוחת API): https://.../api/ivr?key=Ivr__Key.
/// ימות שולחת GET (או POST בטופס) עם ApiPhone, ApiCallId והמשתנים שהוקשו, ומקבלת טקסט פשוט.
/// </summary>
public static class PhoneMapping
{
    public static void MapPhoneEndpoints(this WebApplication app)
    {
        app.MapMethods("/api/ivr", ["GET", "POST"], async (HttpRequest req, IOptions<IvrOptions> opt, IPhoneGameService svc) =>
        {
            var key = opt.Value.Key;
            if (key.Length == 0 || !Same(req.Query["key"].ToString(), key)) return Results.NotFound();

            var p = new Dictionary<string, string>(StringComparer.Ordinal);
            foreach (var (k, v) in req.Query) p[k] = v.ToString();
            if (req.HasFormContentType)
                foreach (var (k, v) in await req.ReadFormAsync()) p[k] = v.ToString();

            var text = await svc.HandleAsync(p);
            return Results.Text(text, "text/plain; charset=utf-8");
        });
    }

    static bool Same(string a, string b) =>
        CryptographicOperations.FixedTimeEquals(Encoding.UTF8.GetBytes(a), Encoding.UTF8.GetBytes(b));
}
