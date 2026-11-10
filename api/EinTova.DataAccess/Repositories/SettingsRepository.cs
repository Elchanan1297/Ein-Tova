using Dapper;
using EinTova.Models.Admin;
using Microsoft.Data.SqlClient;

namespace EinTova.DataAccess.Repositories;

/// <summary>הגדרות ציבוריות וניהול: הגדרות, סטטיסטיקה, איפוס</summary>
internal sealed class SettingsRepository(SqlConnection db) : RepositoryBase(db)
{
    public Task<dynamic> GetPublicConfigAsync() =>
        Db.QueryFirstAsync(StoredProcedures.GetPublicConfig, commandType: Sp);

    public async Task<Dictionary<string, string?>> GetAllAsync()
    {
        var rows = await Db.QueryAsync<(string Key, string? Value)>(StoredProcedures.AdminGetSettings, commandType: Sp);
        return rows.ToDictionary(r => r.Key, r => r.Value);
    }

    public Task<SaveResult> SaveAsync(string json) =>
        Db.QueryFirstAsync<SaveResult>(StoredProcedures.AdminSaveSettings, new { Json = json }, commandType: Sp);

    public async Task<(dynamic Summary, List<dynamic> Questions)> GameStatsAsync()
    {
        using var m = await Db.QueryMultipleAsync(StoredProcedures.AdminGameStats, commandType: Sp);
        var summary = await m.ReadFirstAsync();
        var questions = (await m.ReadAsync()).ToList();
        return (summary, questions);
    }

    public Task<dynamic> ResetAllAttemptsAsync() =>
        Db.QueryFirstAsync(StoredProcedures.AdminResetAllAttempts, commandType: Sp);
}
