using EinTova.Models.Leaderboard;

namespace EinTova.Business.Show;

/// <summary>
/// שליחה למסכי המצגת. המימוש ב־Api (SignalR), כך ששכבת ה־Business לא תלויה ב־HTTP.
/// </summary>
public interface IShowNotifier
{
    Task StateAsync(object snapshot, CancellationToken ct = default);
    Task LeaderboardAsync(LeaderboardData board, CancellationToken ct = default);
    Task PhotoPublishedAsync(IReadOnlyList<Guid> publicIds, CancellationToken ct = default);
}
