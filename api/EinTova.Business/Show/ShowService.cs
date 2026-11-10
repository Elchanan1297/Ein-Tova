using EinTova.Business.Leaderboard;
using EinTova.Models.Show;

namespace EinTova.Business.Show;

/// <summary>
/// מצגת למסך הגדול: המנהל בוחר מה מוצג, והמסך מקבל את זה מיד.
/// </summary>
public interface IShowService
{
    object Snapshot();
    /// <summary>null = סצנה לא מוכרת (זוכה רק דרך AnnounceWinnerAsync)</summary>
    Task<object?> SetSceneAsync(string scene);
    /// <summary>null = אין עדיין ציונים</summary>
    Task<object?> AnnounceWinnerAsync();
}

internal sealed class ShowService(ShowState state, ILeaderboardService leaderboard, IShowNotifier notifier) : IShowService
{
    public object Snapshot() => state.Snapshot();

    public async Task<object?> SetSceneAsync(string scene)
    {
        if (!Scenes.All.Contains(scene) || scene == Scenes.Winner) return null;
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
}
