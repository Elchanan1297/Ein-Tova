-- עין טובה: ניהול. הגדרות (קריאה ושמירה אטומית מ־JSON) וסטטיסטיקת משחק.
-- נדרש לאינדקסים מסוננים (Options, Guests). sqlcmd מכבה את זה כברירת מחדל
SET QUOTED_IDENTIFIER ON; SET ANSI_NULLS ON;
GO
CREATE OR ALTER PROC dbo.usp_AdminGetSettings AS
BEGIN
  SET NOCOUNT ON;
  SELECT SettingKey, SettingValue FROM dbo.Settings ORDER BY SettingKey;
END
GO
/* @Json: {"GameMode":"Window","OpensAt":"2026-12-01T17:00:00Z",...}. רק המפתחות שנשלחו מתעדכנים.
   מחזיר Status: OK | BadKey | BadValue, ו־Field עם המפתח הבעייתי */
CREATE OR ALTER PROC dbo.usp_AdminSaveSettings @Json NVARCHAR(MAX) AS
BEGIN
  SET NOCOUNT ON; SET XACT_ABORT ON;
  IF ISJSON(@Json)<>1 BEGIN SELECT 'BadValue' AS Status, CAST(NULL AS VARCHAR(50)) AS Field; RETURN; END
  DECLARE @s TABLE(k VARCHAR(50) PRIMARY KEY, v NVARCHAR(400) NULL);
  INSERT @s SELECT [key], NULLIF(LTRIM(RTRIM([value])),N'') FROM OPENJSON(@Json);

  DECLARE @bad VARCHAR(50)=(SELECT TOP 1 k FROM @s WHERE k NOT IN
    ('GameMode','OpensAt','ClosesAt','QuestionCount','FactsLabelCount','SecondsPerQuestion','GraceMs','VoiceChance','LeaderboardRank'));
  IF @bad IS NOT NULL BEGIN SELECT 'BadKey' AS Status, @bad AS Field; RETURN; END

  SELECT TOP 1 @bad=k FROM @s WHERE
       (k='GameMode' AND ISNULL(v,'') NOT IN (N'Always',N'Window',N'Closed'))
    OR (k='LeaderboardRank' AND ISNULL(v,'') NOT IN (N'Total',N'Average'))
    OR (k IN ('OpensAt','ClosesAt') AND v IS NOT NULL AND TRY_CONVERT(DATETIME2,v) IS NULL)
    OR (k IN ('QuestionCount','GraceMs') AND (TRY_CONVERT(INT,v) IS NULL OR TRY_CONVERT(INT,v)<0))
    OR (k='SecondsPerQuestion' AND (TRY_CONVERT(INT,v) IS NULL OR TRY_CONVERT(INT,v) NOT BETWEEN 5 AND 300))
    OR (k='FactsLabelCount' AND v IS NOT NULL AND (TRY_CONVERT(INT,v) IS NULL OR TRY_CONVERT(INT,v)<1))
    OR (k='VoiceChance' AND (TRY_CONVERT(FLOAT,v) IS NULL OR TRY_CONVERT(FLOAT,v) NOT BETWEEN 0 AND 1));
  IF @bad IS NOT NULL BEGIN SELECT 'BadValue' AS Status, @bad AS Field; RETURN; END

  BEGIN TRAN;
  UPDATE t SET SettingValue=s.v FROM dbo.Settings t JOIN @s s ON s.k=t.SettingKey;
  -- חלון זמן חייב להיות תקין אחרי השמירה
  IF dbo.fn_Setting('GameMode')=N'Window'
     AND NOT (TRY_CONVERT(DATETIME2,dbo.fn_Setting('OpensAt')) < TRY_CONVERT(DATETIME2,dbo.fn_Setting('ClosesAt')))
  BEGIN ROLLBACK; SELECT 'BadValue' AS Status, CAST('ClosesAt' AS VARCHAR(50)) AS Field; RETURN; END
  INSERT dbo.AdminAudit(Action,Details) VALUES('SaveSettings',LEFT(@Json,400));
  COMMIT;
  SELECT 'OK' AS Status, CAST(NULL AS VARCHAR(50)) AS Field;
END
GO
/* תוצאה 1: סיכום. תוצאה 2: לכל שאלה פעילה, כמה ענו ואחוז הצלחה */
CREATE OR ALTER PROC dbo.usp_AdminGameStats AS
BEGIN
  SET NOCOUNT ON;
  SELECT
    (SELECT COUNT(*) FROM dbo.Guests WHERE IsActive=1) AS Guests,
    (SELECT COUNT(*) FROM dbo.Attempts) AS Started,
    (SELECT COUNT(*) FROM dbo.Attempts WHERE FinishedAt IS NOT NULL) AS Finished,
    (SELECT CAST(ISNULL(AVG(CAST(Score AS FLOAT)),0) AS DECIMAL(9,2)) FROM dbo.Attempts WHERE FinishedAt IS NOT NULL) AS AvgScore,
    (SELECT COUNT(*) FROM dbo.Questions WHERE IsActive=1) AS ActiveQuestions,
    dbo.fn_IsGameOpen() AS IsOpen;
  SELECT q.QuestionId, q.SortOrder, q.Body,
    COUNT(aq.AnsweredAt) AS Answered,
    SUM(CASE WHEN aq.IsCorrect=1 THEN 1 ELSE 0 END) AS Correct,
    SUM(CASE WHEN aq.TimedOut=1 THEN 1 ELSE 0 END) AS TimedOut
  FROM dbo.Questions q LEFT JOIN dbo.AttemptQuestions aq ON aq.QuestionId=q.QuestionId AND aq.AnsweredAt IS NOT NULL
  WHERE q.IsActive=1
  GROUP BY q.QuestionId, q.SortOrder, q.Body
  ORDER BY q.SortOrder, q.QuestionId;
END
GO
