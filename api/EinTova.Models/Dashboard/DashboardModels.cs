namespace EinTova.Models.Dashboard;

// הדשבורד (usp_GetDashboard). זמנים בשניות; AvgSec = null כשאין מדידה (לא התחיל, או שיחק רק בטלפון כשר).

public class DashboardSummary
{
    public int Guests { get; init; }
    public int Started { get; init; }
    public int Finished { get; init; }
    public int PhonePlayers { get; init; }
    public int Answers { get; init; }
    public decimal CorrectPct { get; init; }
    public decimal? AvgSec { get; init; }
    public decimal AvgScore { get; init; }
    public int QuestionCount { get; init; }
    public bool IsOpen { get; init; }
    public bool Published { get; init; }
    public DateTime? LastAnswerAt { get; init; }
}

public class DashboardFamily
{
    public long Rnk { get; init; }
    public int FamilyId { get; init; }
    public string Name { get; init; } = "";
    public int Guests { get; init; }
    public int Players { get; init; }
    public int Finished { get; init; }
    public int TotalScore { get; init; }
    public decimal AvgScore { get; init; }
    public decimal DisplayScore { get; init; }
    public string RankBy { get; init; } = "Total";
    public int Answered { get; init; }
    public int Correct { get; init; }
    public decimal CorrectPct { get; init; }
    public decimal? AvgSec { get; init; }
}

public class DashboardPlayer
{
    public long? Rnk { get; init; }
    public int GuestId { get; init; }
    public string FullName { get; init; } = "";
    public int FamilyId { get; init; }
    public string FamilyName { get; init; } = "";
    /// <summary>none | playing | done</summary>
    public string Status { get; init; } = "none";
    public int Answered { get; init; }
    public int Total { get; init; }
    public int Score { get; init; }
    public decimal CorrectPct { get; init; }
    public decimal? AvgSec { get; init; }
    public bool ViaPhone { get; init; }
    public DateTime? LastAnswerAt { get; init; }
}

public class DashboardQuestion
{
    public int QuestionId { get; init; }
    public int SortOrder { get; init; }
    public string Body { get; init; } = "";
    public int Answered { get; init; }
    public int Correct { get; init; }
    public decimal CorrectPct { get; init; }
    public decimal? AvgSec { get; init; }
    public string? FastestName { get; init; }
    public string? FastestFamily { get; init; }
    public decimal? FastestSec { get; init; }
}

public record DashboardData(DashboardSummary Summary, List<DashboardFamily> Families, List<DashboardPlayer> Players, List<DashboardQuestion> Questions);

public record PublishRequest(bool Publish);
