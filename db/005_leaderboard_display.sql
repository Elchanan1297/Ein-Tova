-- עין טובה: לוח התוצאות מחזיר גם DisplayScore (סה״כ או ממוצע, לפי LeaderboardRank),
-- נדרש לאינדקסים מסוננים (Options, Guests). sqlcmd מכבה את זה כברירת מחדל
SET QUOTED_IDENTIFIER ON; SET ANSI_NULLS ON;
GO
-- כדי שהאפליקציה תציג את המספר שלפיו מדרגים בלי לדעת את ההגדרה.
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
  SELECT RANK() OVER(ORDER BY CASE WHEN @byAvg=1 THEN AvgScore ELSE TotalScore END DESC, AvgScore DESC) AS Rnk,*,
    CAST(CASE WHEN @byAvg=1 THEN AvgScore ELSE TotalScore END AS DECIMAL(9,2)) AS DisplayScore,
    CASE WHEN @byAvg=1 THEN 'Average' ELSE 'Total' END AS RankBy
  FROM s
  ORDER BY Rnk, Name;
  SELECT TOP 10 g.FullName,f.Name AS FamilyName,a.Score,a.Total
  FROM dbo.Attempts a JOIN dbo.Guests g ON g.GuestId=a.GuestId JOIN dbo.Families f ON f.FamilyId=g.FamilyId
  WHERE a.FinishedAt IS NOT NULL ORDER BY a.Score DESC, a.FinishedAt;
END
GO
