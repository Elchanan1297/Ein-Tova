using EinTova.Api.Application;
using EinTova.Business.Dashboard;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace EinTova.Api.Hubs;

/// <summary>מסכי הדשבורד של המנהל מתחברים לכאן. "changed" בלי מטען: הלקוח מושך מחדש את /api/admin/dash</summary>
[Authorize(Policy = AuthPolicies.Admin)]
public sealed class DashboardHub : Hub
{
    public const string Changed = "changed";
}

public sealed class HubDashboardNotifier(IHubContext<DashboardHub> hub) : IDashboardNotifier
{
    public Task ChangedAsync(CancellationToken ct = default) => hub.Clients.All.SendAsync(DashboardHub.Changed, ct);
}
