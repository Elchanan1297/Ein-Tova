using System.Text.Encodings.Web;
using System.Text.Json;
using EinTova.DataAccess.Repositories;
using EinTova.Models.Admin;
using EinTova.Models.SaveTheDate;

namespace EinTova.Business.SaveTheDate;

public interface ISaveTheDateService
{
    /// <summary>ל־/api/config: כשפתוח רק Locked=false, כשנעול כל מה שהמסך צריך</summary>
    Task<object> GetPublicAsync();
    /// <summary>לניהול: כל ההגדרות, ישר מה־DB</summary>
    Task<SaveTheDateSettings> GetAsync();
    Task<SaveResult> SaveAsync(SaveTheDateRequest req);
}

internal sealed class SaveTheDateService(SaveTheDateRepository repo, SaveTheDateGate gate) : ISaveTheDateService
{
    public static readonly string[] Displays = ["gregorian", "hebrew", "both"];
    const int MaxText = 120;
    // עברית קריאה ב־AdminAudit (ולא א...)
    static readonly JsonSerializerOptions Json = new() { Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping };

    public async Task<object> GetPublicAsync()
    {
        var s = await gate.GetAsync();
        if (s is not { Locked: true }) return new { locked = false };
        return new SaveTheDatePublic(true, s.EventAt, s.Display, s.HebrewText ?? "", s.AfterNightfall,
            s.Headline, s.Subline ?? "", s.Location ?? "", s.ShowCountdown, DateTime.UtcNow);
    }

    public Task<SaveTheDateSettings> GetAsync() => repo.GetAsync();

    public async Task<SaveResult> SaveAsync(SaveTheDateRequest r)
    {
        // בדיקה ראשונה כאן (הודעה ברורה), והפרוצדורה בודקת שוב
        if (r.Display is not null && !Displays.Contains(r.Display)) return new("BadValue", "display");
        if (!ValidDate(r.EventAt)) return new("BadValue", "eventAt");
        if (!ValidDate(r.AutoOpenAt)) return new("BadValue", "autoOpenAt");
        if (r.Enabled && string.IsNullOrWhiteSpace(r.EventAt)) return new("BadValue", "eventAt");
        foreach (var (name, v) in new[] { ("hebrewText", r.HebrewText), ("headline", r.Headline), ("subline", r.Subline), ("location", r.Location) })
            if (v?.Trim().Length > MaxText) return new("BadValue", name);

        var json = JsonSerializer.Serialize(new Dictionary<string, string?>
        {
            ["Enabled"] = Bit(r.Enabled),
            ["EventAt"] = r.EventAt,
            ["Display"] = r.Display ?? "both",
            ["HebrewText"] = r.HebrewText,
            ["AfterNightfall"] = Bit(r.AfterNightfall),
            ["Headline"] = string.IsNullOrWhiteSpace(r.Headline) ? "Save the date" : r.Headline,
            ["Subline"] = r.Subline,
            ["Location"] = r.Location,
            ["ShowCountdown"] = Bit(r.ShowCountdown),
            ["AutoOpenAt"] = r.AutoOpenAt,
        }, Json);
        var res = await repo.SaveAsync(json);
        gate.Invalidate();
        await gate.GetAsync(); // מרענן מיד, ואם המצב השתנה הלקוחות מקבלים הודעה עכשיו
        return res.Status == "OK" ? res : res with { Field = res.Field is null ? null : char.ToLowerInvariant(res.Field[0]) + res.Field[1..] };
    }

    static bool ValidDate(string? v) => string.IsNullOrWhiteSpace(v) || DateTimeOffset.TryParse(v, out _);
    static string Bit(bool b) => b ? "1" : "0";
}
