namespace EinTova.Models.Show;

public record SceneRequest(string Scene);

public static class Scenes
{
    public const string Welcome = "welcome", Leaderboard = "leaderboard", Greetings = "greetings", Winner = "winner";
    public static readonly string[] All = { Welcome, Leaderboard, Greetings, Winner };
}
