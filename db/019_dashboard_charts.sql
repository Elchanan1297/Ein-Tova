-- עין טובה: נתונים לגרפים של הדשבורד המתקדם (קריאה בלבד, בלי שינוי בחוקים). בטוח להריץ שוב.
-- המספרים הבסיסיים (סיכום, משפחות, שחקנים, שאלות) נשארים ב־usp_GetDashboard (018); כאן רק התוספות לגרפים.
-- מהירות: כמו ב־018, רק באפליקציה (Attempts.ExtraSec=0) ורק תשובות שנשלחו בזמן.
-- "רצף": הכי הרבה תשובות נכונות ברצף של שחקן (לפי סדר השאלות שלו). למשפחה: הרצף הארוך ביותר של אחד מבני המשפחה.
SET QUOTED_IDENTIFIER ON; SET ANSI_NULLS ON;
GO
IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE name='IX_AttemptQuestions_Question' AND object_id=OBJECT_ID('dbo.AttemptQuestions'))
  CREATE INDEX IX_AttemptQuestions_Question ON dbo.AttemptQuestions(QuestionId) INCLUDE(AttemptId, IsCorrect, TimedOut, OptionId, ServedAt, AnsweredAt);
IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE name='IX_AttemptQuestions_AnsweredAt' AND object_id=OBJECT_ID('dbo.AttemptQuestions'))
  CREATE INDEX IX_AttemptQuestions_AnsweredAt ON dbo.AttemptQuestions(AnsweredAt) WHERE AnsweredAt IS NOT NULL;
