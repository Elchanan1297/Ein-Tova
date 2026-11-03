-- עין טובה: ניהול תוכן. ברכות, תוכנית הערב, קליפי קול.
-- נדרש לאינדקסים מסוננים (Options, Guests). sqlcmd מכבה את זה כברירת מחדל
SET QUOTED_IDENTIFIER ON; SET ANSI_NULLS ON;
GO
-- ---------- ברכות ----------
CREATE OR ALTER PROC dbo.usp_AdminListGreetings AS
BEGIN
  SET NOCOUNT ON;
  SELECT GreetingId, SortOrder, SenderName, Relation, Kind, Body, MediaUrl, IsActive
  FROM dbo.Greetings ORDER BY SortOrder, GreetingId;
END
GO
/* @Json: {"greetingId":null|N,"senderName":"...","relation":"...","kind":"text|image|video","body":"...","mediaUrl":"...","isActive":true} */
CREATE OR ALTER PROC dbo.usp_AdminSaveGreeting @Json NVARCHAR(MAX) AS
BEGIN
  SET NOCOUNT ON;
  DECLARE @id INT, @sender NVARCHAR(150), @rel NVARCHAR(150), @kind VARCHAR(10), @body NVARCHAR(2100), @media NVARCHAR(500), @active BIT;
  SELECT @id=greetingId, @sender=NULLIF(LTRIM(RTRIM(senderName)),N''), @rel=NULLIF(LTRIM(RTRIM(relation)),N''),
         @kind=kind, @body=NULLIF(LTRIM(RTRIM(body)),N''), @media=NULLIF(LTRIM(RTRIM(mediaUrl)),N''), @active=ISNULL(isActive,1)
  FROM OPENJSON(@Json) WITH (greetingId INT, senderName NVARCHAR(150), relation NVARCHAR(150), kind VARCHAR(10),
                              body NVARCHAR(2100), mediaUrl NVARCHAR(500), isActive BIT);
  DECLARE @field VARCHAR(20)=CASE
    WHEN @sender IS NULL OR LEN(@sender)>100 THEN 'senderName'
    WHEN LEN(@rel)>100 THEN 'relation'
    WHEN ISNULL(@kind,'') NOT IN ('text','image','video') THEN 'kind'
    WHEN @kind='text' AND @body IS NULL THEN 'body'
    WHEN LEN(@body)>2000 THEN 'body'
    WHEN @kind IN ('image','video') AND (@media IS NULL OR LEN(@media)>400) THEN 'mediaUrl'
  END;
  IF @field IS NOT NULL BEGIN SELECT 'BadValue' AS Status, @field AS Field, @id AS Id; RETURN; END
  IF @kind='text' SET @media=NULL;
  IF @id IS NULL
  BEGIN
    INSERT dbo.Greetings(SortOrder,SenderName,Relation,Kind,Body,MediaUrl,IsActive)
    VALUES(ISNULL((SELECT MAX(SortOrder) FROM dbo.Greetings),0)+1,@sender,@rel,@kind,@body,@media,@active);
    SET @id=SCOPE_IDENTITY();
  END
  ELSE
  BEGIN
    UPDATE dbo.Greetings SET SenderName=@sender,Relation=@rel,Kind=@kind,Body=@body,MediaUrl=@media,IsActive=@active WHERE GreetingId=@id;
    IF @@ROWCOUNT=0 BEGIN SELECT 'NotFound' AS Status, CAST(NULL AS VARCHAR(20)) AS Field, @id AS Id; RETURN; END
  END
  INSERT dbo.AdminAudit(Action,Details) VALUES('SaveGreeting',CONCAT(N'GreetingId=',@id));
  SELECT 'OK' AS Status, CAST(NULL AS VARCHAR(20)) AS Field, @id AS Id;
