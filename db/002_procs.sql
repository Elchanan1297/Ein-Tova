/* עין טובה — פונקציות ופרוצדורות. אפשר להריץ שוב ושוב (CREATE OR ALTER). */
SET NOCOUNT ON;
GO
CREATE OR ALTER FUNCTION dbo.fn_Setting(@k VARCHAR(50)) RETURNS NVARCHAR(400) AS
BEGIN RETURN (SELECT SettingValue FROM dbo.Settings WHERE SettingKey=@k); END
GO
CREATE OR ALTER FUNCTION dbo.fn_NormalizePhone(@p NVARCHAR(40)) RETURNS VARCHAR(15) AS
BEGIN
  IF @p IS NULL RETURN NULL;
  DECLARE @d NVARCHAR(40)=REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(@p,'-',''),' ',''),'+',''),'(',''),')','');
  IF LEFT(@d,3)='972' SET @d='0'+SUBSTRING(@d,4,40);
  RETURN NULLIF(CAST(@d AS VARCHAR(15)),'');
END
GO
CREATE OR ALTER FUNCTION dbo.fn_IsGameOpen() RETURNS BIT AS
BEGIN
  DECLARE @m NVARCHAR(400)=dbo.fn_Setting('GameMode'), @r BIT=0, @now DATETIME2=SYSUTCDATETIME();
  IF @m=N'Always' SET @r=1;
  ELSE IF @m=N'Window'
       AND @now >= TRY_CONVERT(DATETIME2,dbo.fn_Setting('OpensAt'))
       AND @now <  TRY_CONVERT(DATETIME2,dbo.fn_Setting('ClosesAt')) SET @r=1;
  RETURN @r;
END
GO
CREATE OR ALTER FUNCTION dbo.fn_EffectiveQuestionCount() RETURNS INT AS
BEGIN
  DECLARE @active INT=(SELECT COUNT(*) FROM dbo.Questions q WHERE q.IsActive=1
      AND (SELECT COUNT(*) FROM dbo.Options o WHERE o.QuestionId=q.QuestionId)>=2
      AND EXISTS(SELECT 1 FROM dbo.Options o WHERE o.QuestionId=q.QuestionId AND o.IsCorrect=1));
  DECLARE @req INT=ISNULL(TRY_CONVERT(INT,dbo.fn_Setting('QuestionCount')),0);
  RETURN CASE WHEN @req<=0 OR @req>@active THEN @active ELSE @req END;
END
GO
CREATE OR ALTER PROC dbo.usp_GetPublicConfig AS
BEGIN
  SET NOCOUNT ON;
  DECLARE @n INT=dbo.fn_EffectiveQuestionCount();
  SELECT dbo.fn_IsGameOpen() AS IsOpen, dbo.fn_Setting('GameMode') AS GameMode,
    dbo.fn_Setting('OpensAt') AS OpensAt, dbo.fn_Setting('ClosesAt') AS ClosesAt,
    @n AS QuestionCount,
    ISNULL(TRY_CONVERT(INT,NULLIF(dbo.fn_Setting('FactsLabelCount'),'')),@n) AS FactsLabelCount,
    ISNULL(TRY_CONVERT(INT,dbo.fn_Setting('SecondsPerQuestion')),20) AS SecondsPerQuestion,
    ISNULL(TRY_CONVERT(FLOAT,dbo.fn_Setting('VoiceChance')),0.34) AS VoiceChance;
END
GO
CREATE OR ALTER PROC dbo.usp_LoginByCode @Code VARCHAR(16) AS
BEGIN
  SET NOCOUNT ON;
  DECLARE @id INT=(SELECT GuestId FROM dbo.Guests WHERE Code=@Code AND IsActive=1);
  IF @id IS NOT NULL UPDATE dbo.Guests SET LastSeenAt=SYSUTCDATETIME() WHERE GuestId=@id;
  SELECT g.GuestId, g.FullName, g.FamilyId, f.Name AS FamilyName
  FROM dbo.Guests g JOIN dbo.Families f ON f.FamilyId=g.FamilyId WHERE g.GuestId=@id;
END
GO
CREATE OR ALTER PROC dbo.usp_LoginByPhone @Phone NVARCHAR(40) AS
BEGIN
  SET NOCOUNT ON;
  DECLARE @p VARCHAR(15)=dbo.fn_NormalizePhone(@Phone);
  DECLARE @id INT=(SELECT GuestId FROM dbo.Guests WHERE Phone=@p AND IsActive=1);
  IF @id IS NOT NULL UPDATE dbo.Guests SET LastSeenAt=SYSUTCDATETIME() WHERE GuestId=@id;
  SELECT g.GuestId, g.FullName, g.FamilyId, f.Name AS FamilyName, g.Code
  FROM dbo.Guests g JOIN dbo.Families f ON f.FamilyId=g.FamilyId WHERE g.GuestId=@id;
