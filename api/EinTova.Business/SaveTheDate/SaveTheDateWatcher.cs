using Microsoft.Extensions.Hosting;

namespace EinTova.Business.SaveTheDate;

/// <summary>
/// כל 5 שניות מרענן את המצב. כך גם פתיחה אוטומטית (AutoOpenAt) או שינוי ישיר ב־DB
/// נשלחים ללקוחות, גם כשאף אחד לא שולח בקשות.
/// </summary>
internal sealed class SaveTheDateWatcher(SaveTheDateGate gate) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stop)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(5));
        do
        {
            gate.Invalidate(); // קריאה טרייה מה־DB, כך שפתיחה אוטומטית נקלטת תוך 5 שניות לכל היותר
            await gate.GetAsync();
        }
        while (await timer.WaitForNextTickAsync(stop));
    }
}
