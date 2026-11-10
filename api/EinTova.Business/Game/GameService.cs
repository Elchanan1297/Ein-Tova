using EinTova.DataAccess.Repositories;
using EinTova.Models.Game;

namespace EinTova.Business.Game;

/// <summary>המשחק. החוקים עצמם (טיימר בשרת, ניסיון אחד, ניקוד) בפרוצדורות.</summary>
public interface IGameService
{
    Task<dynamic> StartAsync(int guestId);
    Task<object> NextAsync(int guestId);
    Task<dynamic> AnswerAsync(int guestId, int optionId);
    Task<dynamic> TimeoutAsync(int guestId);
    bool IsVoiceEvent(string eventType);
    Task<dynamic?> VoiceClipAsync(string eventType);
}

internal sealed class GameService(GameRepository repo) : IGameService
{
    public Task<dynamic> StartAsync(int guestId) => repo.StartAttemptAsync(guestId);

    public async Task<object> NextAsync(int guestId)
    {
        var (head, options) = await repo.NextQuestionAsync(guestId);
        return new { head, options };
    }

    public Task<dynamic> AnswerAsync(int guestId, int optionId) => repo.SubmitAnswerAsync(guestId, optionId);

    public Task<dynamic> TimeoutAsync(int guestId) => repo.TimeoutAsync(guestId);

    public bool IsVoiceEvent(string eventType) => VoiceEvents.All.Contains(eventType);

    public Task<dynamic?> VoiceClipAsync(string eventType) => repo.GetVoiceClipAsync(eventType);
}
