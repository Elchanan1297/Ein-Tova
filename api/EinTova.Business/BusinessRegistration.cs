using EinTova.Business.Admin;
using EinTova.Business.Auth;
using EinTova.Business.Content;
using EinTova.Business.Game;
using EinTova.Business.Leaderboard;
using EinTova.Business.Media;
using EinTova.Business.Photos;
using EinTova.Business.SaveTheDate;
using EinTova.Business.Show;
using EinTova.DataAccess.Repositories;
using Microsoft.Data.SqlClient;
using EinTova.Infrastructure.Options;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;

namespace EinTova.Business;

/// <summary>
/// רישום שכבת ה־Business (וה־Repositories שמתחתיה, שה־Api לא רואה).
/// נקרא מ־Api/Application/ApplicationBusinessServices.cs.
/// </summary>
public static class BusinessRegistration
{
    public static IServiceCollection AddDataAccess(this IServiceCollection services, string connectionString)
    {
        // חיבור אחד לבקשה
        services.AddScoped(_ => new SqlConnection(connectionString));
        services.AddScoped<AuthRepository>();
        services.AddScoped<GameRepository>();
        services.AddScoped<ContentRepository>();
        services.AddScoped<SettingsRepository>();
        services.AddScoped<QuestionsRepository>();
        services.AddScoped<GuestsRepository>();
        services.AddScoped<PhotosRepository>();
        services.AddScoped<SaveTheDateRepository>();
        services.AddScoped<ShowRepository>();
        return services;
    }

    public static IServiceCollection AddBusinessServices(this IServiceCollection services)
    {
        services.AddMemoryCache();

        services.AddSingleton<TokenService>();
        services.AddScoped<IAuthService, AuthService>();
        services.AddScoped<IGameService, GameService>();
        services.AddScoped<ILeaderboardService, LeaderboardService>();
        services.AddScoped<IContentService, ContentService>();
        services.AddScoped<ISettingsService, SettingsService>();
        services.AddScoped<IQuestionsService, QuestionsService>();
        services.AddScoped<IGuestsService, GuestsService>();
        services.AddScoped<IMediaService, MediaService>();

        services.AddSingleton<PhotoProcessor>();
        services.AddSingleton(sp => PhotoUrls.FromJwtKey(sp.GetRequiredService<IOptions<JwtOptions>>().Value.Key));
        services.AddScoped<IPhotoService, PhotoService>();

        services.AddSingleton<ShowState>();
        services.AddScoped<IShowService, ShowService>();
        services.AddHostedService<LeaderboardPusher>();
        services.AddHostedService<QuizTicker>();

        // Save the date: מצב הנעילה (מטמון 5 שניות) ושליחת שינויים ללקוחות. ILockNotifier נרשם ב־Api
        services.AddSingleton<SaveTheDateGate>();
        services.AddScoped<ISaveTheDateService, SaveTheDateService>();
        services.AddHostedService<SaveTheDateWatcher>();
        return services;
    }
}
