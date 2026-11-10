using EinTova.Api.Application;
using EinTova.Business.Leaderboard;
using EinTova.Business.Show;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace EinTova.Api.Hubs;

/// <summary>מסך המצגת מתחבר לכאן (טוקן מנהל). מקבל מיד את המצב ואת הלוח, ואחר כך עדכונים.</summary>
[Authorize(Policy = AuthPolicies.Admin)]
public sealed class ShowHub(ShowState state, ILeaderboardService leaderboard) : Hub
{
    public const string State = "state", Leaderboard = "leaderboard", PhotoPublished = "photoPublished";

    public override async Task OnConnectedAsync()
    {
        state.ScreenConnected();
        await Clients.Caller.SendAsync(State, state.Snapshot());
        await Clients.Caller.SendAsync(Leaderboard, await leaderboard.GetAsync());
        await base.OnConnectedAsync();
    }

    public override Task OnDisconnectedAsync(Exception? e)
    {
        state.ScreenDisconnected();
        return base.OnDisconnectedAsync(e);
    }
}
