using EinTova.Infrastructure.Ai;
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
        // תובנות AI: הספק לפי AI__Provider (gemini | fake | ריק = כבוי). המפתח רק ממשתני סביבה
        builder.Services.AddOptions<AiOptions>().Bind(builder.Configuration.GetSection(AiOptions.Section));
        builder.Services.AddSingleton(sp => sp.GetRequiredService<Microsoft.Extensions.Options.IOptions<AiOptions>>().Value);
        var provider = builder.Configuration[$"{AiOptions.Section}:Provider"]?.Trim().ToLowerInvariant();
        if (provider == "gemini") builder.Services.AddHttpClient<IInsightsClient, GeminiInsightsClient>();
        else if (provider == "fake") builder.Services.AddSingleton<IInsightsClient, FakeInsightsClient>();
        else builder.Services.AddSingleton<IInsightsClient, DisabledInsightsClient>();
        return builder;
    }

    static string Resolve(string configured, string contentRoot, string fallback) =>
        string.IsNullOrWhiteSpace(configured) ? Path.Combine(contentRoot, fallback) : configured;
}
