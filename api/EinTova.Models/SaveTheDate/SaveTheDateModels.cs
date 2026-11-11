namespace EinTova.Models.SaveTheDate;

/// <summary>כל ההגדרות של מצב Save the date, ומצב הנעילה בפועל (אחרי פתיחה אוטומטית)</summary>
public record SaveTheDateSettings(
    bool Locked, bool Enabled, string? EventAt, string Display, string? HebrewText, bool AfterNightfall,
    string Headline, string? Subline, string? Location, bool ShowCountdown, string? AutoOpenAt);

/// <summary>שמירה מהניהול. תאריכים ב־ISO עם אזור (נשמרים ב־UTC)</summary>
public record SaveTheDateRequest(
    bool Enabled, string? EventAt, string? Display, string? HebrewText, bool AfterNightfall,
    string? Headline, string? Subline, string? Location, bool ShowCountdown, string? AutoOpenAt);

/// <summary>מה שהלקוח מקבל ב־/api/config כשנעול. כשפתוח: רק Locked=false</summary>
public record SaveTheDatePublic(
    bool Locked, string? EventAt, string Display, string HebrewText, bool AfterNightfall,
    string Headline, string Subline, string Location, bool ShowCountdown, DateTime ServerNow);
