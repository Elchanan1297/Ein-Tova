using System.Text;
using System.Text.RegularExpressions;

namespace EinTova.Business.Phone;

/// <summary>
/// תשובות בפורמט של שלוחת API בימות המשיח (טקסט פשוט):
/// read=t-טקסט.t-טקסט=שם_משתנה,... מקריא ומחכה להקשה; id_list_message=...&amp;go_to_folder=hangup מקריא ומנתק.
/// הנקודה מפרידה בין קטעים, ולכן מנקים מהטקסט נקודות, מקפים, = ו־&amp;.
/// </summary>
internal static partial class Yemot
{
    /// <summary>הקראה ואז הקשה אחת או יותר. digits: המקשים המותרים (ריק = הכול). wait: שניות להמתנה אחרי ההקראה</summary>
    public static string Read(IEnumerable<string> parts, string variable, int min, int max, int wait, string digits = "")
    {
        // שם,להשתמש בקיים,מקסימום,מינימום,המתנה,השמעת ההקשה,חסימת כוכבית,חסימת אפס,החלפת תו,מקשים מותרים,ניסיונות,לאפשר ריק,ערך לריק
        var spec = $"{variable},no,{max},{min},{wait},No,yes,no,,{digits},1,Ok,none";
        return $"read={Message(parts)}={spec}";
    }

    /// <summary>הקראה וניתוק</summary>
    public static string Bye(IEnumerable<string> parts) => $"id_list_message={Message(parts)}&go_to_folder=hangup";

    static string Message(IEnumerable<string> parts)
    {
        var sb = new StringBuilder();
        foreach (var raw in parts)
        {
            var t = Clean(raw);
            if (t.Length == 0) continue;
            if (sb.Length > 0) sb.Append('.');
            sb.Append("t-").Append(t);
        }
        return sb.ToString();
    }

    /// <summary>טקסט להקראה: בלי תווים ששוברים את הפורמט (נקודה, מקף, =, &amp;) ובלי גרשיים</summary>
    public static string Clean(string? text)
    {
        if (string.IsNullOrWhiteSpace(text)) return "";
        var t = Breakers().Replace(text, ",");
        t = Quotes().Replace(t, "");
        t = CommaRuns().Replace(t, ", ");
        t = Spaces().Replace(t, " ").Trim(' ', ',');
        return t;
    }

    [GeneratedRegex(@"[.\-=&?!:;\r\n–—]")]
    private static partial Regex Breakers();
    [GeneratedRegex("[\"'`״׳]")]
    private static partial Regex Quotes();
    [GeneratedRegex(@"\s*,[\s,]*")]
    private static partial Regex CommaRuns();
    [GeneratedRegex(@"\s+")]
    private static partial Regex Spaces();
}
