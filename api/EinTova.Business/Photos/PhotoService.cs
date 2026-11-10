using System.Security.Cryptography;
using System.Text.Json;
using System.Text.Json.Nodes;
using EinTova.Business.Show;
using EinTova.DataAccess.Repositories;
using EinTova.Infrastructure.Storage;
using EinTova.Models.Photos;

namespace EinTova.Business.Photos;

/// <summary>"מסע בזמן": העלאה וניהול (מנהל), גלריה ו־❤️ (אורחים), מצגת, והגשת הקבצים לפי חתימה</summary>
public interface IPhotoService
{
    /// <summary>זורק PhotoException (TooLarge / StorageFull / BadType)</summary>
    Task<object> UploadAsync(PhotoUpload upload);
    Task<object> AdminListAsync(byte? status, int? decade, int? skip, int? take);
    /// <summary>עדכון אחד או בכמות. Ok=false: התוצאה היא שגיאת אימות.</summary>
    Task<(bool Ok, dynamic Result)> UpdateAsync(JsonObject body);
    Task<dynamic> ReorderAsync(Guid[] ids);
    /// <summary>Ok=false: Status מהפרוצדורה (למשל NotFound)</summary>
    Task<(bool Ok, string Status)> DeleteAsync(Guid publicId);
    Task<IEnumerable<IDictionary<string, object?>>> ListPublishedAsync(int guestId, int? decade, int? skip, int? take);
    Task<dynamic> ToggleLikeAsync(Guid publicId, int guestId);
    Task<IEnumerable<IDictionary<string, object?>>> SlideshowAsync();
    /// <summary>גודל קיים, היקף מתאים (מקור רק למנהל), חתימה תקינה ובתוקף</summary>
    bool IsSignedUrlValid(Guid publicId, string size, string? k, long? e, string? s);
    /// <summary>null = חתימה לא תקינה, פג תוקף, לא פורסמה, או אין קובץ</summary>
    Task<PhotoFile?> OpenFileAsync(Guid publicId, string size, string? k, long? e, string? s);
}

