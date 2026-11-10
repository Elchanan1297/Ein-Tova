using System.Text.Json;
using EinTova.Business.Leaderboard;
using EinTova.DataAccess.Repositories;
using EinTova.Models.Admin;

namespace EinTova.Business.Admin;

public interface ISettingsService
{
    Task<dynamic> GetPublicConfigAsync();
    Task<Dictionary<string, string?>> GetAllAsync();
    /// <summary>המפתחות ב־camelCase (כמו ב־GET). Field בשגיאה חוזר גם הוא ב־camelCase.</summary>
    Task<SaveResult> SaveAsync(Dictionary<string, string?> values);
    Task<object> GameStatsAsync();
    Task<dynamic> ResetAllAttemptsAsync();
}

internal sealed class SettingsService(SettingsRepository repo, ILeaderboardService leaderboard) : ISettingsService
{
    public Task<dynamic> GetPublicConfigAsync() => repo.GetPublicConfigAsync();

    public Task<Dictionary<string, string?>> GetAllAsync() => repo.GetAllAsync();

    public async Task<SaveResult> SaveAsync(Dictionary<string, string?> values)
    {
        // ב־DB המפתחות ב־PascalCase
        var json = JsonSerializer.Serialize(values.ToDictionary(kv => Pascal(kv.Key), kv => kv.Value));
        var res = await repo.SaveAsync(json);
        if (res.Status != "OK") return res with { Field = res.Field is null ? null : Camel(res.Field) };
        leaderboard.Invalidate(); // LeaderboardRank משפיע מיד
        return res;
    }

    public async Task<object> GameStatsAsync()
    {
        var (summary, questions) = await repo.GameStatsAsync();
        return new { summary, questions };
    }

    /// <summary>איפוס המשחק לכולם: כל אחד יכול לשחק שוב</summary>
    public async Task<dynamic> ResetAllAttemptsAsync()
    {
        var res = await repo.ResetAllAttemptsAsync();
        leaderboard.Invalidate();
        return res;
    }

    static string Pascal(string s) => char.ToUpperInvariant(s[0]) + s[1..];
    static string Camel(string s) => char.ToLowerInvariant(s[0]) + s[1..];
}
