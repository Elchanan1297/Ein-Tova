namespace EinTova.Models.Auth;

/// <summary>מוזמן מחובר, כמו שחוזר מ־usp_LoginByCode / usp_LoginByPhone</summary>
public class GuestDto
{
    public int GuestId { get; set; }
    public string FullName { get; set; } = "";
    public int FamilyId { get; set; }
    public string FamilyName { get; set; } = "";
    public string? Code { get; set; }
}

public record LoginCodeRequest(string Code);
public record LoginPhoneRequest(string Phone);
public record AdminLoginRequest(string? Password);

/// <summary>תשובת כניסה: טוקן + פרטי המוזמן</summary>
public record LoginResponse(string Token, GuestDto Guest);
