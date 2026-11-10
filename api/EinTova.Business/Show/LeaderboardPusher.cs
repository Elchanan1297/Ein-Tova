using System.Text.Json;
using EinTova.Business.Leaderboard;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace EinTova.Business.Show;

/// <summary>כל 3 שניות: אם מסך מחובר והלוח השתנה, שולחים אותו</summary>
internal sealed class LeaderboardPusher(IServiceScopeFactory scopes, ShowState state, IShowNotifier notifier, ILogger<LeaderboardPusher> log)
    : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stop)
    {
        string? last = null;
        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(3));
        while (await timer.WaitForNextTickAsync(stop))
        {
            if (state.ConnectedScreens == 0) { last = null; continue; }
            try
            {
                using var scope = scopes.CreateScope();
                var board = await scope.ServiceProvider.GetRequiredService<ILeaderboardService>().GetAsync();
                var json = JsonSerializer.Serialize(board);
                if (json == last) continue;
                last = json;
                await notifier.LeaderboardAsync(board, stop);
            }
            catch (Exception e) when (e is not OperationCanceledException)
            {
                log.LogWarning(e, "Leaderboard push failed");
            }
        }
    }
}
