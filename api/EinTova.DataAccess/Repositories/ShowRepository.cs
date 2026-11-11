using Dapper;
using EinTova.Models.Show;
using Microsoft.Data.SqlClient;

namespace EinTova.DataAccess.Repositories;

/// <summary>החידון במצגת: אותן שאלות כמו במשחק בטלפון</summary>
internal sealed class ShowRepository(SqlConnection db) : RepositoryBase(db)
{
    public async Task<List<ShowQuizQuestion>> GetQuizAsync()
    {
        using var m = await Db.QueryMultipleAsync(StoredProcedures.GetShowQuiz, commandType: Sp);
        var questions = (await m.ReadAsync<ShowQuizQuestion>()).ToList();
        var options = (await m.ReadAsync<ShowQuizOption>()).ToLookup(o => o.QuestionId);
        return questions.Select(q => q with { Options = options[q.QuestionId].ToList() }).ToList();
    }

    public Task<ShowQuizStats> GetStatsAsync(int questionId) =>
        Db.QueryFirstAsync<ShowQuizStats>(StoredProcedures.GetShowQuizStats, new { QuestionId = questionId }, commandType: Sp);
}
