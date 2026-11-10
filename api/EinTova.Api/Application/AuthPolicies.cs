namespace EinTova.Api.Application;

/// <summary>שמות מדיניות הרשאה ומגבלות קצב</summary>
public static class AuthPolicies
{
    /// <summary>טוקן של מוזמן (gid). לא מחליף טוקן של מנהל, וההפך.</summary>
    public const string Guest = "guest";
    public const string Admin = "admin";
}

public static class RateLimits
{
    public const string Login = "login";
    public const string AdminLogin = "admin-login";
}
