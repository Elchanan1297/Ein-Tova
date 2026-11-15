namespace EinTova.Models.Leaderboard;

public class FamilyScore
{
    public long Rnk { get; init; }
    public int FamilyId { get; init; }
    public string Name { get; init; } = "";
    public int TotalScore { get; init; }
    public int Players { get; init; }
    public int Finished { get; init; }
    public decimal AvgScore { get; init; }
    public decimal DisplayScore { get; init; }
    public string RankBy { get; init; } = "Total";
    /// <summary>זמן מענה ממוצע בשניות (שובר שוויון). null = אין מדידה</summary>
    public decimal? AvgSec { get; init; }
}

public class TopPlayer
{
    public string FullName { get; init; } = "";
    public string FamilyName { get; init; } = "";
    public int Score { get; init; }
    public int Total { get; init; }
    public decimal? AvgSec { get; init; }
}

public record LeaderboardData(List<FamilyScore> Families, List<TopPlayer> Top);
