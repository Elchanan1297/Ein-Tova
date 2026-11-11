using System.Globalization;
using EinTova.Business.Imaging;
using EinTova.Infrastructure.Storage;
using EinTova.Models.Photos;
using MetadataExtractor;
using MetadataExtractor.Formats.Exif;
using SkiaSharp;

namespace EinTova.Business.Photos;

/// <summary>
/// צינור אחד להעלאה מהמכשיר ולייבוא מ־Drive:
/// סוג לפי magic bytes → גבולות ממדים (מפני decompression bomb) → סיבוב לפי EXIF → שנה (EXIF / Drive / תאריך קובץ)
/// → קידוד מחדש של כל הקבצים (כך לא נשאר EXIF/GPS) → שמירה. כישלון באמצע מוחק את מה שנשמר.
/// </summary>
public sealed class PhotoProcessor(IPhotoStorage storage)
{
    const int MaxSide = 12000;
    const long MaxPixels = 100_000_000;
    const int DisplaySide = 1600, ThumbSide = 400;

    /// <summary>עיבוד אחד בכל רגע (PhotoProcessor הוא Singleton)</summary>
    readonly SemaphoreSlim Gate = new(1, 1);

    /// <summary>סוג אמיתי לפי תחילת הקובץ, לא לפי סיומת</summary>
    public static string? DetectType(ReadOnlySpan<byte> h)
    {
        if (h.Length >= 3 && h[0] == 0xFF && h[1] == 0xD8 && h[2] == 0xFF) return "image/jpeg";
        if (h.Length >= 8 && h[..8].SequenceEqual(new byte[] { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A })) return "image/png";
        if (h.Length >= 12 && h[..4].SequenceEqual("RIFF"u8) && h[8..12].SequenceEqual("WEBP"u8)) return "image/webp";
        if (h.Length >= 12 && h[4..8].SequenceEqual("ftyp"u8))
        {
            var brand = System.Text.Encoding.ASCII.GetString(h[8..12]);
            if (brand is "heic" or "heix" or "hevc" or "hevx" or "mif1" or "msf1" or "heim" or "heis") return "image/heic";
        }
        return null;
    }

    /// <param name="driveTime">imageMediaMetadata.time מ־Drive ("2009:07:15 14:22:01"), אם יש</param>
    /// <param name="fileCreated">תאריך יצירת הקובץ (ביטחון נמוך)</param>
    public async Task<ProcessedPhoto> ProcessAsync(byte[] data, string? driveTime = null, DateTime? fileCreated = null)
    {
        var type = DetectType(data);
        if (type == "image/heic") throw new PhotoException(PhotoException.BadType, "HEIC לא נתמך, יש להמיר ל־JPEG");
        if (type is null) throw new PhotoException(PhotoException.BadType, "הקובץ אינו תמונה (JPEG, PNG או WEBP)");

        var (year, source) = SuggestYear(data, driveTime, fileCreated);
        var origPng = type == "image/png";

        // תמונה של 48MP תופסת כ־200MB בזיכרון אחרי פענוח. כמה כאלה במקביל ממלאות שרת קטן (B1: 1.75GB)
        // והוא נהרג (OOM). לכן מעבדים אחת בכל פעם; השאר ממתינות בתור כמה שניות.
        byte[] orig, display, thumb;
        int width, height;
        await Gate.WaitAsync();
        try
        {
            using var codec = SKCodec.Create(new MemoryStream(data))
                ?? throw new PhotoException(PhotoException.BadType, "לא הצלחנו לקרוא את התמונה");
            var info = codec.Info;
            if (info.Width > MaxSide || info.Height > MaxSide || (long)info.Width * info.Height > MaxPixels)
                throw new PhotoException(PhotoException.TooLarge, "התמונה גדולה מדי (מקסימום 12,000 פיקסלים לצלע)");

            using var decoded = SKBitmap.Decode(codec) ?? throw new PhotoException(PhotoException.BadType, "לא הצלחנו לפענח את התמונה");
            // עותק מסובב רק כשצריך לסובב: חוסך עוד עותק מלא בזיכרון
            using var rotated = ImageTools.NeedsRotation(codec.EncodedOrigin) ? ImageTools.Orient(decoded, codec.EncodedOrigin) : null;
            var image = rotated ?? decoded;
            (width, height) = (image.Width, image.Height);

            // המקור נשמר באיכות גבוהה מאוד, מקודד מחדש: בלי GPS ובלי שום EXIF. PNG נשאר PNG (שקיפות)
            orig = ImageTools.Encode(image, origPng ? SKEncodedImageFormat.Png : SKEncodedImageFormat.Jpeg, 95);
            display = ImageTools.Encode(ImageTools.Fit(image, DisplaySide), SKEncodedImageFormat.Webp, 82, dispose: true);
            thumb = ImageTools.Encode(ImageTools.Fit(image, ThumbSide), SKEncodedImageFormat.Webp, 75, dispose: true);
        }
        finally
        {
            Gate.Release();
        }

        var key = Guid.NewGuid().ToString("N");
        try
        {
            await storage.SaveAsync(key, OrigName(origPng ? "image/png" : "image/jpeg"), orig);
            await storage.SaveAsync(key, "display.webp", display);
            await storage.SaveAsync(key, "thumb.webp", thumb);
        }
        catch
        {
            await storage.DeleteAsync(key);
            throw;
        }
        return new ProcessedPhoto(key, width, height, orig.Length + display.Length + thumb.Length,
            origPng ? "image/png" : "image/jpeg", year, source);
    }

    public static string OrigName(string contentType) => contentType == "image/png" ? "orig.png" : "orig.jpg";

    /// <summary>EXIF (1) > Drive (2) > תאריך הקובץ (3, לא בטוח)</summary>
    static (short? Year, byte Source) SuggestYear(byte[] data, string? driveTime, DateTime? fileCreated)
    {
        try
        {
            var exif = ImageMetadataReader.ReadMetadata(new MemoryStream(data)).OfType<ExifSubIfdDirectory>().FirstOrDefault();
            if (exif is not null && exif.TryGetDateTime(ExifDirectoryBase.TagDateTimeOriginal, out var taken) && Plausible(taken.Year))
                return ((short)taken.Year, 1);
        }
        catch (ImageProcessingException) { /* בלי EXIF תקין: ממשיכים למקור הבא */ }

        if (driveTime is not null && DateTime.TryParseExact(driveTime[..Math.Min(19, driveTime.Length)], "yyyy:MM:dd HH:mm:ss",
                CultureInfo.InvariantCulture, DateTimeStyles.None, out var d) && Plausible(d.Year))
            return ((short)d.Year, 2);

        if (fileCreated is { } c && Plausible(c.Year)) return ((short)c.Year, 3);
        return (null, 0);
    }

    static bool Plausible(int year) => year >= 1940 && year <= DateTime.UtcNow.Year;
}
