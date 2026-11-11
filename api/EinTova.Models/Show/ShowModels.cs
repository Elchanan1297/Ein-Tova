namespace EinTova.Models.Show;

public record SceneRequest(string Scene);

public static class Scenes
{
    public const string Welcome = "welcome", Leaderboard = "leaderboard", Greetings = "greetings", Winner = "winner", Quiz = "quiz";
    public static readonly string[] All = { Welcome, Leaderboard, Greetings, Winner, Quiz };
}

/// <summary>שאלה בחידון של המצגת, עם התשובות והנכונה (רק בשרת; המסך מקבל את הנכונה רק בחשיפה)</summary>
public record ShowQuizQuestion(int QuestionId, string Body, string? ImageUrl, string? Fact, int TimeLimitSec)
{
    public List<ShowQuizOption> Options { get; init; } = [];
}

public record ShowQuizOption(int QuestionId, int OptionId, string Body, bool IsCorrect);

public record ShowQuizStats(int Answered, int Correct);

public record QuizAutoRequest(bool On);
