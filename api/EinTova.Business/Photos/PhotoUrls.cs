using System.Security.Cryptography;
using System.Text;
using EinTova.Models.Photos;

namespace EinTova.Business.Photos;

/// <summary>
/// כתובות חתומות לתמונות: &lt;img&gt; לא שולח JWT, אז כל רשימה מחזירה כתובות עם חתימה (HMAC) ותוקף.
/// k=g (אורח/מצגת: רק תמונות שפורסמו) או k=a (מנהל: כל התמונות, כולל המקור).
/// התוקף מעוגל ליום, כדי שהכתובת תהיה יציבה והדפדפן ישתמש במטמון.
/// </summary>
public sealed class PhotoUrls(byte[] key)
{
    /// <summary>מפתח נפרד לחתימה, נגזר ממפתח ה־JWT</summary>
    public static PhotoUrls FromJwtKey(string jwtKey) => new(SHA256.HashData(Encoding.UTF8.GetBytes("photos:" + jwtKey)));

    public string Url(Guid id, string size, char scope)
    {
        var exp = new DateTimeOffset(DateTime.UtcNow.Date.AddDays(2), TimeSpan.Zero).ToUnixTimeSeconds();
        return $"/api/photos/{id:D}/{size}?k={scope}&e={exp}&s={Sign(id, size, scope, exp)}";
    }

    public bool IsValid(Guid id, string size, char scope, long exp, string? sig) =>
        exp > DateTimeOffset.UtcNow.ToUnixTimeSeconds() && sig is not null &&
        CryptographicOperations.FixedTimeEquals(Encoding.ASCII.GetBytes(Sign(id, size, scope, exp)), Encoding.ASCII.GetBytes(sig));

    /// <summary>מוסיף לשורה מה־DB את הכתובות החתומות (thumbUrl, displayUrl, ולמנהל גם origUrl)</summary>
    public IDictionary<string, object?> AddTo(IDictionary<string, object?> row, char scope)
    {
        var id = (Guid)row["PublicId"]!;
        row["thumbUrl"] = Url(id, PhotoSizes.Thumb, scope);
        row["displayUrl"] = Url(id, PhotoSizes.Display, scope);
        if (scope == PhotoScope.Admin) row["origUrl"] = Url(id, PhotoSizes.Orig, scope);
        return row;
    }

    string Sign(Guid id, string size, char scope, long exp)
    {
        var mac = HMACSHA256.HashData(key, Encoding.UTF8.GetBytes($"{id:D}:{size}:{scope}:{exp}"));
        return Convert.ToBase64String(mac, 0, 16).TrimEnd('=').Replace('+', '-').Replace('/', '_');
    }
}
