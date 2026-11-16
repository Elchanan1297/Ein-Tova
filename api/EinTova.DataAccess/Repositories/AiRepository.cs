using Dapper;
using Microsoft.Data.SqlClient;

namespace EinTova.DataAccess.Repositories;

public sealed class AiStatusRow
{
    public bool Enabled { get; init; }
    public bool IncludePlayerNames { get; init; }
    public bool PublishToViewers { get; init; }
    public int MaxCallsPerHour { get; init; }
    public int MaxQuestionsPerGame { get; init; }
    public int CallsLastHour { get; init; }
    public int QuestionsAsked { get; init; }
}

public sealed class AiStoredRow
{
    public int Id { get; init; }
    public DateTime CreatedAt { get; init; }
    public string Kind { get; init; } = "";
    public string? DataHash { get; init; }
    public string? Model { get; init; }
    public string PayloadJson { get; init; } = "";
}

/// <summary>תובנות AI: הגדרות ומכסות, מטמון לפי טביעת הנתונים, ותובנות שאושרו לפרסום</summary>
internal sealed class AiRepository(SqlConnection db) : RepositoryBase(db)
{
    public Task<AiStatusRow> GetStatusAsync() =>
        Db.QueryFirstAsync<AiStatusRow>(StoredProcedures.AiGetStatus, commandType: Sp);

    public Task<AiStoredRow?> GetCachedAsync(string kind, string? dataHash) =>
        Db.QueryFirstOrDefaultAsync<AiStoredRow>(StoredProcedures.AiGetCached, new { Kind = kind, DataHash = dataHash }, commandType: Sp);

    public Task<int> SaveAsync(string kind, string dataHash, string model, string payloadJson, int? tokensIn, int? tokensOut) =>
        Db.ExecuteScalarAsync<int>(StoredProcedures.AiSave,
            new { Kind = kind, DataHash = dataHash, Model = model, PayloadJson = payloadJson, TokensIn = tokensIn, TokensOut = tokensOut },
            commandType: Sp);

    public Task SetPublishedAsync(string? payloadJson) =>
        Db.ExecuteAsync(StoredProcedures.AiSetPublished, new { PayloadJson = payloadJson }, commandType: Sp);
}
