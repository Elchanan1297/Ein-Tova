using System.Text.Json;
using Dapper;
using EinTova.Models.Admin;
using Microsoft.Data.SqlClient;

namespace EinTova.DataAccess.Repositories;

internal sealed class QuestionsRepository(SqlConnection db) : RepositoryBase(db)
{
    public async Task<(List<QuestionRow> Questions, List<OptionRow> Options)> ListAsync()
    {
        using var m = await Db.QueryMultipleAsync(StoredProcedures.AdminListQuestions, commandType: Sp);
        var questions = (await m.ReadAsync<QuestionRow>()).ToList();
        var options = (await m.ReadAsync<OptionRow>()).ToList();
        return (questions, options);
    }

    public Task<dynamic> SaveAsync(string json) =>
        Db.QueryFirstAsync(StoredProcedures.AdminSaveQuestion, new { Json = json }, commandType: Sp);

    public Task<dynamic> DeleteAsync(int questionId) =>
        Db.QueryFirstAsync(StoredProcedures.AdminDeleteQuestion, new { QuestionId = questionId }, commandType: Sp);

    public Task<dynamic> ReorderAsync(int[] ids) =>
        Db.QueryFirstAsync(StoredProcedures.AdminReorderQuestions, new { Json = JsonSerializer.Serialize(ids) }, commandType: Sp);

    public Task<dynamic> ImportAsync(string json) =>
        Db.QueryFirstAsync(StoredProcedures.AdminImportQuestions, new { Json = json }, commandType: Sp);
}
