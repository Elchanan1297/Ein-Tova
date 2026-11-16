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
    /// <summary>הדשבורד המתקדם: המספרים והגרפים בטעינה אחת (מטמון 3 שניות)</summary>
    Task<DashboardFull> GetAdminFullAsync();
    /// <summary>null = עוד לא פורסם</summary>
    Task<DashboardData?> GetPublicAsync();
    /// <summary>true: סוגר את המשחק ומפרסם. false: מבטל את הפרסום</summary>
    Task SetPublishedAsync(bool publish);
}

internal sealed class DashboardService(DashboardRepository repo, ILeaderboardService leaderboard, IMemoryCache cache, DashboardSignal signal) : IDashboardService
{
    const string AdminKey = "dashboard:admin";
    const string PublicKey = "dashboard:public";
    const string FullKey = "dashboard:full";

    public async Task<DashboardData> GetAdminAsync() =>
        (await cache.GetOrCreateAsync(AdminKey, e =>
        {
            e.AbsoluteExpirationRelativeToNow = TimeSpan.FromSeconds(2);
            return repo.GetAsync(includeAll: true);
        }))!;

    public async Task<DashboardFull> GetAdminFullAsync() =>
        (await cache.GetOrCreateAsync(FullKey, async e =>
        {
            e.AbsoluteExpirationRelativeToNow = TimeSpan.FromSeconds(3);
            var data = await repo.GetAsync(includeAll: true);
            return new DashboardFull(data, await repo.GetChartsAsync());
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
        cache.Remove(FullKey);
        signal.Touch();
        leaderboard.Invalidate();
    }
}
