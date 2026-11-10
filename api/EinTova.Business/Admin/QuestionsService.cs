using EinTova.DataAccess.Repositories;

namespace EinTova.Business.Admin;

/// <summary>ניהול שאלות. האימות (4 תשובות, אחת נכונה וכו׳) בפרוצדורות.</summary>
public interface IQuestionsService
{
    Task<IEnumerable<object>> ListAsync();
    Task<dynamic> SaveAsync(string json);
    Task<dynamic> DeleteAsync(int questionId);
    Task<dynamic> ReorderAsync(int[] ids);
    Task<dynamic> ImportAsync(string json);
}

internal sealed class QuestionsService(QuestionsRepository repo) : IQuestionsService
{
    public async Task<IEnumerable<object>> ListAsync()
    {
        var (questions, options) = await repo.ListAsync();
        var byQuestion = options.ToLookup(o => o.QuestionId);
        return questions.Select(q => new
        {
            q.QuestionId, q.SortOrder, q.Body, q.ImageUrl, q.Fact, q.TimeLimitSec, q.IsActive, q.InUse,
            options = byQuestion[q.QuestionId].Select(o => new { o.OptionId, o.Body, o.IsCorrect }),
        });
    }

    public Task<dynamic> SaveAsync(string json) => repo.SaveAsync(json);
    public Task<dynamic> DeleteAsync(int questionId) => repo.DeleteAsync(questionId);
    public Task<dynamic> ReorderAsync(int[] ids) => repo.ReorderAsync(ids);
    public Task<dynamic> ImportAsync(string json) => repo.ImportAsync(json);
}
