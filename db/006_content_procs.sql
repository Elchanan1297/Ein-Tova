-- עין טובה: תוכנית הערב וברכות, לקריאה מהאפליקציה.
-- נדרש לאינדקסים מסוננים (Options, Guests). sqlcmd מכבה את זה כברירת מחדל
SET QUOTED_IDENTIFIER ON; SET ANSI_NULLS ON;
GO
CREATE OR ALTER PROC dbo.usp_GetProgram AS
BEGIN
  SET NOCOUNT ON;
  SELECT ItemId, TimeText, Title, Icon FROM dbo.ProgramItems
  WHERE IsActive=1 ORDER BY SortOrder, ItemId;
END
GO
CREATE OR ALTER PROC dbo.usp_GetGreetings AS
BEGIN
  SET NOCOUNT ON;
  SELECT GreetingId, SenderName, Relation, Kind, Body, MediaUrl FROM dbo.Greetings
  WHERE IsActive=1 ORDER BY SortOrder, GreetingId;
END
GO
