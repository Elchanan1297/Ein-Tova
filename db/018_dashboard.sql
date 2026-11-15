-- עין טובה: מהירות מענה, שובר שוויון לפי מהירות, דשבורדים וסיום משחק. בטוח להריץ שוב.
-- מהירות = ממוצע הזמן מהגשת השאלה (ServedAt) ועד התשובה (AnsweredAt), רק תשובות שנשלחו בזמן.
-- שחקני טלפון כשר (Attempts.ExtraSec>0) לא נספרים במהירות: השאלה מוקראת להם, וזה לא הוגן.
-- הדירוג: קודם הניקוד (כמו קודם), ובשוויון מי שענה מהר יותר. בלי מדידת מהירות = אחרי מי שיש לו.
-- usp_GetLeaderboard (005) ו־usp_GetPublicConfig (002) מוגדרות כאן מחדש; שינוי בהן מעכשיו רק כאן.
SET QUOTED_IDENTIFIER ON; SET ANSI_NULLS ON;
GO
IF NOT EXISTS(SELECT 1 FROM dbo.Settings WHERE SettingKey='ResultsPublished')
  INSERT dbo.Settings(SettingKey,SettingValue,Note) VALUES('ResultsPublished',N'0',N'1 = המשחק הסתיים והדשבורדים גלויים לכולם');
GO
/* לכל ניסיון: כמה ענה, כמה צדק, וסכום/מספר זמני המענה למהירות (רק באפליקציה) */
CREATE OR ALTER FUNCTION dbo.fn_AttemptStats() RETURNS TABLE AS RETURN
SELECT a.AttemptId, a.GuestId, a.Score, a.Total, a.StartedAt, a.FinishedAt,
  CAST(CASE WHEN a.ExtraSec>0 THEN 1 ELSE 0 END AS BIT) AS ViaPhone,
  ISNULL(s.Answered,0) AS Answered, ISNULL(s.Correct,0) AS Correct, s.LastAnswerAt,
  CASE WHEN a.ExtraSec=0 THEN ISNULL(s.SpeedMs,0) ELSE 0 END AS SpeedMs,
  CASE WHEN a.ExtraSec=0 THEN ISNULL(s.SpeedN,0) ELSE 0 END AS SpeedN
FROM dbo.Attempts a
OUTER APPLY (
  SELECT COUNT(aq.AnsweredAt) AS Answered,
    SUM(CASE WHEN aq.IsCorrect=1 THEN 1 ELSE 0 END) AS Correct,
    MAX(aq.AnsweredAt) AS LastAnswerAt,
    SUM(CASE WHEN aq.OptionId IS NOT NULL AND aq.TimedOut=0 THEN DATEDIFF_BIG(MILLISECOND,aq.ServedAt,aq.AnsweredAt) END) AS SpeedMs,
    SUM(CASE WHEN aq.OptionId IS NOT NULL AND aq.TimedOut=0 THEN 1 ELSE 0 END) AS SpeedN
  FROM dbo.AttemptQuestions aq WHERE aq.AttemptId=a.AttemptId) s;
GO
/* דירוג המשפחות: לפי LeaderboardRank (סה"כ/ממוצע), אחר כך ממוצע, ובשוויון המהירות */
CREATE OR ALTER FUNCTION dbo.fn_FamilyStandings() RETURNS TABLE AS RETURN
WITH s AS(
  SELECT f.FamilyId, f.Name, f.SortOrder,
    COUNT(CASE WHEN g.IsActive=1 THEN 1 END) AS Guests,
    ISNULL(SUM(t.Score),0) AS TotalScore, COUNT(t.AttemptId) AS Players, COUNT(t.FinishedAt) AS Finished,
    CAST(ISNULL(AVG(CAST(t.Score AS FLOAT)),0) AS DECIMAL(9,2)) AS AvgScore, MIN(t.FinishedAt) AS FirstFinish,
    ISNULL(SUM(t.Answered),0) AS Answered, ISNULL(SUM(t.Correct),0) AS Correct,
    CAST(SUM(t.SpeedMs)/NULLIF(SUM(t.SpeedN),0)/1000.0 AS DECIMAL(9,2)) AS AvgSec
  FROM dbo.Families f
  LEFT JOIN dbo.Guests g ON g.FamilyId=f.FamilyId
  LEFT JOIN dbo.fn_AttemptStats() t ON t.GuestId=g.GuestId
  GROUP BY f.FamilyId, f.Name, f.SortOrder),
d AS(
  SELECT *, CAST(CASE WHEN dbo.fn_Setting('LeaderboardRank')=N'Average' THEN AvgScore ELSE TotalScore END AS DECIMAL(9,2)) AS DisplayScore,
    CASE WHEN dbo.fn_Setting('LeaderboardRank')=N'Average' THEN 'Average' ELSE 'Total' END AS RankBy
  FROM s)
