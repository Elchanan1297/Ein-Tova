namespace EinTova.Infrastructure.Options;

// הגדרות מגיעות מ־appsettings (פיתוח) או ממשתני סביבה (ייצור), למשל Jwt__Key, Admin__Password.
// הבדיקות רצות בעליית השרת (ValidateOnStart): ערך חסר או ערך של פיתוח בייצור = השרת לא עולה.

public sealed class JwtOptions
{
    public const string Section = "Jwt";
    public string Key { get; set; } = "";
}

public sealed class AdminOptions
{
    public const string Section = "Admin";
    public string Password { get; set; } = "";
}

/// <summary>קבצים שהמנהל מעלה (ברכות, קולות). מוגשים ב־/media.</summary>
public sealed class MediaOptions
{
    public const string Section = "Media";
    public string Root { get; set; } = "";
}

/// <summary>תמונות "מסע בזמן". לא תחת /media: מוגשות רק בכתובת חתומה.</summary>
public sealed class PhotosOptions
{
    public const string Section = "Photos";
    public string Root { get; set; } = "";
}

/// <summary>ערכי פיתוח שאסור שיגיעו לייצור</summary>
public static class DevDefaults
{
    public const string JwtKey = "dev-only-change-me-please-0123456789abcdef";
    public const string AdminPassword = "dev-admin";
}
