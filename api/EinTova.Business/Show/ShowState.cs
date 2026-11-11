namespace EinTova.Business.Show;

/// <summary>מה מוצג כרגע במסך הגדול, מצב החידון, וכמה מסכים מחוברים (בזיכרון: שרת אחד)</summary>
public sealed class ShowState
{
    readonly object gate = new();
    string scene = "welcome";
    object? winner;
    QuizRun? quiz;
    DateTime changedAt = DateTime.UtcNow;
    int screens;

    /// <summary>פעולות החידון (שלט, מקלדת, טיימר אוטומטי) אחת בכל פעם</summary>
    public SemaphoreSlim QuizGate { get; } = new(1, 1);

    public string Scene { get { lock (gate) return scene; } }
    public QuizRun? Quiz { get { lock (gate) return quiz; } }

    public void Set(string newScene, object? newWinner)
    {
        lock (gate) { scene = newScene; winner = newWinner; changedAt = DateTime.UtcNow; }
    }

    /// <summary>מצב חדש לחידון; showScene = לעבור גם לסצנת החידון</summary>
    public void SetQuiz(QuizRun? run, bool showScene)
    {
        lock (gate)
        {
            quiz = run;
            if (showScene) { scene = "quiz"; winner = null; }
            changedAt = DateTime.UtcNow;
        }
    }

    public object Snapshot()
    {
        lock (gate) return new { scene, winner, changedAt, quiz = quiz?.ToPayload() };
    }

    public int ConnectedScreens => Volatile.Read(ref screens);
    public void ScreenConnected() => Interlocked.Increment(ref screens);
    public void ScreenDisconnected() => Interlocked.Decrement(ref screens);
}
