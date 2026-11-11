using EinTova.Models.Show;

namespace EinTova.Business.Show;

/// <summary>
/// החידון על המסך הגדול: איפה עומדים (שאלה, שלב, אוטומטי). לא משנה, כל צעד יוצר מצב חדש.
/// שלבים: question (השאלה והטיימר) → reveal (התשובה הנכונה, "ידעתם?" וכמה צדקו בטלפון) → done (סוף).
/// </summary>
public sealed record QuizRun(IReadOnlyList<ShowQuizQuestion> Questions, int Index, string Phase, DateTime PhaseAt, bool Auto, ShowQuizStats? Stats)
{
    public const string Asking = "question", Revealed = "reveal", Done = "done";
    /// <summary>במצב אוטומטי: כמה זמן התשובה וה"ידעתם?" נשארים לפני השאלה הבאה</summary>
    public static readonly TimeSpan RevealTime = TimeSpan.FromSeconds(12);
    /// <summary>מרווח קטן אחרי סוף הזמן לפני החשיפה</summary>
    static readonly TimeSpan Grace = TimeSpan.FromSeconds(1);

    public ShowQuizQuestion? Current => Phase == Done ? null : Questions[Index];
    public DateTime? EndsAt => Phase == Asking ? PhaseAt.AddSeconds(Current!.TimeLimitSec) : null;
    public DateTime? NextAt => Phase == Revealed && Auto ? PhaseAt + RevealTime : null;

    public bool TimeUp(DateTime now) => Phase == Asking && now >= EndsAt!.Value + Grace;
    public bool AutoNextDue(DateTime now) => NextAt is { } at && now >= at;

    public QuizRun Ask(int index, DateTime now) => this with { Index = index, Phase = Asking, PhaseAt = now, Stats = null };
    public QuizRun Next(DateTime now) => Index + 1 < Questions.Count ? Ask(Index + 1, now) : this with { Phase = Done, PhaseAt = now, Stats = null };

    /// <summary>מה שהמסך והשלט מקבלים. התשובה הנכונה והעובדה רק אחרי החשיפה</summary>
    public object ToPayload()
    {
        var q = Current;
        var revealed = Phase == Revealed;
        return new
        {
            index = Index + 1,
            total = Questions.Count,
            phase = Phase,
            auto = Auto,
            phaseAt = PhaseAt,
            endsAt = EndsAt,
            nextAt = NextAt,
            serverNow = DateTime.UtcNow,
            question = q is null ? null : new
            {
                body = q.Body,
                imageUrl = q.ImageUrl,
                timeLimitSec = q.TimeLimitSec,
                fact = revealed ? q.Fact : null,
                options = q.Options.Select(o => new { id = o.OptionId, body = o.Body, correct = revealed ? o.IsCorrect : (bool?)null }),
            },
            stats = revealed ? Stats : null,
        };
    }
}
