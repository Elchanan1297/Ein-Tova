using EinTova.Business.Dashboard;
using EinTova.Business.SaveTheDate;
using EinTova.DataAccess.Repositories;
using EinTova.Models.Auth;
using Microsoft.Extensions.Caching.Memory;

namespace EinTova.Business.Phone;

/// <summary>
/// המשחק בטלפון כשר, דרך שלוחת API בימות המשיח. כל הקשה = בקשה אחת, וימות שולחת בכל בקשה
/// את כל מה שהוקש עד עכשיו בשיחה. לכן לכל שאלה משתנה משלה (a1, a2...), וכך יודעים מה כבר נענה.
/// החוקים (ניסיון אחד, טיימר בשרת, ניקוד) הם אותן פרוצדורות של האפליקציה; בטלפון יש זמן נוסף (IvrExtraSec).
/// </summary>
public interface IPhoneGameService
{
    /// <summary>הפרמטרים שימות שלחה (ApiPhone, ApiCallId, hangup, והמשתנים שהוקשו) → הטקסט להחזיר</summary>
    Task<string> HandleAsync(IReadOnlyDictionary<string, string> p);
}

internal sealed class PhoneGameService(
    AuthRepository auth, GameRepository game, SettingsRepository settings, SaveTheDateGate gate, IMemoryCache cache, DashboardSignal dashboard)
    : IPhoneGameService
{
    const int PhoneTries = 3;
    /// <summary>כמה שניות מחכים להקשה אחרי שההקראה נגמרה (אחר כך שואלים שוב, והשרת סופר את הזמן האמיתי)</summary>
    const int WaitSec = 10;
    const string Thanks = "תודה ולהתראות";

    public async Task<string> HandleAsync(IReadOnlyDictionary<string, string> p)
    {
        if (Get(p, "hangup") == "yes") return "";

        var (guest, ask) = await IdentifyAsync(p);
        if (guest is null) return ask!;
        dashboard.Touch(); // שחקן בטלפון: התחלה, תשובה או סיום

        if (await gate.IsLockedAsync())
            return Yemot.Bye(["המשחק עוד לא נפתח", "נשמח לשמוע אתכם בערב עצמו", Thanks]);

        await game.PhoneJoinAttemptAsync(guest.GuestId);
        var (head, options) = await game.NextQuestionAsync(guest.GuestId);
        string status = head.Status;

        if (status == "NoAttempt")
        {
            if (Get(p, "go") != "1") return await IntroAsync(guest);
            dynamic start = await game.StartAttemptAsync(guest.GuestId);
            string s = start.Status;
            if (s == "Closed") return ClosedBye();
            if (s == "NoQuestions") return Yemot.Bye(["עוד אין שאלות במשחק", Thanks]);
            await game.PhoneJoinAttemptAsync(guest.GuestId);
            (head, options) = await game.NextQuestionAsync(guest.GuestId);
            return AskQuestion(p, Q((object)head), options, ["מתחילים", "בהצלחה"]);
        }
        if (status == "Finished") return Yemot.Bye([$"כבר סיימתם את המשחק", $"עניתם נכון על {head.Score} מתוך {head.Total}", Thanks]);
        if (status == "Closed") return ClosedBye();

        // באמצע המשחק: האם הוקשה תשובה לשאלה הנוכחית?
        int pos = (int)head.Position;
        var before = new List<string>();
        if (CallKey(p) is { } key && cache.TryGetValue(key, out int asked) && asked < pos)
            before.Add("הזמן לשאלה הקודמת נגמר");

        var digit = Get(p, $"a{pos}");
        if (digit is null) return AskQuestion(p, Q((object)head), options, before);

        dynamic result;
        if (int.TryParse(digit, out var d) && d >= 1 && d <= options.Count)
            result = await game.SubmitAnswerAsync(guest.GuestId, (int)options[d - 1].OptionId);
        else
        {
            // לא הוקש כלום: אם הזמן באמת נגמר, ממשיכים; אחרת שואלים שוב
            result = await game.TimeoutAsync(guest.GuestId);
            if ((string)result.Status == "TooEarly")
                return AskQuestion(p, Q((object)head), options, ["לא שמענו הקשה"], repeat: true);
        }
        if ((string)result.Status != "OK")
        {
            (head, options) = await game.NextQuestionAsync(guest.GuestId);
            return (string)head.Status == "InProgress" ? AskQuestion(p, Q((object)head), options, []) : Yemot.Bye([Thanks]);
        }

        List<string> feedback = Feedback(result, options);
        if ((bool)result.IsFinished)
        {
            if (CallKey(p) is { } done) cache.Remove(done);
            return Yemot.Bye([.. feedback, "סיימתם את המשחק",
                $"עניתם נכון על {result.Score} מתוך {result.Total}", "התוצאה נכנסה ללוח של המשפחה", Thanks]);
        }
        (head, options) = await game.NextQuestionAsync(guest.GuestId);
        if ((string)head.Status != "InProgress") return Yemot.Bye([.. feedback, Thanks]);
        return AskQuestion(p, Q((object)head), options, feedback);
    }

    /// <summary>לפי המספר שממנו מתקשרים; אם לא מוכר, מבקשים להקיש את מספר הטלפון של המוזמן (עד 3 פעמים)</summary>
    async Task<(GuestDto? Guest, string? Ask)> IdentifyAsync(IReadOnlyDictionary<string, string> p)
    {
        var caller = Get(p, "ApiPhone");
        if (!string.IsNullOrEmpty(caller) && await auth.LoginByPhoneAsync(caller) is { } byCaller) return (byCaller, null);

        // הניסיון האחרון שהוקש (ph1, ph2, ph3)
        var tries = Enumerable.Range(1, PhoneTries).LastOrDefault(i => Get(p, $"ph{i}") is not null);
        if (tries > 0 && await auth.LoginByPhoneAsync(Get(p, $"ph{tries}")!) is { } typed) return (typed, null);

        if (tries >= PhoneTries)
            return (null, Yemot.Bye(["המספר לא נמצא ברשימת המוזמנים", "אפשר לפנות למשפחה", Thanks]));
        string[] text = tries == 0
            ? ["שלום", "ברוכים הבאים למשחק של אבא", "לא זיהינו את המספר שממנו התקשרתם",
               "הקישו את מספר הטלפון שלכם, כמו שמסרתם למשפחה, ובסופו סולמית"]
            : ["המספר לא נמצא ברשימה", "נסו שוב", "הקישו את מספר הטלפון ובסופו סולמית"];
        return (null, Yemot.Read(text, $"ph{tries + 1}", min: 9, max: 10, wait: 15, digits: "0123456789"));
    }

    async Task<string> IntroAsync(GuestDto guest)
    {
        dynamic c = await settings.GetPublicConfigAsync();
        if (!(bool)c.IsOpen) return ClosedBye();
        var first = guest.FullName.Split(' ', StringSplitOptions.RemoveEmptyEntries).FirstOrDefault() ?? "";
        return Yemot.Read([
            $"שלום {first}",
            $"ברוכים הבאים למשחק, {c.FactsLabelCount} דברים שלא ידעתם על אבא",
            $"במשחק {c.QuestionCount} שאלות",
            "אחרי כל שאלה תשמעו את התשובות, והקישו את מספר התשובה הנכונה",
            "אפשר להקיש כבר באמצע ההקראה",
            "כדי להתחיל, הקישו 1",
        ], "go", min: 1, max: 1, wait: 15, digits: "1");
    }

    record struct Question(int Position, int Total, string Body);
    static Question Q(object o) { dynamic h = o; return new((int)h.Position, (int)h.Total, (string)h.Body); }

    string AskQuestion(IReadOnlyDictionary<string, string> p, Question q, List<dynamic> options, List<string> before, bool repeat = false)
    {
        var pos = q.Position;
        if (CallKey(p) is { } key) cache.Set(key, pos, TimeSpan.FromHours(1));
        var parts = new List<string>(before);
        if (!repeat)
        {
            parts.Add($"שאלה {pos} מתוך {q.Total}");
            parts.Add(q.Body);
        }
        for (var i = 0; i < options.Count; i++) parts.Add($"{i + 1}, {options[i].Body}");
        parts.Add("הקישו את מספר התשובה");
        var digits = string.Concat(Enumerable.Range(1, options.Count));
        return Yemot.Read(parts, $"a{pos}", min: 1, max: 1, wait: WaitSec, digits: digits);
    }

    static List<string> Feedback(dynamic r, List<dynamic> options)
    {
        var parts = new List<string>();
        if ((bool)r.IsCorrect) parts.Add("נכון");
        else
        {
            parts.Add((bool)r.TimedOut ? "הזמן נגמר" : "לא נכון");
            int? correctId = r.CorrectOptionId;
            var correct = options.FirstOrDefault(o => (int)o.OptionId == correctId);
            if (correct is not null) parts.Add($"התשובה הנכונה, {correct.Body}");
        }
        string? fact = r.Fact;
        if (!string.IsNullOrWhiteSpace(fact)) parts.Add($"ידעתם, {fact}");
        return parts;
    }

    static string ClosedBye() => Yemot.Bye(["המשחק סגור כרגע", "נסו שוב מאוחר יותר", Thanks]);

    static string? CallKey(IReadOnlyDictionary<string, string> p) => Get(p, "ApiCallId") is { } id ? $"ivr:{id}" : null;

    static string? Get(IReadOnlyDictionary<string, string> p, string key) =>
        p.TryGetValue(key, out var v) && !string.IsNullOrWhiteSpace(v) ? v.Trim() : null;
}
