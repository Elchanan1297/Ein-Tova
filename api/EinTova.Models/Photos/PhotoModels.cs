namespace EinTova.Models.Photos;

/// <summary>מה שנשמר אחרי עיבוד, לפני הכנסה ל־DB</summary>
public sealed record ProcessedPhoto(string StorageKey, int Width, int Height, int StoredBytes, string ContentType, short? Year, byte YearSource);

public record PhotoLimits(int MaxMB, long MaxStorageBytes, long UsedBytes);

public record PhotoFileInfo(string StorageKey, string ContentType, string? SourceName);

/// <summary>העלאה מהמכשיר: הקובץ ומה שהמנהל מילא בטופס</summary>
public record PhotoUpload(byte[] Data, string FileName, string? Caption, short? Year, bool YearApprox);

/// <summary>קובץ להגשה: זרם, סוג, ושם להורדה (רק למקור)</summary>
public sealed record PhotoFile(Stream Content, string ContentType, string? DownloadName, string ETag);

public static class PhotoSizes
{
    public const string Thumb = "thumb", Display = "display", Orig = "orig";
    public static readonly string[] All = { Thumb, Display, Orig };
}

/// <summary>היקף כתובת חתומה: g = אורח/מצגת (רק שפורסמו), a = מנהל (הכול, כולל מקור)</summary>
public static class PhotoScope
{
    public const char Guest = 'g', Admin = 'a';
}