END
GO
CREATE OR ALTER PROC dbo.usp_AdminDeleteGreeting @Id INT AS
BEGIN
  SET NOCOUNT ON;
  DELETE FROM dbo.Greetings WHERE GreetingId=@Id;
  IF @@ROWCOUNT=0 BEGIN SELECT 'NotFound' AS Status; RETURN; END
  INSERT dbo.AdminAudit(Action,Details) VALUES('DeleteGreeting',CONCAT(N'GreetingId=',@Id));
  SELECT 'OK' AS Status;
END
GO
/* @Json: [3,1,2] */
CREATE OR ALTER PROC dbo.usp_AdminReorderGreetings @Json NVARCHAR(MAX) AS
BEGIN
  SET NOCOUNT ON;
  IF ISJSON(@Json)<>1 BEGIN SELECT 'BadValue' AS Status; RETURN; END
  UPDATE g SET SortOrder=CAST(j.[key] AS INT)+1
  FROM dbo.Greetings g JOIN OPENJSON(@Json) j ON TRY_CONVERT(INT,j.[value])=g.GreetingId;
  SELECT 'OK' AS Status;
END
GO
-- ---------- תוכנית הערב (הסדר נקבע לפי השעה) ----------
CREATE OR ALTER PROC dbo.usp_AdminListProgram AS
BEGIN
  SET NOCOUNT ON;
  SELECT ItemId, SortOrder, TimeText, Title, Icon, IsActive FROM dbo.ProgramItems ORDER BY SortOrder, ItemId;
END
GO
/* @Json: {"itemId":null|N,"timeText":"19:30","title":"...","icon":"mic","isActive":true} */
CREATE OR ALTER PROC dbo.usp_AdminSaveProgramItem @Json NVARCHAR(MAX) AS
BEGIN
  SET NOCOUNT ON; SET XACT_ABORT ON;
  DECLARE @id INT, @time NVARCHAR(20), @title NVARCHAR(150), @icon VARCHAR(30), @active BIT;
  SELECT @id=itemId, @time=NULLIF(LTRIM(RTRIM(timeText)),N''), @title=NULLIF(LTRIM(RTRIM(title)),N''),
         @icon=NULLIF(LTRIM(RTRIM(icon)),''), @active=ISNULL(isActive,1)
  FROM OPENJSON(@Json) WITH (itemId INT, timeText NVARCHAR(20), title NVARCHAR(150), icon VARCHAR(30), isActive BIT);
  -- שעה בפורמט HH:mm
  IF LEN(@time)=4 SET @time=N'0'+@time;
  DECLARE @field VARCHAR(20)=CASE
    WHEN @time IS NULL OR @time NOT LIKE '[0-2][0-9]:[0-5][0-9]' OR LEFT(@time,2)>'23' THEN 'timeText'
    WHEN @title IS NULL OR LEN(@title)>100 THEN 'title'
    WHEN @icon IS NOT NULL AND @icon NOT IN ('door','mic','spark','film','gift','clock','calendar','users','play','trophy','home') THEN 'icon'
  END;
  IF @field IS NOT NULL BEGIN SELECT 'BadValue' AS Status, @field AS Field, @id AS Id; RETURN; END
  BEGIN TRAN;
  IF @id IS NULL
  BEGIN
    INSERT dbo.ProgramItems(SortOrder,TimeText,Title,Icon,IsActive) VALUES(0,@time,@title,@icon,@active);
    SET @id=SCOPE_IDENTITY();
  END
  ELSE
  BEGIN
    UPDATE dbo.ProgramItems SET TimeText=@time,Title=@title,Icon=@icon,IsActive=@active WHERE ItemId=@id;
    IF @@ROWCOUNT=0 BEGIN ROLLBACK; SELECT 'NotFound' AS Status, CAST(NULL AS VARCHAR(20)) AS Field, @id AS Id; RETURN; END
  END
  -- מסדרים מחדש לפי השעה
  ;WITH o AS (SELECT SortOrder, ROW_NUMBER() OVER(ORDER BY TimeText, ItemId) AS n FROM dbo.ProgramItems)
  UPDATE o SET SortOrder=n;
  INSERT dbo.AdminAudit(Action,Details) VALUES('SaveProgramItem',CONCAT(N'ItemId=',@id));
  COMMIT;
  SELECT 'OK' AS Status, CAST(NULL AS VARCHAR(20)) AS Field, @id AS Id;
