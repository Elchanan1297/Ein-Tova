using Dapper;
using EinTova.Models.Leaderboard;
using Microsoft.Data.SqlClient;

namespace EinTova.DataAccess.Repositories;

/// <summary>המשחק, הקולות ולוח התוצאות. החוקים (טיימר, ניסיון אחד, ניקוד) בפרוצדורות.</summary>
internal sealed class GameRepository(SqlConnection db) : RepositoryBase(db)
{
    public Task<dynamic> StartAttemptAsync(int guestId) =>
        Db.QueryFirstAsync(StoredProcedures.StartAttempt, new { GuestId = guestId }, commandType: Sp);

    /// <summary>ראש השאלה, והתשובות רק כשהמשחק באמצע</summary>
    public async Task<(dynamic Head, List<dynamic> Options)> NextQuestionAsync(int guestId)
    {
        using var m = await Db.QueryMultipleAsync(StoredProcedures.NextQuestion, new { GuestId = guestId }, commandType: Sp);
        var head = await m.ReadFirstAsync();
        if ((string)head.Status != "InProgress") return (head, new List<dynamic>());
        return (head, (await m.ReadAsync()).ToList());
    }

    public Task<dynamic> SubmitAnswerAsync(int guestId, int optionId) =>
        Db.QueryFirstAsync(StoredProcedures.SubmitAnswer, new { GuestId = guestId, OptionId = optionId }, commandType: Sp);

    public Task<dynamic> TimeoutAsync(int guestId) =>
        Db.QueryFirstAsync(StoredProcedures.TimeoutQuestion, new { GuestId = guestId }, commandType: Sp);

    public Task<dynamic?> GetVoiceClipAsync(string eventType) =>
        Db.QueryFirstOrDefaultAsync(StoredProcedures.GetVoiceClip, new { EventType = eventType }, commandType: Sp);

    public async Task<LeaderboardData> GetLeaderboardAsync()
    {
        using var m = await Db.QueryMultipleAsync(StoredProcedures.GetLeaderboard, commandType: Sp);
        var families = (await m.ReadAsync<FamilyScore>()).ToList();
        var top = (await m.ReadAsync<TopPlayer>()).ToList();
        return new LeaderboardData(families, top);
    }
}
