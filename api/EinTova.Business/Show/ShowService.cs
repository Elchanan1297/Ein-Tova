using EinTova.Business.Leaderboard;
using EinTova.DataAccess.Repositories;
using EinTova.Models.Show;

namespace EinTova.Business.Show;

/// <summary>
/// מצגת למסך הגדול: המנהל בוחר מה מוצג, והמסך מקבל את זה מיד.
/// כולל החידון על המסך (למי שאין סמארטפון): אותן שאלות, תשובות וזמנים כמו במשחק, בלי ניקוד.
/// </summary>
public interface IShowService
{
    object Snapshot();
    /// <summary>null = סצנה לא מוכרת (זוכה רק דרך AnnounceWinnerAsync), או חידון בלי שאלות</summary>
    Task<object?> SetSceneAsync(string scene);
    /// <summary>null = אין עדיין ציונים</summary>
    Task<object?> AnnounceWinnerAsync();

    /// <summary>החידון מההתחלה (שאלות טריות מה־DB). null = אין שאלות פעילות</summary>
    Task<object?> QuizStartAsync();
    Task<object?> QuizNextAsync();
    Task<object?> QuizPrevAsync();
    /// <summary>חשיפת התשובה עכשיו, בלי לחכות לסוף הזמן</summary>
    Task<object?> QuizRevealAsync();
    Task<object?> QuizAutoAsync(bool on);
    /// <summary>נקרא מהטיימר ברקע: סוף זמן → חשיפה; במצב אוטומטי, אחרי החשיפה → השאלה הבאה</summary>
    Task QuizTickAsync();
}

internal sealed class ShowService(ShowState state, ILeaderboardService leaderboard, IShowNotifier notifier, ShowRepository repo)
    : IShowService
{
    public object Snapshot() => state.Snapshot();

    public async Task<object?> SetSceneAsync(string scene)
    {
        if (!Scenes.All.Contains(scene) || scene == Scenes.Winner) return null;
        if (scene == Scenes.Quiz)
        {
            // חזרה לחידון: ממשיכים מאותה שאלה (עם טיימר חדש), או מתחילים אם עוד לא התחיל
            return await Quiz(run => run is null ? null : run.Phase == QuizRun.Asking ? run.Ask(run.Index, DateTime.UtcNow) : run,
                startIfEmpty: true);
        }
        state.Set(scene, null);
        await notifier.StateAsync(state.Snapshot());
        return state.Snapshot();
    }

    /// <summary>הכרזת זוכה: המשפחה (או המשפחות, בשוויון) במקום הראשון, לפי הדירוג שנקבע בהגדרות</summary>
    public async Task<object?> AnnounceWinnerAsync()
    {
        var board = await leaderboard.GetAsync(fresh: true);
        var first = board.Families.Where(f => f.Rnk == 1 && f.Finished > 0).ToList();
        if (first.Count == 0) return null;
        state.Set(Scenes.Winner, new { families = first.Select(f => new { f.Name, f.DisplayScore, f.Finished }), rankBy = first[0].RankBy });
        await notifier.StateAsync(state.Snapshot());
        return state.Snapshot();
    }

    public async Task<object?> QuizStartAsync()
    {
        await state.QuizGate.WaitAsync();
        try
        {
            var run = await NewRun(state.Quiz?.Auto ?? false);
            if (run is null) return null;
            return await Publish(run, showScene: true);
        }
        finally { state.QuizGate.Release(); }
    }

    public Task<object?> QuizNextAsync() => Quiz(run => run?.Next(DateTime.UtcNow), startIfEmpty: true);

    public Task<object?> QuizPrevAsync() =>
        Quiz(run => run is null ? null : run.Ask(Math.Max(0, run.Phase == QuizRun.Done ? run.Questions.Count - 1 : run.Index - 1), DateTime.UtcNow),
            startIfEmpty: true);

    public async Task<object?> QuizRevealAsync()
    {
        await state.QuizGate.WaitAsync();
        try
        {
            var run = state.Quiz;
            if (run is null) return null;
            if (run.Phase != QuizRun.Asking) return state.Snapshot();
            return await Publish(await Reveal(run), showScene: true);
        }
        finally { state.QuizGate.Release(); }
    }

    public Task<object?> QuizAutoAsync(bool on) =>
        // מעבר לאוטומטי כשהתשובה כבר מוצגת: סופרים את זמן החשיפה מעכשיו
        Quiz(run => run is null ? null : run with { Auto = on, PhaseAt = run.Phase == QuizRun.Revealed && on ? DateTime.UtcNow : run.PhaseAt },
            startIfEmpty: false, showScene: false);

    public async Task QuizTickAsync()
    {
        if (state.Scene != Scenes.Quiz || state.Quiz is not { } peek) return;
        var now = DateTime.UtcNow;
        if (!peek.TimeUp(now) && !peek.AutoNextDue(now)) return;

        await state.QuizGate.WaitAsync();
        try
        {
            var run = state.Quiz;
            if (run is null || state.Scene != Scenes.Quiz) return;
            if (run.TimeUp(now)) await Publish(await Reveal(run), showScene: false);
            else if (run.AutoNextDue(now)) await Publish(run.Next(now), showScene: false);
        }
        finally { state.QuizGate.Release(); }
    }

    /// <summary>צעד בחידון תחת נעילה. startIfEmpty: אם עוד אין חידון, מתחילים אחד</summary>
    async Task<object?> Quiz(Func<QuizRun?, QuizRun?> step, bool startIfEmpty, bool showScene = true)
    {
        await state.QuizGate.WaitAsync();
        try
        {
            var current = state.Quiz;
            if (current is null && startIfEmpty)
            {
                var fresh = await NewRun(auto: false);
                return fresh is null ? null : await Publish(fresh, showScene: true);
            }
            var next = step(current);
            if (next is null) return current is null ? null : state.Snapshot();
            return await Publish(next, showScene);
        }
        finally { state.QuizGate.Release(); }
    }

    async Task<QuizRun?> NewRun(bool auto)
    {
        var questions = await repo.GetQuizAsync();
        if (questions.Count == 0) return null;
        // בטלפון סדר התשובות אקראי לכל שחקן; כאן מערבבים פעם אחת לכל חידון (כדי שהנכונה לא תהיה תמיד א׳)
        var shuffled = questions.Select(q => q with { Options = q.Options.OrderBy(_ => Random.Shared.Next()).ToList() }).ToList();
        return new QuizRun(shuffled, 0, QuizRun.Asking, DateTime.UtcNow, auto, null);
    }

    async Task<QuizRun> Reveal(QuizRun run)
    {
        ShowQuizStats? stats = null;
        try { stats = await repo.GetStatsAsync(run.Current!.QuestionId); }
        catch { /* בלי סטטיסטיקה החשיפה עדיין עובדת */ }
        return run with { Phase = QuizRun.Revealed, PhaseAt = DateTime.UtcNow, Stats = stats };
    }

    async Task<object> Publish(QuizRun run, bool showScene)
    {
        state.SetQuiz(run, showScene);
        var snap = state.Snapshot();
        await notifier.StateAsync(snap);
        return snap;
    }
}
