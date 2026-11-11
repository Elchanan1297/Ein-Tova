namespace EinTova.DataAccess;

/// <summary>כל שמות הפרוצדורות במקום אחד</summary>
internal static class StoredProcedures
{
    // ציבורי וכניסה
    public const string GetPublicConfig = "usp_GetPublicConfig";
    public const string LoginByCode = "usp_LoginByCode";
    public const string LoginByPhone = "usp_LoginByPhone";

    // משחק
    public const string StartAttempt = "usp_StartAttempt";
    public const string NextQuestion = "usp_NextQuestion";
    public const string SubmitAnswer = "usp_SubmitAnswer";
    public const string TimeoutQuestion = "usp_TimeoutQuestion";
    public const string GetVoiceClip = "usp_GetVoiceClip";
    public const string GetLeaderboard = "usp_GetLeaderboard";

    // תוכן
    public const string GetProgram = "usp_GetProgram";
    public const string GetGreetings = "usp_GetGreetings";
    public const string AdminListGreetings = "usp_AdminListGreetings";
    public const string AdminSaveGreeting = "usp_AdminSaveGreeting";
    public const string AdminDeleteGreeting = "usp_AdminDeleteGreeting";
    public const string AdminReorderGreetings = "usp_AdminReorderGreetings";
    public const string AdminListProgram = "usp_AdminListProgram";
    public const string AdminSaveProgramItem = "usp_AdminSaveProgramItem";
    public const string AdminDeleteProgramItem = "usp_AdminDeleteProgramItem";
    public const string AdminListVoiceClips = "usp_AdminListVoiceClips";
    public const string AdminSaveVoiceClip = "usp_AdminSaveVoiceClip";
    public const string AdminDeleteVoiceClip = "usp_AdminDeleteVoiceClip";

    // ניהול: הגדרות וסטטיסטיקה
    public const string AdminGetSettings = "usp_AdminGetSettings";
    public const string AdminSaveSettings = "usp_AdminSaveSettings";
    public const string AdminGameStats = "usp_AdminGameStats";
    public const string AdminResetAllAttempts = "usp_AdminResetAllAttempts";

    // ניהול: שאלות
    public const string AdminListQuestions = "usp_AdminListQuestions";
    public const string AdminSaveQuestion = "usp_AdminSaveQuestion";
    public const string AdminDeleteQuestion = "usp_AdminDeleteQuestion";
    public const string AdminReorderQuestions = "usp_AdminReorderQuestions";
    public const string AdminImportQuestions = "usp_AdminImportQuestions";

    // ניהול: מוזמנים ומשפחות
    public const string AdminListGuests = "usp_AdminListGuests";
    public const string AdminSaveFamily = "usp_AdminSaveFamily";
    public const string AdminDeleteFamily = "usp_AdminDeleteFamily";
    public const string AdminSaveGuest = "usp_AdminSaveGuest";
    public const string AdminDeleteGuest = "usp_AdminDeleteGuest";
    public const string AdminNewGuestCode = "usp_AdminNewGuestCode";
    public const string AdminResetAttempt = "usp_AdminResetAttempt";
    public const string AdminImportGuests = "usp_AdminImportGuests";

    // מסע בזמן
    public const string GetPhotoLimits = "usp_GetPhotoLimits";
    public const string FindPhotoDuplicate = "usp_FindPhotoDuplicate";
    public const string AddPhoto = "usp_AddPhoto";
    public const string AdminListPhotos = "usp_AdminListPhotos";
    public const string AdminUpdatePhotoMeta = "usp_AdminUpdatePhotoMeta";
    public const string AdminReorderPhotos = "usp_AdminReorderPhotos";
    public const string DeletePhoto = "usp_DeletePhoto";
    public const string GetPhotoFile = "usp_GetPhotoFile";
    public const string ListPublishedPhotos = "usp_ListPublishedPhotos";
    public const string TogglePhotoLike = "usp_TogglePhotoLike";
    public const string GetSlideshow = "usp_GetSlideshow";

    // Save the date
    public const string GetSaveTheDate = "usp_GetSaveTheDate";
    public const string AdminSaveSaveTheDate = "usp_AdminSaveSaveTheDate";

    // חידון במצגת
    public const string GetShowQuiz = "usp_GetShowQuiz";
    public const string GetShowQuizStats = "usp_GetShowQuizStats";
}
