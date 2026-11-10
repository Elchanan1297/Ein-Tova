using Dapper;
using EinTova.Models.Auth;
using Microsoft.Data.SqlClient;

namespace EinTova.DataAccess.Repositories;

internal sealed class AuthRepository(SqlConnection db) : RepositoryBase(db)
{
    public Task<GuestDto?> LoginByCodeAsync(string code) =>
        Db.QuerySingleOrDefaultAsync<GuestDto>(StoredProcedures.LoginByCode, new { Code = code }, commandType: Sp);

    public Task<GuestDto?> LoginByPhoneAsync(string phone) =>
        Db.QuerySingleOrDefaultAsync<GuestDto>(StoredProcedures.LoginByPhone, new { Phone = phone }, commandType: Sp);
}
