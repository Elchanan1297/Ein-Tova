using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace EinTova.Business.Dashboard;

/// <summary>שליחת "הדשבורד השתנה" למסכי הניהול (בלי מטען; הלקוח מושך מחדש). ממומש ב־Api (SignalR)</summary>
public interface IDashboardNotifier
{
    Task ChangedAsync(CancellationToken ct = default);
}

/// <summary>
/// סימון שמשהו השתנה (תשובה, התחלה, סיום, פרסום). לא שולחים על כל תשובה:
/// הדופק שולח לכל היותר פעם בשנייה וחצי, וגם זה רק אם היה שינוי.
/// </summary>
public sealed class DashboardSignal
{
    int dirty;
    public void Touch() => Interlocked.Exchange(ref dirty, 1);
    internal bool TakeDirty() => Interlocked.Exchange(ref dirty, 0) == 1;
}

internal sealed class DashboardPulse(DashboardSignal signal, IDashboardNotifier notifier, ILogger<DashboardPulse> log) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stop)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromMilliseconds(1500));
        while (await timer.WaitForNextTickAsync(stop))
        {
            if (!signal.TakeDirty()) continue;
            try { await notifier.ChangedAsync(stop); }
            catch (Exception e) when (e is not OperationCanceledException) { log.LogWarning(e, "Dashboard push failed"); }
        }
    }
}
