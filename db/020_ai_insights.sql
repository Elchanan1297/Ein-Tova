-- עין טובה: תובנות AI על תוצאות המשחק (שלב ב׳ ב־dashboard-spec.md). בטוח להריץ שוב.
-- כבוי כברירת מחדל (AiEnabled=0): אין שום קריאה חיצונית עד שהמנהל מדליק.
-- נשמרים רק התוצרים (JSON) ומספרי הטוקנים, לא הפרומפט. מפתח ה־API רק במשתני סביבה (AI__ApiKey).
-- usp_AdminSaveSettings מוגדרת כאן מחדש (כמו ב־017, ועוד AiEnabled ו־AiMaxCallsPerHour); שינוי בה מעכשיו רק כאן.
SET QUOTED_IDENTIFIER ON; SET ANSI_NULLS ON;
GO
IF OBJECT_ID('dbo.AiInsights') IS NULL
CREATE TABLE dbo.AiInsights(
  Id INT IDENTITY PRIMARY KEY,
  CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  Kind VARCHAR(20) NOT NULL,            -- insights | ask | blessing | published
  DataHash CHAR(64) NULL,               -- טביעת הנתונים ששלחנו (מטמון: אותם נתונים = אותה תשובה)
  Model VARCHAR(80) NULL,
  PayloadJson NVARCHAR(MAX) NOT NULL,   -- התוצר אחרי ולידציה בשרת
  TokensIn INT NULL,
  TokensOut INT NULL);
GO
IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE name='IX_AiInsights_Kind' AND object_id=OBJECT_ID('dbo.AiInsights'))
  CREATE INDEX IX_AiInsights_Kind ON dbo.AiInsights(Kind, DataHash, CreatedAt DESC);
GO
MERGE dbo.Settings AS t USING (VALUES
  ('AiEnabled',N'0',N'1 = תובנות AI פעילות (קריאה לשרת חיצוני)'),
  ('AiIncludePlayerNames',N'0',N'1 = לשלוח שמות שחקנים ל־AI (בשכבה החינמית: לא)'),
  ('AiMaxCallsPerHour',N'20',N'תקרת קריאות ל־AI בשעה (להתאים למכסה)'),
  ('AiMaxQuestionsPerGame',N'50',N'כמה שאלות חופשיות ("שאלו את הנתונים") בסך הכול'),
  ('AiPublishToViewers',N'0',N'1 = התובנות שאושרו מוצגות לאורחים ובמסך הגדול')
) AS s(k,v,n) ON t.SettingKey=s.k
WHEN NOT MATCHED THEN INSERT(SettingKey,SettingValue,Note) VALUES(s.k,s.v,s.n);
GO
/* מצב: הגדרות, כמה קריאות בשעה האחרונה, כמה שאלות חופשיות עד עכשיו */
CREATE OR ALTER PROC dbo.usp_AiGetStatus AS
BEGIN
  SET NOCOUNT ON;
  SELECT
    CAST(CASE WHEN dbo.fn_Setting('AiEnabled')=N'1' THEN 1 ELSE 0 END AS BIT) AS Enabled,
    CAST(CASE WHEN dbo.fn_Setting('AiIncludePlayerNames')=N'1' THEN 1 ELSE 0 END AS BIT) AS IncludePlayerNames,
    CAST(CASE WHEN dbo.fn_Setting('AiPublishToViewers')=N'1' THEN 1 ELSE 0 END AS BIT) AS PublishToViewers,
    ISNULL(TRY_CONVERT(INT,dbo.fn_Setting('AiMaxCallsPerHour')),20) AS MaxCallsPerHour,
    ISNULL(TRY_CONVERT(INT,dbo.fn_Setting('AiMaxQuestionsPerGame')),50) AS MaxQuestionsPerGame,
    (SELECT COUNT(*) FROM dbo.AiInsights WHERE Kind<>'published' AND CreatedAt>=DATEADD(HOUR,-1,SYSUTCDATETIME())) AS CallsLastHour,
    (SELECT COUNT(*) FROM dbo.AiInsights WHERE Kind='ask') AS QuestionsAsked;
END
GO
/* תוצאה שמורה לאותם נתונים (מטמון). @DataHash NULL = האחרונה מהסוג */
CREATE OR ALTER PROC dbo.usp_AiGetCached @Kind VARCHAR(20), @DataHash CHAR(64)=NULL AS
BEGIN
  SET NOCOUNT ON;
  SELECT TOP 1 Id, CreatedAt, Kind, DataHash, Model, PayloadJson
  FROM dbo.AiInsights
  WHERE Kind=@Kind AND (@DataHash IS NULL OR DataHash=@DataHash)
  ORDER BY CreatedAt DESC, Id DESC;
