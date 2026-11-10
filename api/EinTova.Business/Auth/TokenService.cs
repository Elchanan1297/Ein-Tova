using System.Security.Claims;
using System.Text;
using EinTova.Infrastructure.Options;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;

namespace EinTova.Business.Auth;

/// <summary>
/// טוקנים: מוזמן (gid, 7 ימים) ומנהל (role=admin, 12 שעות).
/// אותו מפתח משמש לאימות ב־JwtBearer, ומפתח נגזר ממנו חותם את כתובות התמונות.
/// </summary>
public sealed class TokenService(IOptions<JwtOptions> options)
{
    public const string GuestClaim = "gid";
    public const string RoleClaim = "role";
    public const string AdminRole = "admin";

    public SymmetricSecurityKey SigningKey { get; } = new(Encoding.UTF8.GetBytes(options.Value.Key));

    /// <summary>שבוע: הקישורים נשלחים לפני האירוע, ולא צריך להיכנס מחדש ביום עצמו</summary>
    public string GuestToken(int guestId) => Create(new Claim(GuestClaim, guestId.ToString()), TimeSpan.FromDays(7));

    public string AdminToken() => Create(new Claim(RoleClaim, AdminRole), TimeSpan.FromHours(12));

    public static int GuestId(ClaimsPrincipal user) => int.Parse(user.FindFirst(GuestClaim)!.Value);

    string Create(Claim claim, TimeSpan life) => new JsonWebTokenHandler().CreateToken(new SecurityTokenDescriptor
    {
        Subject = new ClaimsIdentity(new[] { claim }),
        Expires = DateTime.UtcNow.Add(life),
        SigningCredentials = new SigningCredentials(SigningKey, SecurityAlgorithms.HmacSha256),
    });
}
