-- עין טובה: איפוס המשחק לכולם (למשל אחרי חזרה גנרלית). מוחק את כל הניסיונות, כך שכל אחד יכול לשחק שוב.
-- נדרש לאינדקסים מסוננים (Options, Guests). sqlcmd מכבה את זה כברירת מחדל
SET QUOTED_IDENTIFIER ON; SET ANSI_NULLS ON;
GO
CREATE OR ALTER PROC dbo.usp_AdminResetAllAttempts AS
BEGIN
  SET NOCOUNT ON; SET XACT_ABORT ON;
  BEGIN TRAN;
  DECLARE @n INT=(SELECT COUNT(*) FROM dbo.Attempts);
  DELETE FROM dbo.Attempts;   -- AttemptQuestions נמחק בקסקדה
  INSERT dbo.AdminAudit(Action,Details) VALUES('ResetAllAttempts',CONCAT(N'Count=',@n));
  COMMIT;
  SELECT 'OK' AS Status, @n AS Reset;
END
GO
