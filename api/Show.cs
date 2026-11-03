using System.Data;
using System.Text.Json;
using Dapper;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Caching.Memory;

/// <summary>
/// מצגת למסך הגדול: המנהל בוחר מה מוצג (מהטלפון או מהמחשב), והמסך מקבל את זה מיד ב־SignalR.
/// לוח התוצאות נדחף למסך רק כשהוא משתנה.
/// </summary>
static class Show
{
    public static readonly string[] Scenes = { "welcome", "leaderboard", "greetings", "winner" };

    public static void MapShow(this WebApplication app)
    {
        app.MapHub<ShowHub>("/hubs/show");

        var show = app.MapGroup("/api/admin/show").RequireAuthorization("admin");

        show.MapGet("", (ShowState state) => Results.Ok(state.Snapshot()));

        show.MapPost("/scene", async (SceneReq r, ShowState state, IHubContext<ShowHub> hub) =>
        {
            if (!Scenes.Contains(r.Scene) || r.Scene == "winner") return Results.BadRequest(new { status = "BadValue" });
            state.Set(r.Scene, null);
            await hub.Clients.All.SendAsync("state", state.Snapshot());
            return Results.Ok(state.Snapshot());
        });

        // הכרזת זוכה: המשפחה (או המשפחות, בשוויון) במקום הראשון, לפי הדירוג שנקבע בהגדרות
        show.MapPost("/winner", async (SqlConnection db, IMemoryCache cache, ShowState state, IHubContext<ShowHub> hub) =>
        {
            var board = await Leaderboard.Get(db, cache, fresh: true);
            var first = board.Families.Where(f => f.Rnk == 1 && f.Finished > 0).ToList();
            if (first.Count == 0) return Results.BadRequest(new { status = "NoScores" });
            state.Set("winner", new { families = first.Select(f => new { f.Name, f.DisplayScore, f.Finished }), rankBy = first[0].RankBy });
            await hub.Clients.All.SendAsync("state", state.Snapshot());
            return Results.Ok(state.Snapshot());
        });
    }
}

record SceneReq(string Scene);

/// <summary>מה מוצג כרגע במסך הגדול (בזיכרון: שרת אחד)</summary>
class ShowState
{
    readonly object gate = new();
    string scene = "welcome";
    object? winner;
    DateTime changedAt = DateTime.UtcNow;

    public void Set(string newScene, object? newWinner)
    {
        lock (gate) { scene = newScene; winner = newWinner; changedAt = DateTime.UtcNow; }
    }

    public object Snapshot()
    {
        lock (gate) return new { scene, winner, changedAt };
    }
}

[Authorize(Policy = "admin")]
class ShowHub(ShowState state, SqlConnection db, IMemoryCache cache) : Hub
{
    public static int Connected;

    public override async Task OnConnectedAsync()
    {
        Interlocked.Increment(ref Connected);
        await Clients.Caller.SendAsync("state", state.Snapshot());
        await Clients.Caller.SendAsync("leaderboard", await Leaderboard.Get(db, cache));
        await base.OnConnectedAsync();
    }

    public override Task OnDisconnectedAsync(Exception? e)
    {
        Interlocked.Decrement(ref Connected);
        return base.OnDisconnectedAsync(e);
    }
}

/// <summary>כל 3 שניות: אם מסך מחובר והלוח השתנה, שולחים אותו</summary>
class LeaderboardPusher(IServiceScopeFactory scopes, IHubContext<ShowHub> hub, ILogger<LeaderboardPusher> log) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stop)
    {
        string? last = null;
        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(3));
        while (await timer.WaitForNextTickAsync(stop))
        {
            if (Volatile.Read(ref ShowHub.Connected) == 0) { last = null; continue; }
            try
            {
                using var scope = scopes.CreateScope();
                var board = await Leaderboard.Get(scope.ServiceProvider.GetRequiredService<SqlConnection>(),
                    scope.ServiceProvider.GetRequiredService<IMemoryCache>());
                var json = JsonSerializer.Serialize(board);
                if (json == last) continue;
                last = json;
                await hub.Clients.All.SendAsync("leaderboard", board, stop);
            }
            catch (Exception e) when (e is not OperationCanceledException)
            {
                log.LogWarning(e, "Leaderboard push failed");
            }
        }
    }
}

class FamilyScore
{
    public long Rnk { get; init; }
    public int FamilyId { get; init; }
    public string Name { get; init; } = "";
    public int TotalScore { get; init; }
    public int Players { get; init; }
    public int Finished { get; init; }
    public decimal AvgScore { get; init; }
    public decimal DisplayScore { get; init; }
    public string RankBy { get; init; } = "Total";
}

class TopPlayer
{
    public string FullName { get; init; } = "";
    public string FamilyName { get; init; } = "";
    public int Score { get; init; }
    public int Total { get; init; }
}

record LeaderboardData(List<FamilyScore> Families, List<TopPlayer> Top);

static class Leaderboard
{
    /// <summary>לוח התוצאות עם מטמון של 3 שניות (כל הטלפונים + המסך)</summary>
    public static async Task<LeaderboardData> Get(SqlConnection db, IMemoryCache cache, bool fresh = false)
    {
        if (fresh) cache.Remove("leaderboard");
        return (await cache.GetOrCreateAsync("leaderboard", async e =>
        {
            e.AbsoluteExpirationRelativeToNow = TimeSpan.FromSeconds(3);
            using var m = await db.QueryMultipleAsync("usp_GetLeaderboard", commandType: CommandType.StoredProcedure);
            var families = (await m.ReadAsync<FamilyScore>()).ToList();
            var top = (await m.ReadAsync<TopPlayer>()).ToList();
            return new LeaderboardData(families, top);
        }))!;
    }
}
