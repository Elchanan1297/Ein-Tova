-- עין טובה: ניהול שאלות. רשימה, שמירה (חדשה/עדכון), מחיקה, סדר, ייבוא.
-- נדרש לאינדקסים מסוננים (Options, Guests). sqlcmd מכבה את זה כברירת מחדל
SET QUOTED_IDENTIFIER ON; SET ANSI_NULLS ON;
GO
/* תוצאה 1: שאלות (כולל לא פעילות). תוצאה 2: תשובות */
CREATE OR ALTER PROC dbo.usp_AdminListQuestions AS
BEGIN
  SET NOCOUNT ON;
  SELECT q.QuestionId, q.SortOrder, q.Body, q.ImageUrl, q.Fact, q.TimeLimitSec, q.IsActive,
    CAST(CASE WHEN EXISTS(SELECT 1 FROM dbo.AttemptQuestions aq WHERE aq.QuestionId=q.QuestionId) THEN 1 ELSE 0 END AS BIT) AS InUse
  FROM dbo.Questions q ORDER BY q.SortOrder, q.QuestionId;
  SELECT OptionId, QuestionId, Body, IsCorrect, SortOrder FROM dbo.Options ORDER BY QuestionId, SortOrder, OptionId;
END
GO
/* @Json: {"questionId":null|N,"body":"...","imageUrl":null,"fact":null,"timeLimitSec":null,"isActive":true,
           "options":[{"optionId":null|N,"body":"...","isCorrect":true},...]}
   מחזיר Status: OK | BadValue | NotFound, Field, QuestionId */
