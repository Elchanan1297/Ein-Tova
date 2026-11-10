using System.Text.Json;
using Dapper;
using EinTova.Models.Admin;
using Microsoft.Data.SqlClient;

namespace EinTova.DataAccess.Repositories;

/// <summary>ברכות, תוכנית הערב וקליפי קול</summary>
internal sealed class ContentRepository(SqlConnection db) : RepositoryBase(db)
{
    static readonly Dictionary<ContentKind, (string List, string Save, string Delete)> Procs = new()
    {
        [ContentKind.Greetings] = (StoredProcedures.AdminListGreetings, StoredProcedures.AdminSaveGreeting, StoredProcedures.AdminDeleteGreeting),
        [ContentKind.Program] = (StoredProcedures.AdminListProgram, StoredProcedures.AdminSaveProgramItem, StoredProcedures.AdminDeleteProgramItem),
        [ContentKind.Voices] = (StoredProcedures.AdminListVoiceClips, StoredProcedures.AdminSaveVoiceClip, StoredProcedures.AdminDeleteVoiceClip),
    };

    public async Task<List<dynamic>> GetProgramAsync() =>
        (await Db.QueryAsync(StoredProcedures.GetProgram, commandType: Sp)).ToList();

    public async Task<List<dynamic>> GetGreetingsAsync() =>
        (await Db.QueryAsync(StoredProcedures.GetGreetings, commandType: Sp)).ToList();

    public Task<IEnumerable<dynamic>> AdminListAsync(ContentKind kind) =>
        Db.QueryAsync(Procs[kind].List, commandType: Sp);

    /// <summary>הגוף עובר כמו שהוא לפרוצדורה (JSON); האימות שם</summary>
    public Task<dynamic> AdminSaveAsync(ContentKind kind, string json) =>
        Db.QueryFirstAsync(Procs[kind].Save, new { Json = json }, commandType: Sp);

    public Task<dynamic> AdminDeleteAsync(ContentKind kind, int id) =>
        Db.QueryFirstAsync(Procs[kind].Delete, new { Id = id }, commandType: Sp);

    public Task<dynamic> ReorderGreetingsAsync(int[] ids) =>
        Db.QueryFirstAsync(StoredProcedures.AdminReorderGreetings, new { Json = JsonSerializer.Serialize(ids) }, commandType: Sp);
}