SELECT RANK() OVER(ORDER BY DisplayScore DESC, AvgScore DESC, CASE WHEN AvgSec IS NULL THEN 1 ELSE 0 END, AvgSec) AS Rnk, *
FROM d;
GO
/* תוצאה 1: משפחות. תוצאה 2: עשרת המובילים (בשוויון: המהיר קודם) */
CREATE OR ALTER PROC dbo.usp_GetLeaderboard AS
BEGIN
  SET NOCOUNT ON;
  SELECT Rnk, FamilyId, Name, TotalScore, Players, Finished, AvgScore, FirstFinish, DisplayScore, RankBy, AvgSec
  FROM dbo.fn_FamilyStandings()
  ORDER BY Rnk, Name;
  SELECT TOP 10 g.FullName, f.Name AS FamilyName, t.Score, t.Total,
    CAST(t.SpeedMs/NULLIF(t.SpeedN,0)/1000.0 AS DECIMAL(9,2)) AS AvgSec
  FROM dbo.fn_AttemptStats() t JOIN dbo.Guests g ON g.GuestId=t.GuestId JOIN dbo.Families f ON f.FamilyId=g.FamilyId
  WHERE t.FinishedAt IS NOT NULL
  ORDER BY t.Score DESC, CASE WHEN t.SpeedN=0 THEN 1 ELSE 0 END, CAST(t.SpeedMs AS FLOAT)/NULLIF(t.SpeedN,0), t.FinishedAt;
END
GO
/* כמו ב־002, ועוד ResultsPublished (האפליקציה מציגה את מסך התוצאות רק אחרי סיום) */
CREATE OR ALTER PROC dbo.usp_GetPublicConfig AS
BEGIN
  SET NOCOUNT ON;
  DECLARE @n INT=dbo.fn_EffectiveQuestionCount();
  SELECT dbo.fn_IsGameOpen() AS IsOpen, dbo.fn_Setting('GameMode') AS GameMode,
    dbo.fn_Setting('OpensAt') AS OpensAt, dbo.fn_Setting('ClosesAt') AS ClosesAt,
    @n AS QuestionCount,
    ISNULL(TRY_CONVERT(INT,NULLIF(dbo.fn_Setting('FactsLabelCount'),'')),@n) AS FactsLabelCount,
    ISNULL(TRY_CONVERT(INT,dbo.fn_Setting('SecondsPerQuestion')),20) AS SecondsPerQuestion,
    ISNULL(TRY_CONVERT(FLOAT,dbo.fn_Setting('VoiceChance')),0.34) AS VoiceChance,
    CAST(CASE WHEN dbo.fn_Setting('ResultsPublished')=N'1' THEN 1 ELSE 0 END AS BIT) AS ResultsPublished;