CREATE OR ALTER PROC dbo.usp_AdminSaveQuestion @Json NVARCHAR(MAX) AS
BEGIN
  SET NOCOUNT ON; SET XACT_ABORT ON;
  IF ISJSON(@Json)<>1 BEGIN SELECT 'BadValue' AS Status, CAST(NULL AS VARCHAR(30)) AS Field, CAST(NULL AS INT) AS QuestionId; RETURN; END

  DECLARE @qid INT, @body NVARCHAR(500), @img NVARCHAR(400), @fact NVARCHAR(600), @limit INT, @active BIT;
  SELECT @qid=questionId, @body=NULLIF(LTRIM(RTRIM(body)),N''), @img=NULLIF(LTRIM(RTRIM(imageUrl)),N''),
         @fact=NULLIF(LTRIM(RTRIM(fact)),N''), @limit=timeLimitSec, @active=ISNULL(isActive,1)
  FROM OPENJSON(@Json) WITH (questionId INT, body NVARCHAR(600), imageUrl NVARCHAR(500), fact NVARCHAR(700), timeLimitSec INT, isActive BIT);

  DECLARE @o TABLE(n INT IDENTITY, OptionId INT NULL, Body NVARCHAR(200) NULL, IsCorrect BIT NOT NULL);
  INSERT @o(OptionId,Body,IsCorrect)
  SELECT optionId, NULLIF(LTRIM(RTRIM(body)),N''), ISNULL(isCorrect,0)
  FROM OPENJSON(@Json,'$.options') WITH (optionId INT, body NVARCHAR(300), isCorrect BIT);

  DECLARE @field VARCHAR(30)=CASE
    WHEN @body IS NULL OR LEN(@body)>500 THEN 'body'
    WHEN LEN(@fact)>600 THEN 'fact'
    WHEN @limit IS NOT NULL AND @limit NOT BETWEEN 5 AND 300 THEN 'timeLimitSec'
    WHEN (SELECT COUNT(*) FROM @o) NOT BETWEEN 2 AND 6 THEN 'options'
    WHEN EXISTS(SELECT 1 FROM @o WHERE Body IS NULL OR LEN(Body)>200) THEN 'options'
    WHEN (SELECT COUNT(*) FROM @o WHERE IsCorrect=1)<>1 THEN 'correct'
  END;
  IF @field IS NOT NULL BEGIN SELECT 'BadValue' AS Status, @field AS Field, @qid AS QuestionId; RETURN; END
  IF @qid IS NOT NULL AND NOT EXISTS(SELECT 1 FROM dbo.Questions WHERE QuestionId=@qid)
  BEGIN SELECT 'NotFound' AS Status, CAST(NULL AS VARCHAR(30)) AS Field, @qid AS QuestionId; RETURN; END

  BEGIN TRAN;
  IF @qid IS NULL
  BEGIN
    INSERT dbo.Questions(SortOrder,Body,ImageUrl,Fact,TimeLimitSec,IsActive)
    VALUES(ISNULL((SELECT MAX(SortOrder) FROM dbo.Questions),0)+1,@body,@img,@fact,@limit,@active);
    SET @qid=SCOPE_IDENTITY();
  END
  ELSE
    UPDATE dbo.Questions SET Body=@body,ImageUrl=@img,Fact=@fact,TimeLimitSec=@limit,IsActive=@active WHERE QuestionId=@qid;

  -- תשובות: מוחקים את מה שהוסר, מאפסים "נכונה" (אינדקס ייחודי), מעדכנים ומוסיפים
  DELETE FROM dbo.Options WHERE QuestionId=@qid AND OptionId NOT IN (SELECT OptionId FROM @o WHERE OptionId IS NOT NULL);
  UPDATE dbo.Options SET IsCorrect=0 WHERE QuestionId=@qid;
  UPDATE x SET Body=o.Body, SortOrder=o.n FROM dbo.Options x JOIN @o o ON o.OptionId=x.OptionId WHERE x.QuestionId=@qid;
  INSERT dbo.Options(QuestionId,Body,IsCorrect,SortOrder) SELECT @qid,Body,0,n FROM @o
   WHERE OptionId IS NULL OR OptionId NOT IN (SELECT OptionId FROM dbo.Options WHERE QuestionId=@qid);
  UPDATE x SET IsCorrect=1 FROM dbo.Options x
   WHERE x.QuestionId=@qid AND x.SortOrder=(SELECT n FROM @o WHERE IsCorrect=1);
  INSERT dbo.AdminAudit(Action,Details) VALUES('SaveQuestion',CONCAT(N'QuestionId=',@qid));
  COMMIT;
  SELECT 'OK' AS Status, CAST(NULL AS VARCHAR(30)) AS Field, @qid AS QuestionId;
END
GO
/* שאלה שכבר הוגשה לשחקן לא נמחקת (היסטוריה וניקוד): Status=InUse, ואז אפשר רק להשבית */
CREATE OR ALTER PROC dbo.usp_AdminDeleteQuestion @QuestionId INT AS
BEGIN
  SET NOCOUNT ON;
  IF EXISTS(SELECT 1 FROM dbo.AttemptQuestions WHERE QuestionId=@QuestionId) BEGIN SELECT 'InUse' AS Status; RETURN; END
  DELETE FROM dbo.Questions WHERE QuestionId=@QuestionId;
  IF @@ROWCOUNT=0 BEGIN SELECT 'NotFound' AS Status; RETURN; END
  INSERT dbo.AdminAudit(Action,Details) VALUES('DeleteQuestion',CONCAT(N'QuestionId=',@QuestionId));
  SELECT 'OK' AS Status;
END
GO
/* @Json: [5,2,7,...] מזהי שאלות בסדר החדש */
CREATE OR ALTER PROC dbo.usp_AdminReorderQuestions @Json NVARCHAR(MAX) AS
BEGIN
  SET NOCOUNT ON;
  IF ISJSON(@Json)<>1 BEGIN SELECT 'BadValue' AS Status; RETURN; END
  UPDATE q SET SortOrder=CAST(j.[key] AS INT)+1
  FROM dbo.Questions q JOIN OPENJSON(@Json) j ON TRY_CONVERT(INT,j.[value])=q.QuestionId;
  SELECT 'OK' AS Status;
