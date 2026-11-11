using EinTova.Business.SaveTheDate;
using Microsoft.AspNetCore.SignalR;

namespace EinTova.Api.Hubs;

/// <summary>
/// עדכון חי לכל הטלפונים: LockChanged(locked). בלי הזדהות ופתוח גם בזמן נעילה
/// (לא חושף כלום מעבר לנעול/פתוח). מיד בחיבור נשלח המצב הנוכחי.
/// </summary>
public sealed class StateHub(SaveTheDateGate gate) : Hub
{
    public const string LockChanged = "LockChanged";

    public override async Task OnConnectedAsync()
    {
        await Clients.Caller.SendAsync(LockChanged, await gate.IsLockedAsync());
        await base.OnConnectedAsync();
    }
}

/// <summary>המימוש של ILockNotifier: שולח לכל מי שמחובר ל־/hubs/state</summary>
public sealed class HubLockNotifier(IHubContext<StateHub> hub) : ILockNotifier
{
    public Task LockChangedAsync(bool locked, CancellationToken ct = default) =>
        hub.Clients.All.SendAsync(StateHub.LockChanged, locked, ct);
}
