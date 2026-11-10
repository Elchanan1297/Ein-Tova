using EinTova.Business.Imaging;
using EinTova.Infrastructure.Storage;
using SkiaSharp;

namespace EinTova.Business.Media;

/// <summary>תוצאת העלאה: Status ("OK" / "TooBig" / "NotImage" / "NotAudio") וכתובת ב־/media</summary>
public record MediaUploadResult(string Status, string? Url = null);

/// <summary>
/// קבצים שהמנהל מעלה: תמונות → WebP בשני גדלים (קידוד מחדש, כך שאין EXIF/מיקום), קול כמו שהוא.
/// שמות ייחודיים, ולכן מוגשים עם מטמון ארוך.
/// </summary>
public interface IMediaService
{
    Task<MediaUploadResult> UploadImageAsync(Stream file, long length);
    Task<MediaUploadResult> UploadAudioAsync(Stream file, long length, string fileName);
}

internal sealed class MediaService(IMediaStorage storage) : IMediaService
{
    static readonly int[] ImageWidths = { 640, 1280 };
    static readonly string[] AudioTypes = { ".mp3", ".m4a", ".aac", ".ogg", ".wav" };
    const long MaxImageBytes = 20 * 1024 * 1024, MaxAudioBytes = 8 * 1024 * 1024;

    public async Task<MediaUploadResult> UploadImageAsync(Stream file, long length)
    {
        if (length is 0 or > MaxImageBytes) return new("TooBig");
        using var data = new MemoryStream();
        await file.CopyToAsync(data);
        data.Position = 0;

        using var codec = SKCodec.Create(data);
        using var decoded = codec is null ? null : SKBitmap.Decode(codec);
        if (codec is null || decoded is null) return new("NotImage");
        using var image = ImageTools.Orient(decoded, codec.EncodedOrigin);   // תמונות מהטלפון מסובבות לפי EXIF

        var name = Guid.NewGuid().ToString("N");
        foreach (var width in ImageWidths)
        {
            var webp = ImageTools.Encode(ImageTools.FitWidth(image, width), SKEncodedImageFormat.Webp, 80, dispose: true);
            await storage.SaveAsync("images", $"{name}-{width}.webp", webp);
        }
        return new("OK", $"/media/images/{name}-{ImageWidths[^1]}.webp");
    }

    public async Task<MediaUploadResult> UploadAudioAsync(Stream file, long length, string fileName)
    {
        var ext = Path.GetExtension(fileName).ToLowerInvariant();
        if (!AudioTypes.Contains(ext)) return new("NotAudio");
        if (length is 0 or > MaxAudioBytes) return new("TooBig");
        var name = Guid.NewGuid().ToString("N") + ext;
        await storage.SaveAsync("audio", name, file);
        return new("OK", $"/media/audio/{name}");
    }
}
