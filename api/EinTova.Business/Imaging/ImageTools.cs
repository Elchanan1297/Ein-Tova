using SkiaSharp;

namespace EinTova.Business.Imaging;

/// <summary>פעולות תמונה משותפות להעלאות התוכן ול"מסע בזמן"</summary>
internal static class ImageTools
{
    public static bool NeedsRotation(SKEncodedOrigin origin) =>
        origin is SKEncodedOrigin.RightTop or SKEncodedOrigin.BottomRight or SKEncodedOrigin.LeftBottom;

    /// <summary>סיבוב לפי כיוון הצילום (90/180/270). מצבי מראה נדירים נשארים כמו שהם.</summary>
    public static SKBitmap Orient(SKBitmap src, SKEncodedOrigin origin)
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

    /// <summary>הקטנה כך שהצלע הארוכה לא תעבור את maxSide (בלי הגדלה)</summary>
    public static SKBitmap Fit(SKBitmap src, int maxSide)
    {
        var scale = Math.Min(1.0, (double)maxSide / Math.Max(src.Width, src.Height));
        if (scale >= 1.0) return src.Copy();
        var w = Math.Max(1, (int)Math.Round(src.Width * scale));
        var h = Math.Max(1, (int)Math.Round(src.Height * scale));
        return Resize(src, w, h);
    }

    /// <summary>הקטנה לרוחב נתון (בלי הגדלה)</summary>
    public static SKBitmap FitWidth(SKBitmap src, int width)
    {
        var w = Math.Min(width, src.Width);
        if (w == src.Width) return src.Copy();
        var h = (int)Math.Round(src.Height * (double)w / src.Width);
        return Resize(src, w, h);
    }

    public static byte[] Encode(SKBitmap bmp, SKEncodedImageFormat format, int quality, bool dispose = false)
    {
        try
        {
            using var img = SKImage.FromBitmap(bmp);
            using var data = img.Encode(format, quality);
            return data.ToArray();
        }
        finally
        {
            if (dispose) bmp.Dispose();
        }
    }

    static SKBitmap Resize(SKBitmap src, int w, int h) =>
        src.Resize(new SKImageInfo(w, h), new SKSamplingOptions(SKCubicResampler.Mitchell));
}