internal sealed class PhotoService(
    PhotosRepository repo, PhotoProcessor processor, IPhotoStorage storage, PhotoUrls urls, IShowNotifier show) : IPhotoService
{
    public async Task<object> UploadAsync(PhotoUpload upload)
    {
        var limits = await repo.GetLimitsAsync();
        if (upload.Data.Length > limits.MaxMB * 1024L * 1024)
            throw new PhotoException(PhotoException.TooLarge, $"הקובץ גדול מ־{limits.MaxMB}MB");
        if (limits.UsedBytes + upload.Data.Length * 2L > limits.MaxStorageBytes)
            throw new PhotoException(PhotoException.StorageFull, "האחסון לתמונות מלא");

        var sha = Convert.ToHexString(SHA256.HashData(upload.Data)).ToLowerInvariant();

        // כפילות לא נכשלת: מחזירים את הקיימת, בלי לעבד שוב
        var existing = await repo.FindDuplicateAsync(sha, null);
        if (existing is not null) return new { status = "Duplicate", publicId = existing };

        var p = await processor.ProcessAsync(upload.Data);
        // שנה שהמנהל הזין גוברת על ההצעה האוטומטית
        return await AddAsync(p, sha, upload.Data.Length, upload.Caption, upload.Year, upload.YearApprox, null, upload.FileName);
    }

    public async Task<object> AdminListAsync(byte? status, int? decade, int? skip, int? take)
    {
        var (photos, counts) = await repo.AdminListAsync(status, decade, skip ?? 0, Math.Clamp(take ?? 200, 1, 500));
        return new { photos = photos.Select(r => urls.AddTo((IDictionary<string, object?>)r, PhotoScope.Admin)).ToList(), counts };
    }

    public async Task<(bool Ok, dynamic Result)> UpdateAsync(JsonObject body)
    {
        var (res, published) = await repo.UpdateMetaAsync(body.ToJsonString());
        if ((string)res.Status != "OK") return (false, res);
        // תמונות שפורסמו עכשיו נכנסות למצגת בלי רענון
        if (published.Count > 0) await show.PhotoPublishedAsync(published);
        return (true, res);
    }

    public Task<dynamic> ReorderAsync(Guid[] ids) => repo.ReorderAsync(ids);

    public async Task<(bool Ok, string Status)> DeleteAsync(Guid publicId)
    {
        var r = await repo.DeleteAsync(publicId);
        if (r.Status != "OK") return (false, r.Status);
        await storage.DeleteAsync(r.StorageKey!);
        return (true, r.Status);
    }

    public async Task<IEnumerable<IDictionary<string, object?>>> ListPublishedAsync(int guestId, int? decade, int? skip, int? take)
    {
        var rows = await repo.ListPublishedAsync(guestId, decade, skip ?? 0, Math.Clamp(take ?? 500, 1, 500));
        return rows.Select(r => urls.AddTo((IDictionary<string, object?>)r, PhotoScope.Guest));
    }

    public Task<dynamic> ToggleLikeAsync(Guid publicId, int guestId) => repo.ToggleLikeAsync(publicId, guestId);

    public async Task<IEnumerable<IDictionary<string, object?>>> SlideshowAsync()
    {
        var rows = await repo.GetSlideshowAsync();
        return rows.Select(r => urls.AddTo((IDictionary<string, object?>)r, PhotoScope.Guest));
    }

    public bool IsSignedUrlValid(Guid publicId, string size, string? k, long? e, string? s)
    {
        var scope = Scope(k);
        return PhotoSizes.All.Contains(size) && scope != '?' && (size != PhotoSizes.Orig || scope == PhotoScope.Admin)
            && urls.IsValid(publicId, size, scope, e ?? 0, s);
    }

    public async Task<PhotoFile?> OpenFileAsync(Guid publicId, string size, string? k, long? e, string? s)
    {
        if (!IsSignedUrlValid(publicId, size, k, e, s)) return null;

        var f = await repo.GetFileAsync(publicId, publishedOnly: Scope(k) == PhotoScope.Guest);
        if (f is null) return null;

        var orig = size == PhotoSizes.Orig;
        var stream = storage.Open(f.StorageKey, orig ? PhotoProcessor.OrigName(f.ContentType) : $"{size}.webp");
        if (stream is null) return null;

        var etag = $"\"{publicId:N}-{size}\"";
        return orig
            ? new PhotoFile(stream, f.ContentType, DownloadName(f.SourceName, f.ContentType), etag)
            : new PhotoFile(stream, "image/webp", null, etag);
    }

    /// <summary>שמירה ב־DB אחרי עיבוד. אם ה־DB נכשל או מצא כפילות, הקבצים נמחקים (בלי יתומים)</summary>
    async Task<object> AddAsync(ProcessedPhoto p, string sha, int origBytes,
        string? caption, short? manualYear, bool yearApprox, string? sourceDriveId, string? sourceName)
    {
        var json = JsonSerializer.Serialize(new
        {
            storageKey = p.StorageKey, sha256 = sha, width = p.Width, height = p.Height,
            origBytes, storedBytes = p.StoredBytes, contentType = p.ContentType,
            caption, yearTaken = manualYear ?? p.Year, yearApprox, yearSource = manualYear is null ? p.YearSource : (byte)0,
            sourceDriveId, sourceName, createdBy = "admin",
        });
        try
        {
            var r = await repo.AddAsync(json);
            if (r.Status != "OK") await storage.DeleteAsync(p.StorageKey);
            return new { status = r.Status, publicId = r.PublicId };
        }
        catch
        {
            await storage.DeleteAsync(p.StorageKey);
            throw;
        }
    }

    static char Scope(string? k) => k is "a" or "g" ? k[0] : '?';

    static string DownloadName(string? source, string contentType)
    {
        var ext = contentType == "image/png" ? ".png" : ".jpg";
        var name = string.IsNullOrWhiteSpace(source) ? "photo" : Path.GetFileNameWithoutExtension(source);
        return name + ext;
    }
}
