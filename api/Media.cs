using Microsoft.Extensions.FileProviders;
using SkiaSharp;

/// <summary>
/// קבצים שהמנהל מעלה: תמונות → WebP בשני גדלים (קידוד מחדש, כך שאין EXIF/מיקום), קול כמו שהוא.
/// נשמרים בתיקייה (Media__Root) ומוגשים ב־/media עם מטמון ארוך (שמות ייחודיים).
/// </summary>
static class Media
{
    static readonly int[] ImageWidths = { 640, 1280 };
    static readonly string[] AudioTypes = { ".mp3", ".m4a", ".aac", ".ogg", ".wav" };
    const long MaxImageBytes = 20 * 1024 * 1024, MaxAudioBytes = 8 * 1024 * 1024;

    public static void UseMedia(this WebApplication app, string root)
    {
        Directory.CreateDirectory(root);
        app.UseStaticFiles(new StaticFileOptions
        {
            FileProvider = new PhysicalFileProvider(root),
            RequestPath = "/media",
            OnPrepareResponse = c => c.Context.Response.Headers.CacheControl = "public, max-age=31536000, immutable",
        });
    }

    public static void MapMediaUpload(this RouteGroupBuilder admin, string root)
    {
        // טוקן Bearer, בלי עוגיות: אין צורך ב־antiforgery
        admin.MapPost("/upload/image", async (IFormFile file) =>
        {
            if (file.Length is 0 or > MaxImageBytes) return Results.BadRequest(new { status = "TooBig" });
            using var data = new MemoryStream();
            await file.CopyToAsync(data);
            data.Position = 0;

            using var codec = SKCodec.Create(data);
            using var decoded = codec is null ? null : SKBitmap.Decode(codec);
            if (codec is null || decoded is null) return Results.BadRequest(new { status = "NotImage" });
            using var image = Orient(decoded, codec.EncodedOrigin);   // תמונות מהטלפון מסובבות לפי EXIF

            var dir = Path.Combine(root, "images");
            Directory.CreateDirectory(dir);
            var name = Guid.NewGuid().ToString("N");
            foreach (var width in ImageWidths)
            {
                var w = Math.Min(width, image.Width);
                var h = (int)Math.Round(image.Height * (double)w / image.Width);
                using var resized = w == image.Width ? image.Copy() : image.Resize(new SKImageInfo(w, h), new SKSamplingOptions(SKCubicResampler.Mitchell));
                using var webp = SKImage.FromBitmap(resized).Encode(SKEncodedImageFormat.Webp, 80);
                await using var fs = File.Create(Path.Combine(dir, $"{name}-{width}.webp"));
                webp.SaveTo(fs);
            }
            return Results.Ok(new { status = "OK", url = $"/media/images/{name}-{ImageWidths[^1]}.webp" });
        }).DisableAntiforgery();

        admin.MapPost("/upload/audio", async (IFormFile file) =>
        {
            var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
            if (!AudioTypes.Contains(ext)) return Results.BadRequest(new { status = "NotAudio" });
            if (file.Length is 0 or > MaxAudioBytes) return Results.BadRequest(new { status = "TooBig" });
            var dir = Path.Combine(root, "audio");
            Directory.CreateDirectory(dir);
            var name = Guid.NewGuid().ToString("N") + ext;
            await using (var fs = File.Create(Path.Combine(dir, name)))
                await file.CopyToAsync(fs);
            return Results.Ok(new { status = "OK", url = $"/media/audio/{name}" });
        }).DisableAntiforgery();
    }

    /// <summary>סיבוב לפי כיוון הצילום (90/180/270). מצבי מראה נדירים נשארים כמו שהם.</summary>
    static SKBitmap Orient(SKBitmap src, SKEncodedOrigin origin)
    {
        var degrees = origin switch
        {
            SKEncodedOrigin.RightTop => 90,
            SKEncodedOrigin.BottomRight => 180,
            SKEncodedOrigin.LeftBottom => 270,
            _ => 0,
        };
        if (degrees == 0) return src.Copy();
        var swap = degrees != 180;
        var dst = new SKBitmap(swap ? src.Height : src.Width, swap ? src.Width : src.Height);
        using var canvas = new SKCanvas(dst);
        canvas.Translate(dst.Width / 2f, dst.Height / 2f);
        canvas.RotateDegrees(degrees);
        canvas.Translate(-src.Width / 2f, -src.Height / 2f);
        using var image = SKImage.FromBitmap(src);
        canvas.DrawImage(image, 0, 0, SKSamplingOptions.Default);
        return dst;
    }
}
