using EinTova.Api.Hubs;
using EinTova.Business;
using EinTova.Business.SaveTheDate;
using EinTova.Business.Show;

namespace EinTova.Api.Application;

/// <summary>שכבת ה־Business וה־DB, והחיבור שלה למסכי המצגת (SignalR)</summary>
public static class ApplicationBusinessServices
{
    public static WebApplicationBuilder AddApplicationBusinessServices(this WebApplicationBuilder builder)
    {
        var cs = builder.Configuration.GetConnectionString("Db");
        if (string.IsNullOrWhiteSpace(cs))
            throw new InvalidOperationException("ConnectionStrings__Db חסר");

        builder.Services.AddDataAccess(cs);
        builder.Services.AddBusinessServices();
        builder.Services.AddSingleton<IShowNotifier, HubShowNotifier>();
        builder.Services.AddSingleton<ILockNotifier, HubLockNotifier>();
        return builder;
    }
}