END
GO
/* הדשבורד: 1) סיכום 2) משפחות 3) שחקנים 4) שאלות. @IncludeAll=0 (ציבורי): רק מי שהתחיל לשחק */
CREATE OR ALTER PROC dbo.usp_GetDashboard @IncludeAll BIT=1 AS
BEGIN
  SET NOCOUNT ON;
  SELECT
    (SELECT COUNT(*) FROM dbo.Guests WHERE IsActive=1) AS Guests,
    COUNT(*) AS Started,
    COUNT(FinishedAt) AS Finished,
    ISNULL(SUM(CAST(ViaPhone AS INT)),0) AS PhonePlayers,
    ISNULL(SUM(Answered),0) AS Answers,
    CAST(ISNULL(100.0*SUM(Correct)/NULLIF(SUM(Answered),0),0) AS DECIMAL(5,1)) AS CorrectPct,
    CAST(SUM(SpeedMs)/NULLIF(SUM(SpeedN),0)/1000.0 AS DECIMAL(9,2)) AS AvgSec,
    CAST(ISNULL(AVG(CASE WHEN FinishedAt IS NOT NULL THEN CAST(Score AS FLOAT) END),0) AS DECIMAL(9,2)) AS AvgScore,
    dbo.fn_EffectiveQuestionCount() AS QuestionCount,
    dbo.fn_IsGameOpen() AS IsOpen,
    CAST(CASE WHEN dbo.fn_Setting('ResultsPublished')=N'1' THEN 1 ELSE 0 END AS BIT) AS Published,
    MAX(LastAnswerAt) AS LastAnswerAt
  FROM dbo.fn_AttemptStats();

  SELECT Rnk, FamilyId, Name, Guests, Players, Finished, TotalScore, AvgScore, DisplayScore, RankBy,
    Answered, Correct, CAST(ISNULL(100.0*Correct/NULLIF(Answered,0),0) AS DECIMAL(5,1)) AS CorrectPct, AvgSec
  FROM dbo.fn_FamilyStandings()
  ORDER BY Rnk, Name;

  ;WITH p AS(
    SELECT g.GuestId, g.FullName, f.FamilyId, f.Name AS FamilyName,
      CASE WHEN t.AttemptId IS NULL THEN 'none' WHEN t.FinishedAt IS NULL THEN 'playing' ELSE 'done' END AS Status,
      ISNULL(t.Answered,0) AS Answered, ISNULL(t.Total,dbo.fn_EffectiveQuestionCount()) AS Total, ISNULL(t.Score,0) AS Score,
      CAST(ISNULL(100.0*t.Correct/NULLIF(t.Answered,0),0) AS DECIMAL(5,1)) AS CorrectPct,
      CAST(t.SpeedMs/NULLIF(t.SpeedN,0)/1000.0 AS DECIMAL(9,2)) AS AvgSec,
      ISNULL(t.ViaPhone,0) AS ViaPhone, t.LastAnswerAt, t.AttemptId
    FROM dbo.Guests g JOIN dbo.Families f ON f.FamilyId=g.FamilyId
    LEFT JOIN dbo.fn_AttemptStats() t ON t.GuestId=g.GuestId
    WHERE (g.IsActive=1 OR t.AttemptId IS NOT NULL) AND (@IncludeAll=1 OR t.AttemptId IS NOT NULL))
  SELECT CASE WHEN AttemptId IS NULL THEN NULL
      ELSE RANK() OVER(ORDER BY CASE WHEN AttemptId IS NULL THEN 1 ELSE 0 END, Score DESC, CASE WHEN AvgSec IS NULL THEN 1 ELSE 0 END, AvgSec) END AS Rnk,
    GuestId, FullName, FamilyId, FamilyName, Status, Answered, Total, Score, CorrectPct, AvgSec, ViaPhone, LastAnswerAt
  FROM p
  ORDER BY CASE WHEN AttemptId IS NULL THEN 1 ELSE 0 END, Score DESC, CASE WHEN AvgSec IS NULL THEN 1 ELSE 0 END, AvgSec, FullName;

  -- לכל שאלה: אחוז הצלחה, זמן ממוצע, ומי ענה נכון הכי מהר (באפליקציה)
  ;WITH ans AS(
    SELECT aq.QuestionId, aq.IsCorrect, aq.TimedOut, aq.OptionId, a.GuestId,
      CASE WHEN a.ExtraSec=0 AND aq.OptionId IS NOT NULL AND aq.TimedOut=0
        THEN DATEDIFF_BIG(MILLISECOND,aq.ServedAt,aq.AnsweredAt) END AS Ms
    FROM dbo.AttemptQuestions aq JOIN dbo.Attempts a ON a.AttemptId=aq.AttemptId
    WHERE aq.AnsweredAt IS NOT NULL),
  fast AS(
    SELECT QuestionId, GuestId, Ms, ROW_NUMBER() OVER(PARTITION BY QuestionId ORDER BY Ms) AS rn
    FROM ans WHERE IsCorrect=1 AND Ms IS NOT NULL)
  SELECT q.QuestionId, q.SortOrder, q.Body,
    COUNT(ans.QuestionId) AS Answered,
    ISNULL(SUM(CASE WHEN ans.IsCorrect=1 THEN 1 ELSE 0 END),0) AS Correct,
    CAST(ISNULL(100.0*SUM(CASE WHEN ans.IsCorrect=1 THEN 1 ELSE 0 END)/NULLIF(COUNT(ans.QuestionId),0),0) AS DECIMAL(5,1)) AS CorrectPct,
    CAST(AVG(CAST(ans.Ms AS FLOAT))/1000.0 AS DECIMAL(9,2)) AS AvgSec,
    MAX(g.FullName) AS FastestName, MAX(fm.Name) AS FastestFamily, CAST(MAX(fa.Ms)/1000.0 AS DECIMAL(9,2)) AS FastestSec
  FROM dbo.Questions q
  LEFT JOIN ans ON ans.QuestionId=q.QuestionId
  LEFT JOIN fast fa ON fa.QuestionId=q.QuestionId AND fa.rn=1
  LEFT JOIN dbo.Guests g ON g.GuestId=fa.GuestId
  LEFT JOIN dbo.Families fm ON fm.FamilyId=g.FamilyId
  WHERE q.IsActive=1 OR ans.QuestionId IS NOT NULL
  GROUP BY q.QuestionId, q.SortOrder, q.Body
  ORDER BY q.SortOrder, q.QuestionId;
END
GO
/* סיום המשחק: @Publish=1 סוגר את המשחק לכולם ומפרסם את הדשבורדים. @Publish=0 מבטל את הפרסום (המשחק נשאר סגור) */
CREATE OR ALTER PROC dbo.usp_AdminSetResultsPublished @Publish BIT AS
BEGIN
  SET NOCOUNT ON; SET XACT_ABORT ON;
  BEGIN TRAN;
  IF @Publish=1 UPDATE dbo.Settings SET SettingValue=N'Closed' WHERE SettingKey='GameMode';
  UPDATE dbo.Settings SET SettingValue=CASE WHEN @Publish=1 THEN N'1' ELSE N'0' END WHERE SettingKey='ResultsPublished';
  INSERT dbo.AdminAudit(Action,Details) VALUES(CASE WHEN @Publish=1 THEN 'EndGamePublish' ELSE 'UnpublishResults' END, NULL);
  COMMIT;
  SELECT 'OK' AS Status, @Publish AS Published;
END
GO
