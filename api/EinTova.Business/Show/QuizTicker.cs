using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace EinTova.Business.Show;

/// <summary>כל חצי שנייה, רק כשהחידון על המסך: סוף זמן → חשיפה, ובמצב אוטומטי → השאלה הבאה</summary>
internal sealed class QuizTicker(IServiceScopeFactory scopes, ShowState state, ILogger<QuizTicker> log) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stop)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromMilliseconds(500));
        while (await timer.WaitForNextTickAsync(stop))
        {
            if (state.Scene != "quiz" || state.Quiz is null) continue;
            try
            {
                using var scope = scopes.CreateScope();
                await scope.ServiceProvider.GetRequiredService<IShowService>().QuizTickAsync();
            }
            catch (Exception e) when (e is not OperationCanceledException)
            {
                log.LogWarning(e, "Quiz tick failed");
            }
        }
    }
}
