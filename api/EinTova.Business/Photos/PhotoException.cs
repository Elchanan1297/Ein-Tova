namespace EinTova.Business.Photos;

/// <summary>
/// שגיאת "מסע בזמן" עם קוד אחיד והודעה בעברית.
/// ה־Middleware של ה־Api ממיר את הקוד לסטטוס: BadType=415, TooLarge=413, StorageFull=507.
/// </summary>
public sealed class PhotoException(string code, string message) : Exception(message)
{
    public const string BadType = "BadType", TooLarge = "TooLarge", StorageFull = "StorageFull";
    public string Code { get; } = code;
}
