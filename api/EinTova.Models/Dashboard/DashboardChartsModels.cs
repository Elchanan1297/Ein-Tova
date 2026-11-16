namespace EinTova.Models.Dashboard;

// תוספות לגרפים של הדשבורד המתקדם (usp_GetDashboardCharts). המספרים הבסיסיים ב־DashboardData.

public class ChartsGeneral
{
    public double? MedianSec { get; init; }
    public int StartedLastHour { get; init; }
    public int FinishedLastHour { get; init; }
    public int BucketMinutes { get; init; }
}

public class ChartsFamily
{
    public int FamilyId { get; init; }
    public int Wrong { get; init; }
    public int TimedOut { get; init; }
    /// <summary>הרצף הארוך ביותר של תשובות נכונות אצל אחד מבני המשפחה</summary>
    public int MaxStreak { get; init; }
}

public class ChartsTimelinePoint
{
    public DateTime BucketStart { get; init; }
    public int Started { get; init; }
    public int Finished { get; init; }
    public decimal? AvgSec { get; init; }
}

public class ChartsBin
{
    public int Bin { get; init; }
    public string Label { get; init; } = "";
    public int N { get; init; }
}

public class ChartsHeatCell
{
    public int FamilyId { get; init; }
    public int QuestionId { get; init; }
    public int Answered { get; init; }
    public int Correct { get; init; }
}

public class ChartsTopWrong
{
    public int QuestionId { get; init; }
    public string TopWrong { get; init; } = "";
    public int TopWrongN { get; init; }
    public int WrongTotal { get; init; }
}

public record DashboardCharts(
    ChartsGeneral General,
    List<ChartsFamily> Families,
    List<ChartsTimelinePoint> Timeline,
    List<ChartsBin> ResponseTimes,
    List<ChartsHeatCell> Heatmap,
    List<ChartsTopWrong> TopWrong);

/// <summary>הדשבורד המתקדם בטעינה אחת: המספרים + הגרפים</summary>
public record DashboardFull(DashboardData Data, DashboardCharts Charts);
