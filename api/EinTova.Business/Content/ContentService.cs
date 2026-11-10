using EinTova.Business.Common;
using EinTova.DataAccess.Repositories;
using EinTova.Models.Admin;
using Microsoft.Extensions.Caching.Memory;

namespace EinTova.Business.Content;

/// <summary>תוכנית הערב, ברכות וקליפי קול. התוכן הציבורי במטמון של 30 שניות, ונמחק מיד כשהמנהל משנה.</summary>
public interface IContentService
{
    Task<List<dynamic>> GetProgramAsync();
    Task<List<dynamic>> GetGreetingsAsync();
    Task<IEnumerable<dynamic>> AdminListAsync(ContentKind kind);
    Task<dynamic> AdminSaveAsync(ContentKind kind, string json);
    Task<dynamic> AdminDeleteAsync(ContentKind kind, int id);
    Task<dynamic> ReorderGreetingsAsync(int[] ids);
}

internal sealed class ContentService(ContentRepository repo, IMemoryCache cache) : IContentService
{
    static readonly TimeSpan PublicCache = TimeSpan.FromSeconds(30);

    public async Task<List<dynamic>> GetProgramAsync() =>
        (await cache.GetOrCreateAsync(CacheKeys.Program, e =>
        {
            e.AbsoluteExpirationRelativeToNow = PublicCache;
            return repo.GetProgramAsync();
        }))!;

    public async Task<List<dynamic>> GetGreetingsAsync() =>
        (await cache.GetOrCreateAsync(CacheKeys.Greetings, e =>
        {
            e.AbsoluteExpirationRelativeToNow = PublicCache;
            return repo.GetGreetingsAsync();
        }))!;

    public Task<IEnumerable<dynamic>> AdminListAsync(ContentKind kind) => repo.AdminListAsync(kind);

    public Task<dynamic> AdminSaveAsync(ContentKind kind, string json)
    {
        Invalidate(kind);
        return repo.AdminSaveAsync(kind, json);
    }

    public Task<dynamic> AdminDeleteAsync(ContentKind kind, int id)
    {
        Invalidate(kind);
        return repo.AdminDeleteAsync(kind, id);
    }

    public Task<dynamic> ReorderGreetingsAsync(int[] ids)
    {
        Invalidate(ContentKind.Greetings);
        return repo.ReorderGreetingsAsync(ids);
    }

    void Invalidate(ContentKind kind)
    {
        // קליפי קול לא במטמון
        if (kind == ContentKind.Greetings) cache.Remove(CacheKeys.Greetings);
        if (kind == ContentKind.Program) cache.Remove(CacheKeys.Program);
    }
}
