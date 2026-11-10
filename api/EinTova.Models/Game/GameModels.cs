namespace EinTova.Models.Game;

public record AnswerRequest(int OptionId);

/// <summary>אירועים שיש להם קליפ קול של אבא</summary>
public static class VoiceEvents
{
    public static readonly string[] All = { "Welcome", "GameStart", "Correct", "Incorrect", "GameEnd", "Winner" };
}
