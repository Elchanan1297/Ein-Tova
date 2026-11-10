namespace EinTova.Infrastructure.Storage;

/// <summary>קבצים ציבוריים שהמנהל מעלה (תמונות ברכות, קליפי קול), בתיקיות images/ ו־audio/</summary>
public interface IMediaStorage
{
    string Root { get; }
    Task SaveAsync(string folder, string name, byte[] data);
    Task SaveAsync(string folder, string name, Stream data);
}

public sealed class DiskMediaStorage : IMediaStorage
{
    public DiskMediaStorage(string root)
    {
        Root = root;
        Directory.CreateDirectory(root);
    }

    public string Root { get; }

    public async Task SaveAsync(string folder, string name, byte[] data)
    {
        await File.WriteAllBytesAsync(PathFor(folder, name), data);
    }

    public async Task SaveAsync(string folder, string name, Stream data)
    {
        await using var fs = File.Create(PathFor(folder, name));
        await data.CopyToAsync(fs);
    }

    string PathFor(string folder, string name)
    {
        var dir = Path.Combine(Root, PathGuard.Safe(folder));
        Directory.CreateDirectory(dir);
        return Path.Combine(dir, PathGuard.Safe(name));
    }
}
