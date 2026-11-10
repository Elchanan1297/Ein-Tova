namespace EinTova.Infrastructure.Storage;

internal static class PathGuard
{
    /// <summary>השמות נוצרים בשרת, אבל בכל זאת: בלי ".." ובלי תווי נתיב</summary>
    public static string Safe(string part) =>
        part.Length > 0 && part.IndexOfAny(Path.GetInvalidFileNameChars()) < 0 && !part.Contains("..")
            ? part
            : throw new ArgumentException("Bad storage path", nameof(part));
}
