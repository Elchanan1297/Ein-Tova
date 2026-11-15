-- עין טובה: המשחק גם בטלפון כשר (קו של ימות המשיח). בטוח להריץ שוב.
-- בטלפון השאלה והתשובות מוקראות, ולכן שחקן טלפון מקבל זמן נוסף לכל שאלה (IvrExtraSec, ברירת מחדל 30).
-- הזמן הנוסף נשמר על הניסיון (Attempts.ExtraSec), ולכן כל החוקים נשארים בפרוצדורות:
-- usp_NextQuestion, usp_SubmitAnswer ו־usp_TimeoutQuestion מוגדרות כאן מחדש (כמו ב־002/004, רק עם ExtraSec).
-- באפליקציה ExtraSec=0, כלומר אין שום שינוי בהתנהגות.
SET QUOTED_IDENTIFIER ON; SET ANSI_NULLS ON;
GO
IF COL_LENGTH('dbo.Attempts','ExtraSec') IS NULL
  ALTER TABLE dbo.Attempts ADD ExtraSec INT NOT NULL CONSTRAINT DF_Attempts_ExtraSec DEFAULT 0;
GO
IF NOT EXISTS(SELECT 1 FROM dbo.Settings WHERE SettingKey='IvrExtraSec')
  INSERT dbo.Settings(SettingKey,SettingValue,Note) VALUES('IvrExtraSec',N'30',N'שניות נוספות לשאלה למי שמשחק בטלפון (ההקראה לוקחת זמן)');
GO
/* הניסיון של המוזמן עובר לטלפון: מקבל את הזמן הנוסף (רק ניסיון שעוד לא נגמר) */
CREATE OR ALTER PROC dbo.usp_PhoneJoinAttempt @GuestId INT AS
BEGIN
  SET NOCOUNT ON;
  DECLARE @extra INT=ISNULL(TRY_CONVERT(INT,dbo.fn_Setting('IvrExtraSec')),30);
  UPDATE dbo.Attempts SET ExtraSec=@extra WHERE GuestId=@GuestId AND FinishedAt IS NULL;
  SELECT @@ROWCOUNT AS Updated;
END
GO
/* מחזיר את השאלה הנוכחית (ומתחיל את הטיימר בשרת). תוצאות: 1) סטטוס 2) שאלה 3) תשובות ללא IsCorrect */
CREATE OR ALTER PROC dbo.usp_NextQuestion @GuestId INT AS
BEGIN
  SET NOCOUNT ON; SET XACT_ABORT ON;
  DECLARE @a INT,@total INT,@fin DATETIME2,@score INT,@extra INT;
  SELECT @a=AttemptId,@total=Total,@fin=FinishedAt,@score=Score,@extra=ExtraSec FROM dbo.Attempts WHERE GuestId=@GuestId;
  IF @a IS NULL BEGIN SELECT 'NoAttempt' AS Status; RETURN; END
  IF @fin IS NOT NULL BEGIN SELECT 'Finished' AS Status,@score AS Score,@total AS Total; RETURN; END
  IF dbo.fn_IsGameOpen()=0 BEGIN SELECT 'Closed' AS Status,@score AS Score,@total AS Total; RETURN; END
  DECLARE @grace INT=ISNULL(TRY_CONVERT(INT,dbo.fn_Setting('GraceMs')),1500);
  DECLARE @def INT=ISNULL(TRY_CONVERT(INT,dbo.fn_Setting('SecondsPerQuestion')),20);
  DECLARE @now DATETIME2=SYSUTCDATETIME(), @pos INT, @qid INT, @limit INT, @served DATETIME2;
  BEGIN TRAN;
  SELECT @a=AttemptId,@extra=ExtraSec FROM dbo.Attempts WITH (UPDLOCK,ROWLOCK) WHERE GuestId=@GuestId;
  UPDATE aq SET AnsweredAt=@now, TimedOut=1, IsCorrect=0   -- שאלה שהזמן שלה פג נסגרת
  FROM dbo.AttemptQuestions aq JOIN dbo.Questions q ON q.QuestionId=aq.QuestionId
  WHERE aq.AttemptId=@a AND aq.ServedAt IS NOT NULL AND aq.AnsweredAt IS NULL
    AND DATEDIFF_BIG(MILLISECOND,aq.ServedAt,@now) > (ISNULL(q.TimeLimitSec,@def)+@extra)*1000+@grace;
  SELECT @pos=MIN(Position) FROM dbo.AttemptQuestions WHERE AttemptId=@a AND AnsweredAt IS NULL;
  IF @pos IS NULL
  BEGIN
    UPDATE dbo.Attempts SET FinishedAt=@now WHERE AttemptId=@a AND FinishedAt IS NULL;
    COMMIT;
    SELECT 'Finished' AS Status, Score, Total FROM dbo.Attempts WHERE AttemptId=@a; RETURN;
  END
  UPDATE dbo.AttemptQuestions SET ServedAt=ISNULL(ServedAt,@now) WHERE AttemptId=@a AND Position=@pos;
  SELECT @qid=aq.QuestionId, @served=aq.ServedAt, @limit=ISNULL(q.TimeLimitSec,@def)+@extra
  FROM dbo.AttemptQuestions aq JOIN dbo.Questions q ON q.QuestionId=aq.QuestionId WHERE aq.AttemptId=@a AND aq.Position=@pos;
  COMMIT;
  SELECT 'InProgress' AS Status, @pos AS Position, @total AS Total, @score AS Score, @limit AS LimitSec,
    CASE WHEN @limit-DATEDIFF(SECOND,@served,@now)<0 THEN 0 ELSE @limit-DATEDIFF(SECOND,@served,@now) END AS SecondsLeft,
    q.QuestionId, q.Body, q.ImageUrl FROM dbo.Questions q WHERE q.QuestionId=@qid;
  SELECT o.OptionId, o.Body FROM dbo.Options o WHERE o.QuestionId=@qid
  ORDER BY CHECKSUM(CONCAT(@a,'-',o.OptionId));      -- סדר אקראי קבוע לשחקן