END
GO
CREATE OR ALTER PROC dbo.usp_StartAttempt @GuestId INT AS
BEGIN
  SET NOCOUNT ON; SET XACT_ABORT ON;
  IF dbo.fn_IsGameOpen()=0 BEGIN SELECT 'Closed' AS Status; RETURN; END
  IF EXISTS(SELECT 1 FROM dbo.Attempts WHERE GuestId=@GuestId) BEGIN SELECT 'AlreadyStarted' AS Status; RETURN; END
  DECLARE @n INT=dbo.fn_EffectiveQuestionCount();
  IF @n=0 BEGIN SELECT 'NoQuestions' AS Status; RETURN; END
  BEGIN TRY
    BEGIN TRAN;
    INSERT dbo.Attempts(GuestId,Total) VALUES(@GuestId,@n);
    DECLARE @a INT=SCOPE_IDENTITY();
    INSERT dbo.AttemptQuestions(AttemptId,Position,QuestionId)
    SELECT @a, ROW_NUMBER() OVER(ORDER BY NEWID()), q.QuestionId
    FROM (SELECT TOP (@n) QuestionId FROM dbo.Questions q WHERE q.IsActive=1
          AND (SELECT COUNT(*) FROM dbo.Options o WHERE o.QuestionId=q.QuestionId)>=2
          AND EXISTS(SELECT 1 FROM dbo.Options o WHERE o.QuestionId=q.QuestionId AND o.IsCorrect=1)
          ORDER BY q.SortOrder, q.QuestionId) q;
    COMMIT;
    SELECT 'OK' AS Status, @a AS AttemptId, @n AS Total;
  END TRY
  BEGIN CATCH
    IF @@TRANCOUNT>0 ROLLBACK;
    IF ERROR_NUMBER() IN (2601,2627) BEGIN SELECT 'AlreadyStarted' AS Status; RETURN; END;
    THROW;
  END CATCH
