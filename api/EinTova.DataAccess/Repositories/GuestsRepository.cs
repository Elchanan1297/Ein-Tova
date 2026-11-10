using Dapper;
using Microsoft.Data.SqlClient;

namespace EinTova.DataAccess.Repositories;

/// <summary>ניהול מוזמנים ומשפחות</summary>
internal sealed class GuestsRepository(SqlConnection db) : RepositoryBase(db)
{
    public async Task<(List<dynamic> Families, List<dynamic> Guests)> ListAsync()
    {
        using var m = await Db.QueryMultipleAsync(StoredProcedures.AdminListGuests, commandType: Sp);
        var families = (await m.ReadAsync()).ToList();
        var guests = (await m.ReadAsync()).ToList();
        return (families, guests);
    }

    public Task<dynamic> SaveFamilyAsync(int? familyId, string? name) =>
        Db.QueryFirstAsync(StoredProcedures.AdminSaveFamily, new { FamilyId = familyId, Name = name }, commandType: Sp);

    public Task<dynamic> DeleteFamilyAsync(int familyId) =>
        Db.QueryFirstAsync(StoredProcedures.AdminDeleteFamily, new { FamilyId = familyId }, commandType: Sp);

    public Task<dynamic> SaveGuestAsync(string json) =>
        Db.QueryFirstAsync(StoredProcedures.AdminSaveGuest, new { Json = json }, commandType: Sp);

    public Task<dynamic> DeleteGuestAsync(int guestId) =>
        Db.QueryFirstAsync(StoredProcedures.AdminDeleteGuest, new { GuestId = guestId }, commandType: Sp);

    public Task<dynamic> NewCodeAsync(int guestId) =>
        Db.QueryFirstAsync(StoredProcedures.AdminNewGuestCode, new { GuestId = guestId }, commandType: Sp);

    public Task ResetAttemptAsync(int guestId) =>
        Db.ExecuteAsync(StoredProcedures.AdminResetAttempt, new { GuestId = guestId }, commandType: Sp);

    public Task<dynamic> ImportAsync(string json) =>
        Db.QueryFirstAsync(StoredProcedures.AdminImportGuests, new { Json = json }, commandType: Sp);
}