END
GO
CREATE OR ALTER PROC dbo.usp_SubmitAnswer @GuestId INT, @OptionId INT AS
BEGIN
  SET NOCOUNT ON; SET XACT_ABORT ON;
  DECLARE @a INT,@pos INT,@qid INT,@served DATETIME2,@extra INT,@now DATETIME2=SYSUTCDATETIME();
  DECLARE @grace INT=ISNULL(TRY_CONVERT(INT,dbo.fn_Setting('GraceMs')),1500);
  DECLARE @def INT=ISNULL(TRY_CONVERT(INT,dbo.fn_Setting('SecondsPerQuestion')),20);
  BEGIN TRAN;
  SELECT @a=AttemptId,@extra=ExtraSec FROM dbo.Attempts WITH (UPDLOCK,ROWLOCK) WHERE GuestId=@GuestId AND FinishedAt IS NULL;
  IF @a IS NULL BEGIN ROLLBACK; SELECT 'NoActiveAttempt' AS Status; RETURN; END
  SELECT TOP 1 @pos=Position,@qid=QuestionId,@served=ServedAt FROM dbo.AttemptQuestions
   WHERE AttemptId=@a AND AnsweredAt IS NULL ORDER BY Position;
  IF @pos IS NULL OR @served IS NULL BEGIN ROLLBACK; SELECT 'NoActiveQuestion' AS Status; RETURN; END
  IF NOT EXISTS(SELECT 1 FROM dbo.Options WHERE OptionId=@OptionId AND QuestionId=@qid) BEGIN ROLLBACK; SELECT 'BadOption' AS Status; RETURN; END
  DECLARE @limit INT=(SELECT ISNULL(TimeLimitSec,@def) FROM dbo.Questions WHERE QuestionId=@qid)+@extra;
  DECLARE @late BIT=CASE WHEN DATEDIFF_BIG(MILLISECOND,@served,@now)>@limit*1000+@grace THEN 1 ELSE 0 END;
  DECLARE @ok BIT=CASE WHEN @late=1 THEN 0 ELSE (SELECT IsCorrect FROM dbo.Options WHERE OptionId=@OptionId) END;
  UPDATE dbo.AttemptQuestions SET AnsweredAt=@now,OptionId=@OptionId,IsCorrect=@ok,TimedOut=@late WHERE AttemptId=@a AND Position=@pos;
  UPDATE dbo.Attempts SET Score=Score+CAST(@ok AS INT) WHERE AttemptId=@a;
  DECLARE @done BIT=CASE WHEN EXISTS(SELECT 1 FROM dbo.AttemptQuestions WHERE AttemptId=@a AND AnsweredAt IS NULL) THEN 0 ELSE 1 END;
  IF @done=1 UPDATE dbo.Attempts SET FinishedAt=@now WHERE AttemptId=@a;
  COMMIT;
  SELECT 'OK' AS Status, @ok AS IsCorrect, @late AS TimedOut,
    (SELECT OptionId FROM dbo.Options WHERE QuestionId=@qid AND IsCorrect=1) AS CorrectOptionId,
    (SELECT Fact FROM dbo.Questions WHERE QuestionId=@qid) AS Fact,
    Score, Total, @done AS IsFinished FROM dbo.Attempts WHERE AttemptId=@a;
