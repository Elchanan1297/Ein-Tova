using System.Security.Cryptography;
using System.Text;
using EinTova.DataAccess.Repositories;
using EinTova.Infrastructure.Options;
using EinTova.Models.Auth;
using Microsoft.Extensions.Options;

namespace EinTova.Business.Auth;

public interface IAuthService
{
    Task<LoginResponse?> LoginByCodeAsync(string code);
    Task<LoginResponse?> LoginByPhoneAsync(string phone);
    /// <summary>null = סיסמה שגויה</summary>
    string? AdminLogin(string? password);
}

internal sealed class AuthService(AuthRepository repo, TokenService tokens, IOptions<AdminOptions> admin) : IAuthService
{
    public async Task<LoginResponse?> LoginByCodeAsync(string code) => Respond(await repo.LoginByCodeAsync(code));

    public async Task<LoginResponse?> LoginByPhoneAsync(string phone) => Respond(await repo.LoginByPhoneAsync(phone));

    public string? AdminLogin(string? password)
    {
        // השוואה בזמן קבוע (גיבוב לאורך אחיד), כדי שזמן התגובה לא ירמוז על הסיסמה
        var ok = CryptographicOperations.FixedTimeEquals(
            SHA256.HashData(Encoding.UTF8.GetBytes(password ?? "")),
            SHA256.HashData(Encoding.UTF8.GetBytes(admin.Value.Password)));
        return ok ? tokens.AdminToken() : null;
    }

    LoginResponse? Respond(GuestDto? g) => g is null ? null : new LoginResponse(tokens.GuestToken(g.GuestId), g);
}