GO
/*
  תוצאות:
  1) כללי: חציון זמן תשובה, כמה התחילו בשעה האחרונה, גודל דלי הזמן בפועל
  2) משפחות (תוספות): שגוי, פג זמן, הרצף הארוך ביותר
  3) ציר זמן: לכל דלי, מצטבר התחילו/סיימו וזמן תשובה ממוצע בדלי
  4) התפלגות זמני תשובה (שניות)
  5) מפת חום: משפחה × שאלה (נענו, נכון)
  6) לכל שאלה: התשובה השגויה שנבחרה הכי הרבה
*/
CREATE OR ALTER PROC dbo.usp_GetDashboardCharts @BucketMinutes INT=10 AS
BEGIN
  SET NOCOUNT ON;
  DECLARE @now DATETIME2=SYSUTCDATETIME();

  -- תשובות עם זמן (באפליקציה, בזמן)
  SELECT aq.AttemptId, aq.QuestionId, aq.AnsweredAt,
    CAST(DATEDIFF_BIG(MILLISECOND,aq.ServedAt,aq.AnsweredAt)/1000.0 AS FLOAT) AS Sec
  INTO #speed
  FROM dbo.AttemptQuestions aq JOIN dbo.Attempts a ON a.AttemptId=aq.AttemptId
  WHERE a.ExtraSec=0 AND aq.OptionId IS NOT NULL AND aq.TimedOut=0 AND aq.AnsweredAt IS NOT NULL;

  -- דלי זמן: לא יותר מ־48 נקודות על הציר, גם אם המשחק נמשך ימים (בדיקות)
  DECLARE @first DATETIME2=(SELECT MIN(StartedAt) FROM dbo.Attempts);
  DECLARE @last DATETIME2=(SELECT MAX(v) FROM (
      SELECT MAX(StartedAt) FROM dbo.Attempts UNION ALL SELECT MAX(FinishedAt) FROM dbo.Attempts
      UNION ALL SELECT MAX(AnsweredAt) FROM dbo.AttemptQuestions) x(v));
  DECLARE @span INT=ISNULL(DATEDIFF(MINUTE,@first,@last),0);
  DECLARE @bucket INT=CASE WHEN @BucketMinutes<1 THEN 10 ELSE @BucketMinutes END;
  IF @span/@bucket>47 SET @bucket=CEILING(@span/47.0);

  -- 1) כללי
  SELECT
    (SELECT TOP 1 PERCENTILE_CONT(0.5) WITHIN GROUP(ORDER BY Sec) OVER() FROM #speed) AS MedianSec,
    (SELECT COUNT(*) FROM dbo.Attempts WHERE StartedAt>=DATEADD(HOUR,-1,@now)) AS StartedLastHour,
    (SELECT COUNT(*) FROM dbo.Attempts WHERE FinishedAt>=DATEADD(HOUR,-1,@now)) AS FinishedLastHour,
    @bucket AS BucketMinutes;

  -- רצפים: איים של תשובות נכונות ברצף לכל ניסיון
  ;WITH ans AS(
    SELECT aq.AttemptId, aq.Position, aq.IsCorrect,
      aq.Position-ROW_NUMBER() OVER(PARTITION BY aq.AttemptId, aq.IsCorrect ORDER BY aq.Position) AS Grp
    FROM dbo.AttemptQuestions aq WHERE aq.AnsweredAt IS NOT NULL),
  runs AS(
    SELECT AttemptId, COUNT(*) AS Len FROM ans WHERE IsCorrect=1 GROUP BY AttemptId, Grp),
  best AS(
    SELECT AttemptId, MAX(Len) AS Streak FROM runs GROUP BY AttemptId)
  -- 2) משפחות
  SELECT f.FamilyId,
    ISNULL(SUM(CASE WHEN aq.AnsweredAt IS NOT NULL AND ISNULL(aq.IsCorrect,0)=0 AND aq.TimedOut=0 THEN 1 ELSE 0 END),0) AS Wrong,
    ISNULL(SUM(CASE WHEN aq.TimedOut=1 THEN 1 ELSE 0 END),0) AS TimedOut,
    ISNULL(MAX(b.Streak),0) AS MaxStreak
  FROM dbo.Families f
  LEFT JOIN dbo.Guests g ON g.FamilyId=f.FamilyId
  LEFT JOIN dbo.Attempts a ON a.GuestId=g.GuestId
  LEFT JOIN best b ON b.AttemptId=a.AttemptId
  LEFT JOIN dbo.AttemptQuestions aq ON aq.AttemptId=a.AttemptId
  GROUP BY f.FamilyId;

  -- 3) ציר זמן
  IF @first IS NULL
    SELECT CAST(NULL AS DATETIME2) AS BucketStart, 0 AS Started, 0 AS Finished, CAST(NULL AS DECIMAL(9,2)) AS AvgSec WHERE 1=0;
  ELSE
  BEGIN
    DECLARE @start DATETIME2=DATEADD(MINUTE,(DATEDIFF(MINUTE,'2000-01-01',@first)/@bucket)*@bucket,'2000-01-01');
    ;WITH n AS(SELECT TOP (@span/@bucket+2) ROW_NUMBER() OVER(ORDER BY (SELECT NULL))-1 AS i FROM sys.all_objects),
    b AS(SELECT DATEADD(MINUTE,i*@bucket,@start) AS S, DATEADD(MINUTE,(i+1)*@bucket,@start) AS E FROM n)
    SELECT b.S AS BucketStart,
      (SELECT COUNT(*) FROM dbo.Attempts WHERE StartedAt<b.E) AS Started,
      (SELECT COUNT(*) FROM dbo.Attempts WHERE FinishedAt<b.E) AS Finished,
      (SELECT CAST(AVG(Sec) AS DECIMAL(9,2)) FROM #speed WHERE AnsweredAt>=b.S AND AnsweredAt<b.E) AS AvgSec
    FROM b WHERE b.S<=@last ORDER BY b.S;
  END

  -- 4) התפלגות זמני תשובה
  ;WITH bins AS(SELECT * FROM (VALUES
      (1,N'0-4',0,4),(2,N'4-6',4,6),(3,N'6-8',6,8),(4,N'8-10',8,10),
      (5,N'10-12',10,12),(6,N'12-15',12,15),(7,N'15-20',15,20),(8,N'20+',20,100000)) v(Bin,Label,Lo,Hi))
  SELECT bins.Bin, bins.Label, COUNT(s.Sec) AS N
  FROM bins LEFT JOIN #speed s ON s.Sec>=bins.Lo AND s.Sec<bins.Hi
  GROUP BY bins.Bin, bins.Label ORDER BY bins.Bin;

  -- 5) מפת חום
  SELECT g.FamilyId, aq.QuestionId, COUNT(*) AS Answered, SUM(CASE WHEN aq.IsCorrect=1 THEN 1 ELSE 0 END) AS Correct
  FROM dbo.AttemptQuestions aq JOIN dbo.Attempts a ON a.AttemptId=aq.AttemptId JOIN dbo.Guests g ON g.GuestId=a.GuestId
  WHERE aq.AnsweredAt IS NOT NULL
  GROUP BY g.FamilyId, aq.QuestionId;

  -- 6) הטעות הנפוצה בכל שאלה
  ;WITH w AS(
    SELECT aq.QuestionId, aq.OptionId, COUNT(*) AS N,
      ROW_NUMBER() OVER(PARTITION BY aq.QuestionId ORDER BY COUNT(*) DESC, aq.OptionId) AS rn,
      SUM(COUNT(*)) OVER(PARTITION BY aq.QuestionId) AS WrongTotal
    FROM dbo.AttemptQuestions aq
    WHERE aq.AnsweredAt IS NOT NULL AND aq.OptionId IS NOT NULL AND aq.IsCorrect=0 AND aq.TimedOut=0
    GROUP BY aq.QuestionId, aq.OptionId)
  SELECT w.QuestionId, o.Body AS TopWrong, w.N AS TopWrongN, w.WrongTotal
  FROM w JOIN dbo.Options o ON o.OptionId=w.OptionId WHERE w.rn=1;
END
GO
