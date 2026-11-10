-- עין טובה: "מסע בזמן", תמונות של אבא לאורך השנים. רק המנהל מעלה; אורחים צופים בתמונות שפורסמו.
-- הקבצים עצמם בדיסק (Photos__Root), כאן רק מטא־דאטה.
-- נדרש לאינדקסים מסוננים (Options, Guests, Photos). sqlcmd מכבה את זה כברירת מחדל
SET QUOTED_IDENTIFIER ON; SET ANSI_NULLS ON;
GO
IF OBJECT_ID('dbo.Photos') IS NULL
CREATE TABLE dbo.Photos(
  PhotoId        INT IDENTITY PRIMARY KEY,
  PublicId       UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID() UNIQUE,   -- בכתובות, לא ה־INT
  Caption        NVARCHAR(140) NULL,
  YearTaken      SMALLINT NULL,
  YearApprox     BIT NOT NULL DEFAULT 0,          -- "בערך"
  YearSource     TINYINT NOT NULL DEFAULT 0,      -- 0=ידני 1=EXIF 2=Drive 3=תאריך הקובץ (לא בטוח)
  WhoElse        NVARCHAR(200) NULL,              -- "עם סבתא ודוד משה"
  Status         TINYINT NOT NULL DEFAULT 0,      -- 0=טיוטה 1=פורסמה 2=מוסתרת
  IsFeatured     BIT NOT NULL DEFAULT 0,
  SortOrder      INT NULL,                        -- סדר ידני בתוך אותה שנה
  Width          INT NOT NULL,
  Height         INT NOT NULL,
  OrigBytes      INT NOT NULL,                    -- גודל ההעלאה המקורית
  StoredBytes    INT NOT NULL,                    -- כל הקבצים השמורים (לתקרת האחסון)
  ContentType    VARCHAR(50) NOT NULL,            -- של הקובץ המקורי השמור
  Sha256         CHAR(64) NOT NULL,               -- מניעת כפילויות
  SourceDriveId  VARCHAR(100) NULL,
  SourceName     NVARCHAR(260) NULL,
  StorageKey     NVARCHAR(200) NOT NULL,
  CreatedAt      DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  CreatedBy      NVARCHAR(100) NOT NULL,
  CONSTRAINT UQ_Photos_Sha UNIQUE(Sha256),
  CONSTRAINT CK_Photos_Year CHECK (YearTaken IS NULL OR YearTaken BETWEEN 1940 AND 2100),
  CONSTRAINT CK_Photos_Status CHECK (Status IN (0,1,2)));
GO
IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE name='UX_Photos_Drive')
  CREATE UNIQUE INDEX UX_Photos_Drive ON dbo.Photos(SourceDriveId) WHERE SourceDriveId IS NOT NULL;
IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE name='IX_Photos_Status_Year')
  CREATE INDEX IX_Photos_Status_Year ON dbo.Photos(Status, YearTaken, SortOrder);
GO
IF OBJECT_ID('dbo.PhotoLikes') IS NULL
CREATE TABLE dbo.PhotoLikes(
  PhotoId   INT NOT NULL REFERENCES dbo.Photos(PhotoId) ON DELETE CASCADE,
  GuestId   INT NOT NULL REFERENCES dbo.Guests(GuestId),
  CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  PRIMARY KEY(PhotoId, GuestId));
GO
MERGE dbo.Settings AS t USING (VALUES
 ('PhotosEnabled',N'1',N'האם הגלריה "מסע בזמן" גלויה לאורחים (1/0)'),
 ('PhotosMaxMB',N'25',N'גודל מקסימלי לתמונה אחת (MB)'),
 ('PhotosStorageMaxGB',N'3',N'תקרת אחסון לכל התמונות (GB)'),
 ('SlideshowShowCaption',N'1',N'להציג שנה וכיתוב במצגת התמונות (1/0)')
) AS s(k,v,n) ON t.SettingKey=s.k WHEN NOT MATCHED THEN INSERT(SettingKey,SettingValue,Note) VALUES(s.k,s.v,s.n);
GO

