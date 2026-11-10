using EinTova.Business.Show;
using EinTova.Models.Leaderboard;
using Microsoft.AspNetCore.SignalR;

namespace EinTova.Api.Hubs;

/// <summary>המימוש של IShowNotifier: שולח לכל מסכי המצגת דרך SignalR</summary>
public sealed class HubShowNotifier(IHubContext<ShowHub> hub) : IShowNotifier
{
    public Task StateAsync(object snapshot, CancellationToken ct = default) =>
        hub.Clients.All.SendAsync(ShowHub.State, snapshot, ct);

    public Task LeaderboardAsync(LeaderboardData board, CancellationToken ct = default) =>
        hub.Clients.All.SendAsync(ShowHub.Leaderboard, board, ct);

    public Task PhotoPublishedAsync(IReadOnlyList<Guid> publicIds, CancellationToken ct = default) =>
        hub.Clients.All.SendAsync(ShowHub.PhotoPublished, publicIds, ct);
}
