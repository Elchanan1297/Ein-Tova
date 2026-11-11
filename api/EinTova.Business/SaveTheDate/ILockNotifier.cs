namespace EinTova.Business.SaveTheDate;

/// <summary>הודעה לכל הלקוחות שמצב הנעילה השתנה. המימוש ב־Api (SignalR, /hubs/state)</summary>
public interface ILockNotifier
{
    Task LockChangedAsync(bool locked, CancellationToken ct = default);
}