END
GO
/* מחזיר את השאלה הנוכחית (ומתחיל את הטיימר בשרת). תוצאות: 1) סטטוס 2) שאלה 3) תשובות ללא IsCorrect */
CREATE OR ALTER PROC dbo.usp_NextQuestion @GuestId INT AS
BEGIN
  SET NOCOUNT ON; SET XACT_ABORT ON;
  DECLARE @a INT,@total INT,@fin DATETIME2,@score INT;
  SELECT @a=AttemptId,@total=Total,@fin=FinishedAt,@score=Score FROM dbo.Attempts WHERE GuestId=@GuestId;
  IF @a IS NULL BEGIN SELECT 'NoAttempt' AS Status; RETURN; END
  IF @fin IS NOT NULL BEGIN SELECT 'Finished' AS Status,@score AS Score,@total AS Total; RETURN; END
  IF dbo.fn_IsGameOpen()=0 BEGIN SELECT 'Closed' AS Status,@score AS Score,@total AS Total; RETURN; END
  DECLARE @grace INT=ISNULL(TRY_CONVERT(INT,dbo.fn_Setting('GraceMs')),1500);
  DECLARE @def INT=ISNULL(TRY_CONVERT(INT,dbo.fn_Setting('SecondsPerQuestion')),20);
  DECLARE @now DATETIME2=SYSUTCDATETIME(), @pos INT, @qid INT, @limit INT, @served DATETIME2;
  BEGIN TRAN;
  SELECT @a=AttemptId FROM dbo.Attempts WITH (UPDLOCK,ROWLOCK) WHERE GuestId=@GuestId;
  UPDATE aq SET AnsweredAt=@now, TimedOut=1, IsCorrect=0   -- שאלה שהזמן שלה פג נסגרת
  FROM dbo.AttemptQuestions aq JOIN dbo.Questions q ON q.QuestionId=aq.QuestionId
  WHERE aq.AttemptId=@a AND aq.ServedAt IS NOT NULL AND aq.AnsweredAt IS NULL
    AND DATEDIFF_BIG(MILLISECOND,aq.ServedAt,@now) > ISNULL(q.TimeLimitSec,@def)*1000+@grace;
  SELECT @pos=MIN(Position) FROM dbo.AttemptQuestions WHERE AttemptId=@a AND AnsweredAt IS NULL;
  IF @pos IS NULL
  BEGIN
    UPDATE dbo.Attempts SET FinishedAt=@now WHERE AttemptId=@a AND FinishedAt IS NULL;
    COMMIT;
    SELECT 'Finished' AS Status, Score, Total FROM dbo.Attempts WHERE AttemptId=@a; RETURN;
  END
  UPDATE dbo.AttemptQuestions SET ServedAt=ISNULL(ServedAt,@now) WHERE AttemptId=@a AND Position=@pos;
  SELECT @qid=aq.QuestionId, @served=aq.ServedAt, @limit=ISNULL(q.TimeLimitSec,@def)
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
  DECLARE @a INT,@pos INT,@qid INT,@served DATETIME2,@now DATETIME2=SYSUTCDATETIME();
  DECLARE @grace INT=ISNULL(TRY_CONVERT(INT,dbo.fn_Setting('GraceMs')),1500);
  DECLARE @def INT=ISNULL(TRY_CONVERT(INT,dbo.fn_Setting('SecondsPerQuestion')),20);
  BEGIN TRAN;
  SELECT @a=AttemptId FROM dbo.Attempts WITH (UPDLOCK,ROWLOCK) WHERE GuestId=@GuestId AND FinishedAt IS NULL;
  IF @a IS NULL BEGIN ROLLBACK; SELECT 'NoActiveAttempt' AS Status; RETURN; END
  SELECT TOP 1 @pos=Position,@qid=QuestionId,@served=ServedAt FROM dbo.AttemptQuestions
   WHERE AttemptId=@a AND AnsweredAt IS NULL ORDER BY Position;
  IF @pos IS NULL OR @served IS NULL BEGIN ROLLBACK; SELECT 'NoActiveQuestion' AS Status; RETURN; END
  IF NOT EXISTS(SELECT 1 FROM dbo.Options WHERE OptionId=@OptionId AND QuestionId=@qid) BEGIN ROLLBACK; SELECT 'BadOption' AS Status; RETURN; END
  DECLARE @limit INT=(SELECT ISNULL(TimeLimitSec,@def) FROM dbo.Questions WHERE QuestionId=@qid);
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
/* תוצאה 1: משפחות. תוצאה 2: עשרת המובילים */
CREATE OR ALTER PROC dbo.usp_GetLeaderboard AS
BEGIN
  SET NOCOUNT ON;
  DECLARE @byAvg BIT=CASE WHEN dbo.fn_Setting('LeaderboardRank')=N'Average' THEN 1 ELSE 0 END;
  ;WITH s AS(
    SELECT f.FamilyId,f.Name,
      ISNULL(SUM(a.Score),0) AS TotalScore, COUNT(a.AttemptId) AS Players,
      COUNT(a.FinishedAt) AS Finished,
      CAST(ISNULL(AVG(CAST(a.Score AS FLOAT)),0) AS DECIMAL(9,2)) AS AvgScore, MIN(a.FinishedAt) AS FirstFinish
    FROM dbo.Families f LEFT JOIN dbo.Guests g ON g.FamilyId=f.FamilyId
    LEFT JOIN dbo.Attempts a ON a.GuestId=g.GuestId GROUP BY f.FamilyId,f.Name)
  SELECT RANK() OVER(ORDER BY CASE WHEN @byAvg=1 THEN AvgScore ELSE TotalScore END DESC, AvgScore DESC) AS Rnk,* FROM s
  ORDER BY Rnk, Name;
  SELECT TOP 10 g.FullName,f.Name AS FamilyName,a.Score,a.Total
  FROM dbo.Attempts a JOIN dbo.Guests g ON g.GuestId=a.GuestId JOIN dbo.Families f ON f.FamilyId=g.FamilyId
  WHERE a.FinishedAt IS NOT NULL ORDER BY a.Score DESC, a.FinishedAt;
END
GO
CREATE OR ALTER PROC dbo.usp_GetVoiceClip @EventType VARCHAR(20) AS
BEGIN
  SET NOCOUNT ON;
  SELECT TOP 1 ClipId,FileUrl,Transcript FROM dbo.VoiceClips WHERE EventType=@EventType AND IsActive=1 ORDER BY NEWID();
END
GO
CREATE OR ALTER PROC dbo.usp_AdminResetAttempt @GuestId INT AS
BEGIN
  SET NOCOUNT ON;
  DELETE FROM dbo.Attempts WHERE GuestId=@GuestId;    -- AttemptQuestions נמחק בקסקדה
  INSERT dbo.AdminAudit(Action,Details) VALUES('ResetAttempt',CONCAT(N'GuestId=',@GuestId));
END
GO