END
GO
/* שמירת תוצר (רק אחרי ולידציה בשרת). מתעד ב־AdminAudit מתי, בלי התוכן */
CREATE OR ALTER PROC dbo.usp_AiSave
  @Kind VARCHAR(20), @DataHash CHAR(64), @Model VARCHAR(80), @PayloadJson NVARCHAR(MAX), @TokensIn INT=NULL, @TokensOut INT=NULL AS
BEGIN
  SET NOCOUNT ON; SET XACT_ABORT ON;
  IF @Kind NOT IN ('insights','ask','blessing') OR ISJSON(@PayloadJson)<>1 BEGIN SELECT CAST(0 AS INT) AS Id; RETURN; END
  BEGIN TRAN;
  INSERT dbo.AiInsights(Kind,DataHash,Model,PayloadJson,TokensIn,TokensOut) VALUES(@Kind,@DataHash,@Model,@PayloadJson,@TokensIn,@TokensOut);
  DECLARE @id INT=SCOPE_IDENTITY();
  INSERT dbo.AdminAudit(Action,Details) VALUES('AiGenerate',CONCAT(@Kind,N' ',@Model));
  COMMIT;
  SELECT @id AS Id;
END
GO
/* תובנות שהמנהל אישר להציג לאורחים ובמסך (עד 3). @PayloadJson NULL = ביטול */
CREATE OR ALTER PROC dbo.usp_AiSetPublished @PayloadJson NVARCHAR(MAX)=NULL AS
BEGIN
  SET NOCOUNT ON; SET XACT_ABORT ON;
  IF @PayloadJson IS NOT NULL AND ISJSON(@PayloadJson)<>1 BEGIN SELECT 'BadValue' AS Status; RETURN; END
  BEGIN TRAN;
  DELETE dbo.AiInsights WHERE Kind='published';
  IF @PayloadJson IS NOT NULL INSERT dbo.AiInsights(Kind,PayloadJson) VALUES('published',@PayloadJson);
  UPDATE dbo.Settings SET SettingValue=CASE WHEN @PayloadJson IS NULL THEN N'0' ELSE N'1' END WHERE SettingKey='AiPublishToViewers';
  INSERT dbo.AdminAudit(Action,Details) VALUES(CASE WHEN @PayloadJson IS NULL THEN 'AiUnpublish' ELSE 'AiPublish' END,NULL);
  COMMIT;
  SELECT 'OK' AS Status;
END
GO
/* כמו ב־017, ועוד AiEnabled (0/1) ו־AiMaxCallsPerHour (1 עד 1000) */
CREATE OR ALTER PROC dbo.usp_AdminSaveSettings @Json NVARCHAR(MAX) AS
BEGIN
  SET NOCOUNT ON; SET XACT_ABORT ON;
  IF ISJSON(@Json)<>1 BEGIN SELECT 'BadValue' AS Status, CAST(NULL AS VARCHAR(50)) AS Field; RETURN; END
  DECLARE @s TABLE(k VARCHAR(50) PRIMARY KEY, v NVARCHAR(400) NULL);
  INSERT @s SELECT [key], NULLIF(LTRIM(RTRIM([value])),N'') FROM OPENJSON(@Json);

  DECLARE @bad VARCHAR(50)=(SELECT TOP 1 k FROM @s WHERE k NOT IN
    ('GameMode','OpensAt','ClosesAt','QuestionCount','FactsLabelCount','SecondsPerQuestion','GraceMs','VoiceChance','LeaderboardRank','IvrExtraSec',
     'AiEnabled','AiMaxCallsPerHour'));
  IF @bad IS NOT NULL BEGIN SELECT 'BadKey' AS Status, @bad AS Field; RETURN; END

  SELECT TOP 1 @bad=k FROM @s WHERE
       (k='GameMode' AND ISNULL(v,'') NOT IN (N'Always',N'Window',N'Closed'))
    OR (k='LeaderboardRank' AND ISNULL(v,'') NOT IN (N'Total',N'Average'))
    OR (k IN ('OpensAt','ClosesAt') AND v IS NOT NULL AND TRY_CONVERT(DATETIME2,v) IS NULL)
    OR (k IN ('QuestionCount','GraceMs') AND (TRY_CONVERT(INT,v) IS NULL OR TRY_CONVERT(INT,v)<0))
    OR (k='SecondsPerQuestion' AND (TRY_CONVERT(INT,v) IS NULL OR TRY_CONVERT(INT,v) NOT BETWEEN 5 AND 300))
    OR (k='IvrExtraSec' AND (TRY_CONVERT(INT,v) IS NULL OR TRY_CONVERT(INT,v) NOT BETWEEN 0 AND 300))
    OR (k='AiEnabled' AND ISNULL(v,'') NOT IN (N'0',N'1'))
    OR (k='AiMaxCallsPerHour' AND (TRY_CONVERT(INT,v) IS NULL OR TRY_CONVERT(INT,v) NOT BETWEEN 1 AND 1000))
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
