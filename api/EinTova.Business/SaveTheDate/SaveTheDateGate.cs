using EinTova.DataAccess.Repositories;
using EinTova.Models.SaveTheDate;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace EinTova.Business.SaveTheDate;

/// <summary>
/// מצב הנעילה לכל בקשה, בלי שאילתה לכל בקשה: מטמון בזיכרון של עד 5 שניות.
/// שמירה בניהול מנקה אותו מיד. כל שינוי במצב (מתג או פתיחה אוטומטית) נשלח ללקוחות.
/// </summary>
public sealed class SaveTheDateGate(IServiceScopeFactory scopes, ILockNotifier notifier, ILogger<SaveTheDateGate> log)
{
    static readonly TimeSpan Ttl = TimeSpan.FromSeconds(5);
    readonly SemaphoreSlim refresh = new(1, 1);
    SaveTheDateSettings? current;
    DateTime loadedAt;

    public async Task<bool> IsLockedAsync() => (await GetAsync())?.Locked ?? false;

    /// <summary>ההגדרות מהמטמון. null רק אם ה־DB לא ענה אף פעם (ואז לא נועלים)</summary>
    public async Task<SaveTheDateSettings?> GetAsync()
    {
        if (current is not null && DateTime.UtcNow - loadedAt < Ttl) return current;
        await refresh.WaitAsync();
        try
        {
            if (current is not null && DateTime.UtcNow - loadedAt < Ttl) return current;
            using var scope = scopes.CreateScope();
            var fresh = await scope.ServiceProvider.GetRequiredService<SaveTheDateRepository>().GetAsync();
            var changed = current is not null && current.Locked != fresh.Locked;
            (current, loadedAt) = (fresh, DateTime.UtcNow);
            if (changed) await Notify(fresh.Locked);
        }
        catch (Exception e)
        {
            // ה־DB לא עונה: נשארים עם המצב האחרון הידוע (ומנסים שוב בבקשה הבאה)
            log.LogWarning(e, "Save the date refresh failed");
        }
        finally
        {
            refresh.Release();
        }
        return current;
    }

    /// <summary>אחרי שמירה: הבקשה הבאה קוראת מה־DB</summary>
    public void Invalidate() => loadedAt = DateTime.MinValue;

    async Task Notify(bool locked)
    {
        try { await notifier.LockChangedAsync(locked); }
        catch (Exception e) { log.LogWarning(e, "LockChanged broadcast failed"); }
    }
}
