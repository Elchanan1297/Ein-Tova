namespace EinTova.Models.Admin;

public record QuestionRow(int QuestionId, int SortOrder, string Body, string? ImageUrl, string? Fact, int? TimeLimitSec, bool IsActive, bool InUse);
public record OptionRow(int OptionId, int QuestionId, string Body, bool IsCorrect, int SortOrder);
public record FamilyRequest(int? FamilyId, string? Name);

/// <summary>תוצאת שמירה מפרוצדורה: Status ("OK" או קוד שגיאה) ושדה שנכשל</summary>
public record SaveResult(string Status, string? Field);

/// <summary>סוגי תוכן שהמנהל עורך באותה תבנית: רשימה / שמירה / מחיקה</summary>
public enum ContentKind { Greetings, Program, Voices }
