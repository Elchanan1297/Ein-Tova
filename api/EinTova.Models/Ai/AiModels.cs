namespace EinTova.Models.Ai;

/// <summary>מצב כל קריאה: OK | Disabled | NoData | Busy (מכסה, "בעוד רגע") | Limit (תקרה) | Unavailable</summary>
public static class AiStatus
{
    public const string Ok = "OK", Disabled = "Disabled", NoData = "NoData", Busy = "Busy", Limit = "Limit", Unavailable = "Unavailable";
}

/// <summary>תובנה אחרי ולידציה: הראיות הן טקסטים שנבנו בשרת מהנתונים האמיתיים (לא מה־AI)</summary>
public sealed record Insight(string Id, string Icon, string Title, string Body, string Severity, IReadOnlyList<string> Evidence);

public sealed record InsightsResponse(string Status, IReadOnlyList<Insight> Insights, DateTime? CreatedAt, string? Model, bool Cached, int Players);

public sealed record AskResponse(string Status, string? Answer, IReadOnlyList<string> Evidence);

public sealed record BlessingResponse(string Status, string? Text);

public sealed record AiStatusResponse(bool Enabled, bool Configured, bool PublishToViewers, int CallsLastHour, int MaxCallsPerHour, int QuestionsLeft);

public sealed record InsightsRequest(bool Refresh);
public sealed record AskRequest(string? Question);
/// <summary>התובנות שהמנהל אישר להציג (עד 3), בדיוק כמו שהוצגו לו</summary>
public sealed record PublishInsightsRequest(IReadOnlyList<Insight>? Insights);