END
GO
/* @Json: [{"body":"...","correct":"...","wrong":["..",".."],"fact":null,"timeLimitSec":null},...]
   הכול או כלום. מחזיר Status, Imported, BadRow (מספר שורה מ־1) */
CREATE OR ALTER PROC dbo.usp_AdminImportQuestions @Json NVARCHAR(MAX) AS
BEGIN
  SET NOCOUNT ON; SET XACT_ABORT ON;
  IF ISJSON(@Json)<>1 BEGIN SELECT 'BadValue' AS Status, 0 AS Imported, CAST(NULL AS INT) AS BadRow; RETURN; END
  DECLARE @r TABLE(n INT PRIMARY KEY, Body NVARCHAR(600), Correct NVARCHAR(300), Fact NVARCHAR(700), Limit INT, Wrong NVARCHAR(MAX));
  INSERT @r SELECT CAST(j.[key] AS INT)+1, NULLIF(LTRIM(RTRIM(x.body)),N''), NULLIF(LTRIM(RTRIM(x.correct)),N''),
    NULLIF(LTRIM(RTRIM(x.fact)),N''), x.timeLimitSec, x.wrong
  FROM OPENJSON(@Json) j CROSS APPLY OPENJSON(j.[value]) WITH (body NVARCHAR(600), correct NVARCHAR(300), fact NVARCHAR(700), timeLimitSec INT, wrong NVARCHAR(MAX) AS JSON) x;
  DECLARE @w TABLE(n INT, k INT, Body NVARCHAR(300));
  INSERT @w SELECT r.n, CAST(w.[key] AS INT), NULLIF(LTRIM(RTRIM(w.[value])),N'') FROM @r r CROSS APPLY OPENJSON(r.Wrong) w;
  DELETE FROM @w WHERE Body IS NULL;   -- עמודות ריקות של תשובות שגויות לא נחשבות

  DECLARE @bad INT=(SELECT MIN(r.n) FROM @r r WHERE r.Body IS NULL OR LEN(r.Body)>500 OR r.Correct IS NULL OR LEN(r.Correct)>200
     OR LEN(r.Fact)>600 OR (r.Limit IS NOT NULL AND r.Limit NOT BETWEEN 5 AND 300)
     OR (SELECT COUNT(*) FROM @w w WHERE w.n=r.n) NOT BETWEEN 1 AND 5
     OR EXISTS(SELECT 1 FROM @w w WHERE w.n=r.n AND LEN(w.Body)>200));
  IF @bad IS NOT NULL OR NOT EXISTS(SELECT 1 FROM @r)
  BEGIN SELECT 'BadValue' AS Status, 0 AS Imported, @bad AS BadRow; RETURN; END

  BEGIN TRAN;
  DECLARE @base INT=ISNULL((SELECT MAX(SortOrder) FROM dbo.Questions),0);
  DECLARE @map TABLE(n INT, QuestionId INT);
  MERGE dbo.Questions AS t USING @r AS s ON 1=0
  WHEN NOT MATCHED THEN INSERT(SortOrder,Body,Fact,TimeLimitSec,IsActive) VALUES(@base+s.n,s.Body,s.Fact,s.Limit,1)
  OUTPUT s.n, inserted.QuestionId INTO @map;
  INSERT dbo.Options(QuestionId,Body,IsCorrect,SortOrder)
    SELECT m.QuestionId, r.Correct, 1, 1 FROM @r r JOIN @map m ON m.n=r.n
    UNION ALL
    SELECT m.QuestionId, w.Body, 0, w.k+2 FROM @w w JOIN @map m ON m.n=w.n;
  INSERT dbo.AdminAudit(Action,Details) VALUES('ImportQuestions',CONCAT(N'Count=',(SELECT COUNT(*) FROM @r)));
  COMMIT;
  SELECT 'OK' AS Status, (SELECT COUNT(*) FROM @r) AS Imported, CAST(NULL AS INT) AS BadRow;
END
GO