/* מגבלות להעלאה: גודל לתמונה, ומה נשאר באחסון */
CREATE OR ALTER PROC dbo.usp_GetPhotoLimits AS
BEGIN
  SET NOCOUNT ON;
  SELECT ISNULL(TRY_CONVERT(INT,dbo.fn_Setting('PhotosMaxMB')),25) AS MaxMB,
         CAST(ISNULL(TRY_CONVERT(FLOAT,dbo.fn_Setting('PhotosStorageMaxGB')),3)*1073741824 AS BIGINT) AS MaxStorageBytes,
         ISNULL((SELECT SUM(CAST(StoredBytes AS BIGINT)) FROM dbo.Photos),0) AS UsedBytes;
END
GO
/* בודק כפילות לפני עיבוד (חוסך עבודה). מחזיר את הקיימת, או כלום */
CREATE OR ALTER PROC dbo.usp_FindPhotoDuplicate @Sha256 CHAR(64), @SourceDriveId VARCHAR(100) AS
BEGIN
  SET NOCOUNT ON;
  SELECT TOP 1 PublicId FROM dbo.Photos WHERE Sha256=@Sha256 OR (@SourceDriveId IS NOT NULL AND SourceDriveId=@SourceDriveId);
END
GO
/* @Json: {"storageKey","sha256","width","height","origBytes","storedBytes","contentType","caption","yearTaken","yearApprox",
           "yearSource","sourceDriveId","sourceName","createdBy"}
   כפילות (Sha256/Drive) לא נכשלת: Status=Duplicate עם ה־PublicId הקיים */
CREATE OR ALTER PROC dbo.usp_AddPhoto @Json NVARCHAR(MAX) AS
BEGIN
  SET NOCOUNT ON; SET XACT_ABORT ON;
  DECLARE @sha CHAR(64), @drive VARCHAR(100), @year SMALLINT;
  SELECT @sha=sha256, @drive=NULLIF(sourceDriveId,''), @year=yearTaken
  FROM OPENJSON(@Json) WITH (sha256 CHAR(64), sourceDriveId VARCHAR(100), yearTaken SMALLINT);
  IF @year IS NOT NULL AND @year NOT BETWEEN 1940 AND YEAR(SYSUTCDATETIME()) SET @year=NULL;  -- שנה לא סבירה: בלי שנה

  DECLARE @existing UNIQUEIDENTIFIER=(SELECT TOP 1 PublicId FROM dbo.Photos WHERE Sha256=@sha OR (@drive IS NOT NULL AND SourceDriveId=@drive));
  IF @existing IS NOT NULL BEGIN SELECT 'Duplicate' AS Status, @existing AS PublicId; RETURN; END

  DECLARE @out TABLE(PublicId UNIQUEIDENTIFIER);
  BEGIN TRY
    INSERT dbo.Photos(Caption,YearTaken,YearApprox,YearSource,Width,Height,OrigBytes,StoredBytes,ContentType,Sha256,SourceDriveId,SourceName,StorageKey,CreatedBy)
    OUTPUT inserted.PublicId INTO @out
    SELECT NULLIF(LTRIM(RTRIM(caption)),N''), @year, ISNULL(yearApprox,0), CASE WHEN @year IS NULL THEN 0 ELSE ISNULL(yearSource,0) END,
           width, height, origBytes, storedBytes, contentType, @sha, @drive, sourceName, storageKey, ISNULL(createdBy,N'admin')
    FROM OPENJSON(@Json) WITH (caption NVARCHAR(140), yearApprox BIT, yearSource TINYINT, width INT, height INT, origBytes INT,
                               storedBytes INT, contentType VARCHAR(50), sourceName NVARCHAR(260), storageKey NVARCHAR(200), createdBy NVARCHAR(100));
  END TRY
  BEGIN CATCH
    -- שתי העלאות מקבילות של אותה תמונה: השנייה מקבלת את הראשונה
    IF ERROR_NUMBER() IN (2601,2627)
    BEGIN SELECT 'Duplicate' AS Status, (SELECT TOP 1 PublicId FROM dbo.Photos WHERE Sha256=@sha OR SourceDriveId=@drive) AS PublicId; RETURN; END;
    THROW;
  END CATCH
  DECLARE @id UNIQUEIDENTIFIER=(SELECT PublicId FROM @out);
  INSERT dbo.AdminAudit(Action,Details) VALUES('AddPhoto',CONCAT(N'PublicId=',@id));
  SELECT 'OK' AS Status, @id AS PublicId;
