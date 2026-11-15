using EinTova.Business.Leaderboard;
using EinTova.DataAccess.Repositories;
using EinTova.Models.Dashboard;
using Microsoft.Extensions.Caching.Memory;

namespace EinTova.Business.Dashboard;

/// <summary>
/// דשבורדים בזמן אמת. בזמן המשחק רק המנהל רואה אותם; אחרי "סיום המשחק" (פרסום) גם האורחים והמסך הגדול.
/// מטמון קצר: הרבה טלפונים מרעננים, וה־DB מחשב פעם אחת.
/// </summary>
public interface IDashboardService
{
    Task<DashboardData> GetAdminAsync();
    /// <summary>null = עוד לא פורסם</summary>
    Task<DashboardData?> GetPublicAsync();
    /// <summary>true: סוגר את המשחק ומפרסם. false: מבטל את הפרסום</summary>
    Task SetPublishedAsync(bool publish);
}

internal sealed class DashboardService(DashboardRepository repo, ILeaderboardService leaderboard, IMemoryCache cache) : IDashboardService
{
    const string AdminKey = "dashboard:admin";
    const string PublicKey = "dashboard:public";

    public async Task<DashboardData> GetAdminAsync() =>
        (await cache.GetOrCreateAsync(AdminKey, e =>
        {
            e.AbsoluteExpirationRelativeToNow = TimeSpan.FromSeconds(2);
            return repo.GetAsync(includeAll: true);
        }))!;

    public async Task<DashboardData?> GetPublicAsync()
    {
        var data = (await cache.GetOrCreateAsync(PublicKey, e =>
        {
            e.AbsoluteExpirationRelativeToNow = TimeSpan.FromSeconds(4);
            return repo.GetAsync(includeAll: false);
        }))!;
        return data.Summary.Published ? data : null;
    }

    public async Task SetPublishedAsync(bool publish)
    {
        await repo.SetPublishedAsync(publish);
        cache.Remove(AdminKey);
        cache.Remove(PublicKey);
        leaderboard.Invalidate();
    }
}
