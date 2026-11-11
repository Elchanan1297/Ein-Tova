-- עין טובה: החידון על המסך הגדול (מצגת), למי שאין סמארטפון. בלי שינוי סכמה ובלי ניקוד:
-- אותן שאלות כמו בטלפון (אותה בחירה, אותו מספר), לפי הסדר שנקבע בניהול, ואותו זמן לשאלה. בטוח להריץ שוב.
SET QUOTED_IDENTIFIER ON; SET ANSI_NULLS ON;
GO
/* תוצאה 1: השאלות לפי הסדר. תוצאה 2: התשובות שלהן (כולל הנכונה: רק המנהל מקבל את זה) */
CREATE OR ALTER PROC dbo.usp_GetShowQuiz AS
BEGIN
  SET NOCOUNT ON;
  DECLARE @n INT=dbo.fn_EffectiveQuestionCount();
  DECLARE @sec INT=ISNULL(TRY_CONVERT(INT,dbo.fn_Setting('SecondsPerQuestion')),20);
  -- אותה בחירה כמו usp_StartAttempt: הראשונות לפי הסדר, רק שאלות פעילות עם 2+ תשובות ותשובה נכונה
  SELECT TOP (@n) q.QuestionId, q.Body, q.ImageUrl, q.Fact, ISNULL(q.TimeLimitSec,@sec) AS TimeLimitSec
  INTO #q
  FROM dbo.Questions q
  WHERE q.IsActive=1
    AND (SELECT COUNT(*) FROM dbo.Options o WHERE o.QuestionId=q.QuestionId)>=2
    AND EXISTS(SELECT 1 FROM dbo.Options o WHERE o.QuestionId=q.QuestionId AND o.IsCorrect=1)
  ORDER BY q.SortOrder, q.QuestionId;

  SELECT q.QuestionId, q.Body, q.ImageUrl, q.Fact, q.TimeLimitSec
  FROM #q q JOIN dbo.Questions s ON s.QuestionId=q.QuestionId
  ORDER BY s.SortOrder, s.QuestionId;

  SELECT o.QuestionId, o.OptionId, o.Body, o.IsCorrect
  FROM dbo.Options o JOIN #q q ON q.QuestionId=o.QuestionId
  ORDER BY o.QuestionId, o.SortOrder, o.OptionId;
END
GO
/* כמה ענו על השאלה בטלפון, וכמה צדקו (מוצג על המסך אחרי חשיפת התשובה) */
CREATE OR ALTER PROC dbo.usp_GetShowQuizStats @QuestionId INT AS
BEGIN
  SET NOCOUNT ON;
  SELECT COUNT(*) AS Answered, ISNULL(SUM(CASE WHEN IsCorrect=1 THEN 1 ELSE 0 END),0) AS Correct
  FROM dbo.AttemptQuestions WHERE QuestionId=@QuestionId AND AnsweredAt IS NOT NULL;
END
GO
