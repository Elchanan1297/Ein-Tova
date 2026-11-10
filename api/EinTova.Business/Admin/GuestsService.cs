using EinTova.Business.Leaderboard;
using EinTova.DataAccess.Repositories;

namespace EinTova.Business.Admin;

/// <summary>ניהול מוזמנים ומשפחות. שינוי שמשפיע על לוח התוצאות מנקה את המטמון שלו.</summary>
public interface IGuestsService
{
    Task<object> ListAsync();
    Task<dynamic> SaveFamilyAsync(int? familyId, string? name);
    Task<dynamic> DeleteFamilyAsync(int familyId);
    Task<dynamic> SaveGuestAsync(string json);
    Task<dynamic> DeleteGuestAsync(int guestId);
    Task<dynamic> NewCodeAsync(int guestId);
    Task ResetAttemptAsync(int guestId);
    Task<dynamic> ImportAsync(string json);
}

internal sealed class GuestsService(GuestsRepository repo, ILeaderboardService leaderboard) : IGuestsService
{
    public async Task<object> ListAsync()
    {
        var (families, guests) = await repo.ListAsync();
        return new { families, guests };
    }

    public Task<dynamic> SaveFamilyAsync(int? familyId, string? name)
    {
        leaderboard.Invalidate(); // שם משפחה מופיע בלוח
        return repo.SaveFamilyAsync(familyId, name);
    }

    public Task<dynamic> DeleteFamilyAsync(int familyId) => repo.DeleteFamilyAsync(familyId);
    public Task<dynamic> SaveGuestAsync(string json) => repo.SaveGuestAsync(json);
    public Task<dynamic> DeleteGuestAsync(int guestId) => repo.DeleteGuestAsync(guestId);
    public Task<dynamic> NewCodeAsync(int guestId) => repo.NewCodeAsync(guestId);

    public async Task ResetAttemptAsync(int guestId)
    {
        await repo.ResetAttemptAsync(guestId);
        leaderboard.Invalidate();
    }

    public Task<dynamic> ImportAsync(string json) => repo.ImportAsync(json);
}