END
GO
CREATE OR ALTER PROC dbo.usp_AdminDeleteProgramItem @Id INT AS
BEGIN
  SET NOCOUNT ON;
  DELETE FROM dbo.ProgramItems WHERE ItemId=@Id;
  IF @@ROWCOUNT=0 BEGIN SELECT 'NotFound' AS Status; RETURN; END
  INSERT dbo.AdminAudit(Action,Details) VALUES('DeleteProgramItem',CONCAT(N'ItemId=',@Id));
  SELECT 'OK' AS Status;
END
GO
-- ---------- קליפי קול ----------
CREATE OR ALTER PROC dbo.usp_AdminListVoiceClips AS
BEGIN
  SET NOCOUNT ON;
  SELECT ClipId, EventType, FileUrl, Transcript, IsActive FROM dbo.VoiceClips ORDER BY EventType, ClipId;
END
GO
/* @Json: {"clipId":null|N,"eventType":"Correct","fileUrl":"/media/...","transcript":"...","isActive":true} */
CREATE OR ALTER PROC dbo.usp_AdminSaveVoiceClip @Json NVARCHAR(MAX) AS
BEGIN
  SET NOCOUNT ON;
  DECLARE @id INT, @event VARCHAR(20), @url NVARCHAR(500), @text NVARCHAR(400), @active BIT;
  SELECT @id=clipId, @event=eventType, @url=NULLIF(LTRIM(RTRIM(fileUrl)),N''), @text=NULLIF(LTRIM(RTRIM(transcript)),N''), @active=ISNULL(isActive,1)
  FROM OPENJSON(@Json) WITH (clipId INT, eventType VARCHAR(20), fileUrl NVARCHAR(500), transcript NVARCHAR(400), isActive BIT);
  DECLARE @field VARCHAR(20)=CASE
    WHEN ISNULL(@event,'') NOT IN ('Welcome','GameStart','Correct','Incorrect','GameEnd','Winner') THEN 'eventType'
    WHEN @url IS NULL OR LEN(@url)>400 THEN 'fileUrl'
    -- תמלול חובה: מוצג על המסך בזמן הניגון
    WHEN @text IS NULL OR LEN(@text)>300 THEN 'transcript'
  END;
  IF @field IS NOT NULL BEGIN SELECT 'BadValue' AS Status, @field AS Field, @id AS Id; RETURN; END
  IF @id IS NULL
  BEGIN
    INSERT dbo.VoiceClips(EventType,FileUrl,Transcript,IsActive) VALUES(@event,@url,@text,@active);
    SET @id=SCOPE_IDENTITY();
  END
  ELSE
  BEGIN
    UPDATE dbo.VoiceClips SET EventType=@event,FileUrl=@url,Transcript=@text,IsActive=@active WHERE ClipId=@id;
    IF @@ROWCOUNT=0 BEGIN SELECT 'NotFound' AS Status, CAST(NULL AS VARCHAR(20)) AS Field, @id AS Id; RETURN; END
  END
  INSERT dbo.AdminAudit(Action,Details) VALUES('SaveVoiceClip',CONCAT(N'ClipId=',@id));
  SELECT 'OK' AS Status, CAST(NULL AS VARCHAR(20)) AS Field, @id AS Id;
END
GO
CREATE OR ALTER PROC dbo.usp_AdminDeleteVoiceClip @Id INT AS
BEGIN
  SET NOCOUNT ON;
  DELETE FROM dbo.VoiceClips WHERE ClipId=@Id;
  IF @@ROWCOUNT=0 BEGIN SELECT 'NotFound' AS Status; RETURN; END
  INSERT dbo.AdminAudit(Action,Details) VALUES('DeleteVoiceClip',CONCAT(N'ClipId=',@Id));
  SELECT 'OK' AS Status;
END
GO