END
GO
/* רשימת ניהול. @Status NULL=הכול, @Decade למשל 1970, -1=בלי שנה. תוצאה 1: תמונות. תוצאה 2: מונים לפי סטטוס */
CREATE OR ALTER PROC dbo.usp_AdminListPhotos @Status TINYINT=NULL, @Decade INT=NULL, @Skip INT=0, @Take INT=200 AS
BEGIN
  SET NOCOUNT ON;
  SELECT PublicId, Caption, YearTaken, YearApprox, YearSource, WhoElse, Status, IsFeatured, SortOrder, Width, Height,
         OrigBytes, SourceName, CreatedAt,
         (SELECT COUNT(*) FROM dbo.PhotoLikes l WHERE l.PhotoId=p.PhotoId) AS Likes
  FROM dbo.Photos p
  WHERE (@Status IS NULL OR Status=@Status)
    AND (@Decade IS NULL OR (@Decade=-1 AND YearTaken IS NULL) OR (YearTaken/10*10=@Decade))
  ORDER BY CASE WHEN YearTaken IS NULL THEN 1 ELSE 0 END, YearTaken, ISNULL(SortOrder,2147483647), CreatedAt
  OFFSET @Skip ROWS FETCH NEXT @Take ROWS ONLY;
  SELECT SUM(CASE WHEN Status=0 THEN 1 ELSE 0 END) AS Drafts, SUM(CASE WHEN Status=1 THEN 1 ELSE 0 END) AS Published,
         SUM(CASE WHEN Status=2 THEN 1 ELSE 0 END) AS Hidden, SUM(CASE WHEN YearTaken IS NULL THEN 1 ELSE 0 END) AS NoYear
  FROM dbo.Photos;
END
GO
/* עדכון לתמונה אחת או לכמה (בכמות). רק השדות שנשלחו משתנים.
   @Json: {"ids":[guid...],"caption"?,"yearTaken"?,"yearApprox"?,"whoElse"?,"isFeatured"?,"status"?}
   "yearTaken": null מוחק שנה. שנה מוזנת ידנית: YearSource=0 */
