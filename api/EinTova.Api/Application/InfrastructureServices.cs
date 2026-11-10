using EinTova.Infrastructure.Options;
using EinTova.Infrastructure.Storage;

namespace EinTova.Api.Application;

/// <summary>אחסון קבצים. בייצור: Media__Root ו־Photos__Root לתיקיות קבועות (volume / /home ב־Azure)</summary>
public static class InfrastructureServices
{
    public static WebApplicationBuilder AddInfrastructureServices(this WebApplicationBuilder builder)
    {
        var contentRoot = builder.Environment.ContentRootPath;

        builder.Services.AddOptions<MediaOptions>().Bind(builder.Configuration.GetSection(MediaOptions.Section))
            .PostConfigure(o => o.Root = Resolve(o.Root, contentRoot, "media"));
        builder.Services.AddOptions<PhotosOptions>().Bind(builder.Configuration.GetSection(PhotosOptions.Section))
            .PostConfigure(o => o.Root = Resolve(o.Root, contentRoot, "photos-data"));

        builder.Services.AddSingleton<IMediaStorage>(sp =>
            new DiskMediaStorage(sp.GetRequiredService<Microsoft.Extensions.Options.IOptions<MediaOptions>>().Value.Root));
        builder.Services.AddSingleton<IPhotoStorage>(sp =>
            new DiskPhotoStorage(sp.GetRequiredService<Microsoft.Extensions.Options.IOptions<PhotosOptions>>().Value.Root));
        return builder;
    }

    static string Resolve(string configured, string contentRoot, string fallback) =>
        string.IsNullOrWhiteSpace(configured) ? Path.Combine(contentRoot, fallback) : configured;
}
