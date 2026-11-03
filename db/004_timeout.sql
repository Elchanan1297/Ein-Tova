-- עין טובה — סגירת שאלה שהזמן שלה נגמר בלי תשובה.
-- נדרש לאינדקסים מסוננים (Options, Guests). sqlcmd מכבה את זה כברירת מחדל
SET QUOTED_IDENTIFIER ON; SET ANSI_NULLS ON;
GO
-- הטלפון קורא לזה כשהטיימר מגיע לאפס, כדי לקבל את התשובה הנכונה והעובדה (אותו מבנה כמו usp_SubmitAnswer).
CREATE OR ALTER PROC dbo.usp_TimeoutQuestion @GuestId INT AS
BEGIN
  SET NOCOUNT ON; SET XACT_ABORT ON;
  DECLARE @a INT,@pos INT,@qid INT,@served DATETIME2,@now DATETIME2=SYSUTCDATETIME();
  DECLARE @def INT=ISNULL(TRY_CONVERT(INT,dbo.fn_Setting('SecondsPerQuestion')),20);
  BEGIN TRAN;
  SELECT @a=AttemptId FROM dbo.Attempts WITH (UPDLOCK,ROWLOCK) WHERE GuestId=@GuestId AND FinishedAt IS NULL;
  IF @a IS NULL BEGIN ROLLBACK; SELECT 'NoActiveAttempt' AS Status; RETURN; END
  SELECT TOP 1 @pos=Position,@qid=QuestionId,@served=ServedAt FROM dbo.AttemptQuestions
   WHERE AttemptId=@a AND AnsweredAt IS NULL ORDER BY Position;
  IF @pos IS NULL OR @served IS NULL BEGIN ROLLBACK; SELECT 'NoActiveQuestion' AS Status; RETURN; END
  DECLARE @limit INT=(SELECT ISNULL(TimeLimitSec,@def) FROM dbo.Questions WHERE QuestionId=@qid);
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
