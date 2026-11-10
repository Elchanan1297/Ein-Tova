namespace EinTova.Api.Mapping;

internal static class MappingResults
{
    /// <summary>תוצאת פרוצדורה עם Status: OK → 200, אחרת 400 עם אותו גוף</summary>
    public static IResult FromStatus(dynamic row) =>
        (string)row.Status == "OK" ? Results.Ok((object)row) : Results.BadRequest((object)row);

    /// <summary>שגיאה עם קוד והודעה בעברית</summary>
    public static IResult Error(int statusCode, string status, string message) =>
        Results.Json(new { status, message }, statusCode: statusCode);
}
