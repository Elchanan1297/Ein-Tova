using Dapper;
using EinTova.Models.Admin;
using EinTova.Models.SaveTheDate;
using Microsoft.Data.SqlClient;

namespace EinTova.DataAccess.Repositories;

/// <summary>מצב Save the date: שורות ב־Settings, הנעילה מחושבת ב־fn_IsSaveTheDateLocked</summary>
internal sealed class SaveTheDateRepository(SqlConnection db) : RepositoryBase(db)
{
    public Task<SaveTheDateSettings> GetAsync() =>
        Db.QueryFirstAsync<SaveTheDateSettings>(StoredProcedures.GetSaveTheDate, commandType: Sp);

    public Task<SaveResult> SaveAsync(string json) =>
        Db.QueryFirstAsync<SaveResult>(StoredProcedures.AdminSaveSaveTheDate, new { Json = json }, commandType: Sp);
}
