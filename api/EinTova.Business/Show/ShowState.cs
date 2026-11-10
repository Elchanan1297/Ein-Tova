namespace EinTova.Business.Show;

/// <summary>מה מוצג כרגע במסך הגדול, וכמה מסכים מחוברים (בזיכרון: שרת אחד)</summary>
public sealed class ShowState
{
    readonly object gate = new();
    string scene = "welcome";
    object? winner;
    DateTime changedAt = DateTime.UtcNow;
    int screens;

    public void Set(string newScene, object? newWinner)
    {
        lock (gate) { scene = newScene; winner = newWinner; changedAt = DateTime.UtcNow; }
    }

    public object Snapshot()
    {
        lock (gate) return new { scene, winner, changedAt };
    }

    public int ConnectedScreens => Volatile.Read(ref screens);
    public void ScreenConnected() => Interlocked.Increment(ref screens);
    public void ScreenDisconnected() => Interlocked.Decrement(ref screens);
}
