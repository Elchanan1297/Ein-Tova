using EinTova.Business.Common;
using EinTova.DataAccess.Repositories;
using EinTova.Models.Leaderboard;
using Microsoft.Extensions.Caching.Memory;

namespace EinTova.Business.Leaderboard;

public interface ILeaderboardService
{
    /// <summary>לוח התוצאות עם מטמון של 3 שניות (כל הטלפונים באולם + המסך)</summary>
    Task<LeaderboardData> GetAsync(bool fresh = false);
    /// <summary>אחרי שינוי שמשפיע על הלוח (הגדרות, משפחות, איפוס)</summary>
    void Invalidate();
}

internal sealed class LeaderboardService(GameRepository repo, IMemoryCache cache) : ILeaderboardService
{
    public async Task<LeaderboardData> GetAsync(bool fresh = false)
    {
        if (fresh) Invalidate();
        return (await cache.GetOrCreateAsync(CacheKeys.Leaderboard, e =>
        {
            e.AbsoluteExpirationRelativeToNow = TimeSpan.FromSeconds(3);
            return repo.GetLeaderboardAsync();
        }))!;
    }

    public void Invalidate() => cache.Remove(CacheKeys.Leaderboard);
}
