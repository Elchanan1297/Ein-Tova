using System.Text.Json;
using Dapper;
using EinTova.Models.Photos;
using Microsoft.Data.SqlClient;

namespace EinTova.DataAccess.Repositories;

/// <summary>"מסע בזמן": מטא־דאטה בלבד. הקבצים עצמם ב־IPhotoStorage.</summary>
internal sealed class PhotosRepository(SqlConnection db) : RepositoryBase(db)
{
    public async Task<PhotoLimits> GetLimitsAsync()
    {
        var r = await Db.QueryFirstAsync<(int MaxMB, long MaxStorageBytes, long UsedBytes)>(StoredProcedures.GetPhotoLimits, commandType: Sp);
        return new PhotoLimits(r.MaxMB, r.MaxStorageBytes, r.UsedBytes);
    }

    public Task<Guid?> FindDuplicateAsync(string sha256, string? sourceDriveId) =>
        Db.QueryFirstOrDefaultAsync<Guid?>(StoredProcedures.FindPhotoDuplicate, new { Sha256 = sha256, SourceDriveId = sourceDriveId }, commandType: Sp);

    public async Task<(string Status, Guid PublicId)> AddAsync(string json) =>
        await Db.QueryFirstAsync<(string Status, Guid PublicId)>(StoredProcedures.AddPhoto, new { Json = json }, commandType: Sp);

    public async Task<(List<dynamic> Photos, dynamic Counts)> AdminListAsync(byte? status, int? decade, int skip, int take)
    {
        using var m = await Db.QueryMultipleAsync(StoredProcedures.AdminListPhotos,
            new { Status = status, Decade = decade, Skip = skip, Take = take }, commandType: Sp);
        var photos = (await m.ReadAsync()).ToList();
        var counts = await m.ReadFirstAsync();
        return (photos, counts);
    }

    /// <summary>עדכון אחד או בכמות. מחזיר את התוצאה ואת התמונות שפורסמו עכשיו.</summary>
    public async Task<(dynamic Result, List<Guid> Published)> UpdateMetaAsync(string json)
    {
        using var m = await Db.QueryMultipleAsync(StoredProcedures.AdminUpdatePhotoMeta, new { Json = json }, commandType: Sp);
        var res = await m.ReadFirstAsync();
        if ((string)res.Status != "OK") return (res, new List<Guid>());
        return (res, (await m.ReadAsync<Guid>()).ToList());
    }

    public Task<dynamic> ReorderAsync(Guid[] ids) =>
        Db.QueryFirstAsync(StoredProcedures.AdminReorderPhotos, new { Json = JsonSerializer.Serialize(ids) }, commandType: Sp);

    public async Task<(string Status, string? StorageKey)> DeleteAsync(Guid publicId) =>
        await Db.QueryFirstAsync<(string Status, string? StorageKey)>(StoredProcedures.DeletePhoto, new { PublicId = publicId }, commandType: Sp);

    public async Task<PhotoFileInfo?> GetFileAsync(Guid publicId, bool publishedOnly)
    {
        var f = await Db.QueryFirstOrDefaultAsync<(string StorageKey, string ContentType, string? SourceName)>(
            StoredProcedures.GetPhotoFile, new { PublicId = publicId, PublishedOnly = publishedOnly }, commandType: Sp);
        return f.StorageKey is null ? null : new PhotoFileInfo(f.StorageKey, f.ContentType, f.SourceName);
    }

    public Task<IEnumerable<dynamic>> ListPublishedAsync(int guestId, int? decade, int skip, int take) =>
        Db.QueryAsync(StoredProcedures.ListPublishedPhotos, new { GuestId = guestId, Decade = decade, Skip = skip, Take = take }, commandType: Sp);

    public Task<dynamic> ToggleLikeAsync(Guid publicId, int guestId) =>
        Db.QueryFirstAsync(StoredProcedures.TogglePhotoLike, new { PublicId = publicId, GuestId = guestId }, commandType: Sp);

    public Task<IEnumerable<dynamic>> GetSlideshowAsync() =>
        Db.QueryAsync(StoredProcedures.GetSlideshow, commandType: Sp);
}