CREATE OR ALTER PROC dbo.usp_AdminUpdatePhotoMeta @Json NVARCHAR(MAX) AS
BEGIN
  SET NOCOUNT ON; SET XACT_ABORT ON;
  IF ISJSON(@Json)<>1 BEGIN SELECT 'BadValue' AS Status, CAST(NULL AS VARCHAR(20)) AS Field, 0 AS Updated; RETURN; END
  DECLARE @ids TABLE(PublicId UNIQUEIDENTIFIER PRIMARY KEY);
  INSERT @ids SELECT DISTINCT TRY_CONVERT(UNIQUEIDENTIFIER,[value]) FROM OPENJSON(@Json,'$.ids') WHERE TRY_CONVERT(UNIQUEIDENTIFIER,[value]) IS NOT NULL;

  DECLARE @hasCaption BIT=CASE WHEN EXISTS(SELECT 1 FROM OPENJSON(@Json) WHERE [key]='caption') THEN 1 ELSE 0 END,
          @hasYear BIT=CASE WHEN EXISTS(SELECT 1 FROM OPENJSON(@Json) WHERE [key]='yearTaken') THEN 1 ELSE 0 END,
          @hasApprox BIT=CASE WHEN EXISTS(SELECT 1 FROM OPENJSON(@Json) WHERE [key]='yearApprox') THEN 1 ELSE 0 END,
          @hasWho BIT=CASE WHEN EXISTS(SELECT 1 FROM OPENJSON(@Json) WHERE [key]='whoElse') THEN 1 ELSE 0 END,
          @hasFeat BIT=CASE WHEN EXISTS(SELECT 1 FROM OPENJSON(@Json) WHERE [key]='isFeatured') THEN 1 ELSE 0 END,
          @hasStatus BIT=CASE WHEN EXISTS(SELECT 1 FROM OPENJSON(@Json) WHERE [key]='status') THEN 1 ELSE 0 END;
  DECLARE @caption NVARCHAR(400)=NULLIF(LTRIM(RTRIM(JSON_VALUE(@Json,'$.caption'))),N''),
          @year INT=TRY_CONVERT(INT,JSON_VALUE(@Json,'$.yearTaken')),
          @approx BIT=TRY_CONVERT(BIT,JSON_VALUE(@Json,'$.yearApprox')),
          @who NVARCHAR(400)=NULLIF(LTRIM(RTRIM(JSON_VALUE(@Json,'$.whoElse'))),N''),
          @feat BIT=TRY_CONVERT(BIT,JSON_VALUE(@Json,'$.isFeatured')),
          @status INT=TRY_CONVERT(INT,JSON_VALUE(@Json,'$.status'));

  DECLARE @field VARCHAR(20)=CASE
    WHEN NOT EXISTS(SELECT 1 FROM @ids) THEN 'ids'
    WHEN @hasCaption=1 AND LEN(@caption)>140 THEN 'caption'
    WHEN @hasYear=1 AND JSON_VALUE(@Json,'$.yearTaken') IS NOT NULL AND (@year IS NULL OR @year NOT BETWEEN 1940 AND YEAR(SYSUTCDATETIME())) THEN 'yearTaken'
    WHEN @hasWho=1 AND LEN(@who)>200 THEN 'whoElse'
    WHEN @hasStatus=1 AND (@status IS NULL OR @status NOT IN (0,1,2)) THEN 'status'
  END;
  IF @field IS NOT NULL BEGIN SELECT 'BadValue' AS Status, @field AS Field, 0 AS Updated; RETURN; END

  BEGIN TRAN;
  UPDATE p SET
    Caption    = CASE WHEN @hasCaption=1 THEN @caption ELSE Caption END,
    YearTaken  = CASE WHEN @hasYear=1 THEN @year ELSE YearTaken END,
    YearSource = CASE WHEN @hasYear=1 THEN 0 ELSE YearSource END,
    YearApprox = CASE WHEN @hasApprox=1 THEN ISNULL(@approx,0) WHEN @hasYear=1 AND @year IS NULL THEN 0 ELSE YearApprox END,
    WhoElse    = CASE WHEN @hasWho=1 THEN @who ELSE WhoElse END,
    IsFeatured = CASE WHEN @hasFeat=1 THEN ISNULL(@feat,0) ELSE IsFeatured END,
    Status     = CASE WHEN @hasStatus=1 THEN @status ELSE Status END
  FROM dbo.Photos p JOIN @ids i ON i.PublicId=p.PublicId;
  DECLARE @n INT=@@ROWCOUNT;
  INSERT dbo.AdminAudit(Action,Details) VALUES(CASE WHEN @hasStatus=1 THEN 'SetPhotoStatus' ELSE 'UpdatePhotos' END, LEFT(CONCAT(N'Count=',@n,N' ',@Json),400));
  COMMIT;
  -- התמונות שפורסמו עכשיו (למצגת החיה)
  SELECT 'OK' AS Status, CAST(NULL AS VARCHAR(20)) AS Field, @n AS Updated;
  SELECT p.PublicId FROM dbo.Photos p JOIN @ids i ON i.PublicId=p.PublicId WHERE @hasStatus=1 AND p.Status=1;
END
GO
/* סדר ידני: @Json = [guid,...] בסדר החדש (בדרך כלל תמונות מאותה שנה) */
CREATE OR ALTER PROC dbo.usp_AdminReorderPhotos @Json NVARCHAR(MAX) AS
BEGIN
  SET NOCOUNT ON;
  IF ISJSON(@Json)<>1 BEGIN SELECT 'BadValue' AS Status; RETURN; END
  UPDATE p SET SortOrder=CAST(j.[key] AS INT)+1
  FROM dbo.Photos p JOIN OPENJSON(@Json) j ON TRY_CONVERT(UNIQUEIDENTIFIER,j.[value])=p.PublicId;
  SELECT 'OK' AS Status;
END
GO
/* מחיקה: מחזיר StorageKey כדי שה־API ימחק את הקבצים */
CREATE OR ALTER PROC dbo.usp_DeletePhoto @PublicId UNIQUEIDENTIFIER AS
BEGIN
  SET NOCOUNT ON;
  DECLARE @k TABLE(StorageKey NVARCHAR(200));
  DELETE FROM dbo.Photos OUTPUT deleted.StorageKey INTO @k WHERE PublicId=@PublicId;
  IF NOT EXISTS(SELECT 1 FROM @k) BEGIN SELECT 'NotFound' AS Status, CAST(NULL AS NVARCHAR(200)) AS StorageKey; RETURN; END
  INSERT dbo.AdminAudit(Action,Details) VALUES('DeletePhoto',CONCAT(N'PublicId=',@PublicId));
  SELECT 'OK' AS Status, StorageKey FROM @k;
