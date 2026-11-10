namespace EinTova.Infrastructure.Storage;

/// <summary>
/// אחסון קבצי התמונות. מימוש ראשון על דיסק; האירוח עוד לא נקבע, אז אפשר להחליף ב־Azure Blob בלי לגעת בשאר הקוד.
/// לכל תמונה תיקייה ({StorageKey}) עם orig.*, display.webp, thumb.webp.
/// </summary>
public interface IPhotoStorage
{
    Task SaveAsync(string key, string name, byte[] data);
    Stream? Open(string key, string name);
    Task DeleteAsync(string key);
}

public sealed class DiskPhotoStorage(string root) : IPhotoStorage
{
    public async Task SaveAsync(string key, string name, byte[] data)
    {
        var dir = Path.Combine(root, PathGuard.Safe(key));
        Directory.CreateDirectory(dir);
        await File.WriteAllBytesAsync(Path.Combine(dir, PathGuard.Safe(name)), data);
    }

    public Stream? Open(string key, string name)
    {
        var path = Path.Combine(root, PathGuard.Safe(key), PathGuard.Safe(name));
        return File.Exists(path) ? File.OpenRead(path) : null;
    }

    public Task DeleteAsync(string key)
    {
        var dir = Path.Combine(root, PathGuard.Safe(key));
        if (Directory.Exists(dir)) Directory.Delete(dir, recursive: true);
        return Task.CompletedTask;
    }
}
