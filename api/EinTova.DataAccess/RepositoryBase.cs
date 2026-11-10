using System.Data;
using Microsoft.Data.SqlClient;

namespace EinTova.DataAccess;

/// <summary>בסיס לכל ה־Repositories: חיבור אחד לבקשה, וכל קריאה היא פרוצדורה</summary>
internal abstract class RepositoryBase(SqlConnection db)
{
    protected SqlConnection Db { get; } = db;
    protected const CommandType Sp = CommandType.StoredProcedure;
}