END
GO
/* קובץ להגשה. @PublishedOnly=1 לאורחים ולמצגת (טיוטה/מוסתרת לא מוגשת) */
CREATE OR ALTER PROC dbo.usp_GetPhotoFile @PublicId UNIQUEIDENTIFIER, @PublishedOnly BIT AS
BEGIN
  SET NOCOUNT ON;
  SELECT StorageKey, ContentType, SourceName FROM dbo.Photos
  WHERE PublicId=@PublicId AND (@PublishedOnly=0 OR Status=1);
END
GO
/* גלריה לאורחים: רק שפורסמו, לפי שנה (בלי שנה בסוף). כולל ❤️ שלי ומונה */
CREATE OR ALTER PROC dbo.usp_ListPublishedPhotos @GuestId INT, @Decade INT=NULL, @Skip INT=0, @Take INT=500 AS
BEGIN
  SET NOCOUNT ON;
  IF ISNULL(dbo.fn_Setting('PhotosEnabled'),N'1')<>N'1' RETURN;
  SELECT p.PublicId, p.Caption, p.YearTaken, p.YearApprox, p.WhoElse, p.IsFeatured, p.Width, p.Height,
         (SELECT COUNT(*) FROM dbo.PhotoLikes l WHERE l.PhotoId=p.PhotoId) AS Likes,
         CAST(CASE WHEN EXISTS(SELECT 1 FROM dbo.PhotoLikes l WHERE l.PhotoId=p.PhotoId AND l.GuestId=@GuestId) THEN 1 ELSE 0 END AS BIT) AS LikedByMe
  FROM dbo.Photos p
  WHERE p.Status=1 AND (@Decade IS NULL OR (@Decade=-1 AND p.YearTaken IS NULL) OR (p.YearTaken/10*10=@Decade))
  ORDER BY CASE WHEN p.YearTaken IS NULL THEN 1 ELSE 0 END, p.YearTaken, ISNULL(p.SortOrder,2147483647), p.CreatedAt
  OFFSET @Skip ROWS FETCH NEXT @Take ROWS ONLY;
END
GO
/* ❤️: לחיצה מוסיפה, לחיצה נוספת מסירה. רק על תמונה שפורסמה */
CREATE OR ALTER PROC dbo.usp_TogglePhotoLike @PublicId UNIQUEIDENTIFIER, @GuestId INT AS
BEGIN
  SET NOCOUNT ON; SET XACT_ABORT ON;
  DECLARE @id INT=(SELECT PhotoId FROM dbo.Photos WHERE PublicId=@PublicId AND Status=1);
  IF @id IS NULL BEGIN SELECT 'NotFound' AS Status, CAST(0 AS BIT) AS Liked, 0 AS Likes; RETURN; END
  BEGIN TRAN;
  IF EXISTS(SELECT 1 FROM dbo.PhotoLikes WITH (UPDLOCK,HOLDLOCK) WHERE PhotoId=@id AND GuestId=@GuestId)
    DELETE FROM dbo.PhotoLikes WHERE PhotoId=@id AND GuestId=@GuestId;
  ELSE
    INSERT dbo.PhotoLikes(PhotoId,GuestId) VALUES(@id,@GuestId);
  COMMIT;
  SELECT 'OK' AS Status,
         CAST(CASE WHEN EXISTS(SELECT 1 FROM dbo.PhotoLikes WHERE PhotoId=@id AND GuestId=@GuestId) THEN 1 ELSE 0 END AS BIT) AS Liked,
         (SELECT COUNT(*) FROM dbo.PhotoLikes WHERE PhotoId=@id) AS Likes;
END
GO
/* מצגת: שפורסמו, בסדר כרונולוגי */
CREATE OR ALTER PROC dbo.usp_GetSlideshow AS
BEGIN
  SET NOCOUNT ON;
  SELECT PublicId, Caption, YearTaken, YearApprox, IsFeatured, Width, Height,
         CAST(CASE WHEN ISNULL(dbo.fn_Setting('SlideshowShowCaption'),N'1')=N'1' THEN 1 ELSE 0 END AS BIT) AS ShowCaption
  FROM dbo.Photos WHERE Status=1
  ORDER BY CASE WHEN YearTaken IS NULL THEN 1 ELSE 0 END, YearTaken, ISNULL(SortOrder,2147483647), CreatedAt;
END
GO