END
GO
CREATE OR ALTER PROC dbo.usp_TimeoutQuestion @GuestId INT AS
BEGIN
  SET NOCOUNT ON; SET XACT_ABORT ON;
  DECLARE @a INT,@pos INT,@qid INT,@served DATETIME2,@extra INT,@now DATETIME2=SYSUTCDATETIME();
  DECLARE @def INT=ISNULL(TRY_CONVERT(INT,dbo.fn_Setting('SecondsPerQuestion')),20);
  BEGIN TRAN;
  SELECT @a=AttemptId,@extra=ExtraSec FROM dbo.Attempts WITH (UPDLOCK,ROWLOCK) WHERE GuestId=@GuestId AND FinishedAt IS NULL;
  IF @a IS NULL BEGIN ROLLBACK; SELECT 'NoActiveAttempt' AS Status; RETURN; END
  SELECT TOP 1 @pos=Position,@qid=QuestionId,@served=ServedAt FROM dbo.AttemptQuestions
   WHERE AttemptId=@a AND AnsweredAt IS NULL ORDER BY Position;
  IF @pos IS NULL OR @served IS NULL BEGIN ROLLBACK; SELECT 'NoActiveQuestion' AS Status; RETURN; END
  DECLARE @limit INT=(SELECT ISNULL(TimeLimitSec,@def) FROM dbo.Questions WHERE QuestionId=@qid)+@extra;
  -- אי אפשר "לדלג" כדי לראות את התשובה לפני שהזמן נגמר (שנייה סובלנות לשעון הטלפון)
  IF DATEDIFF_BIG(MILLISECOND,@served,@now) < @limit*1000-1000 BEGIN ROLLBACK; SELECT 'TooEarly' AS Status; RETURN; END
  UPDATE dbo.AttemptQuestions SET AnsweredAt=@now,IsCorrect=0,TimedOut=1 WHERE AttemptId=@a AND Position=@pos;
  DECLARE @done BIT=CASE WHEN EXISTS(SELECT 1 FROM dbo.AttemptQuestions WHERE AttemptId=@a AND AnsweredAt IS NULL) THEN 0 ELSE 1 END;
  IF @done=1 UPDATE dbo.Attempts SET FinishedAt=@now WHERE AttemptId=@a;
  COMMIT;
  SELECT 'OK' AS Status, CAST(0 AS BIT) AS IsCorrect, CAST(1 AS BIT) AS TimedOut,
    (SELECT OptionId FROM dbo.Options WHERE QuestionId=@qid AND IsCorrect=1) AS CorrectOptionId,
    (SELECT Fact FROM dbo.Questions WHERE QuestionId=@qid) AS Fact,
    Score, Total, @done AS IsFinished FROM dbo.Attempts WHERE AttemptId=@a;
END
GO
/* כמו ב־009, ועוד IvrExtraSec (0 עד 300) */
CREATE OR ALTER PROC dbo.usp_AdminSaveSettings @Json NVARCHAR(MAX) AS
BEGIN
  SET NOCOUNT ON; SET XACT_ABORT ON;
  IF ISJSON(@Json)<>1 BEGIN SELECT 'BadValue' AS Status, CAST(NULL AS VARCHAR(50)) AS Field; RETURN; END
  DECLARE @s TABLE(k VARCHAR(50) PRIMARY KEY, v NVARCHAR(400) NULL);
  INSERT @s SELECT [key], NULLIF(LTRIM(RTRIM([value])),N'') FROM OPENJSON(@Json);

  DECLARE @bad VARCHAR(50)=(SELECT TOP 1 k FROM @s WHERE k NOT IN
    ('GameMode','OpensAt','ClosesAt','QuestionCount','FactsLabelCount','SecondsPerQuestion','GraceMs','VoiceChance','LeaderboardRank','IvrExtraSec'));
  IF @bad IS NOT NULL BEGIN SELECT 'BadKey' AS Status, @bad AS Field; RETURN; END

  SELECT TOP 1 @bad=k FROM @s WHERE
       (k='GameMode' AND ISNULL(v,'') NOT IN (N'Always',N'Window',N'Closed'))
    OR (k='LeaderboardRank' AND ISNULL(v,'') NOT IN (N'Total',N'Average'))
    OR (k IN ('OpensAt','ClosesAt') AND v IS NOT NULL AND TRY_CONVERT(DATETIME2,v) IS NULL)
    OR (k IN ('QuestionCount','GraceMs') AND (TRY_CONVERT(INT,v) IS NULL OR TRY_CONVERT(INT,v)<0))
    OR (k='SecondsPerQuestion' AND (TRY_CONVERT(INT,v) IS NULL OR TRY_CONVERT(INT,v) NOT BETWEEN 5 AND 300))
    OR (k='IvrExtraSec' AND (TRY_CONVERT(INT,v) IS NULL OR TRY_CONVERT(INT,v) NOT BETWEEN 0 AND 300))
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
