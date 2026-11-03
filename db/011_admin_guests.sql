-- עין טובה: ניהול מוזמנים ומשפחות. קוד אישי אקראי, איפוס, ייבוא.
-- נדרש לאינדקסים מסוננים (Options, Guests). sqlcmd מכבה את זה כברירת מחדל
SET QUOTED_IDENTIFIER ON; SET ANSI_NULLS ON;
GO
/* קוד אישי: 6 תווים בלי אותיות/ספרות שמתבלבלות (0/O, 1/I/L) */
CREATE OR ALTER PROC dbo.usp_AdminNewCode @Code VARCHAR(16) OUTPUT AS
BEGIN
  SET NOCOUNT ON;
  DECLARE @abc VARCHAR(32)='ABCDEFGHJKMNPQRSTUVWXYZ23456789', @i INT;
  WHILE 1=1
  BEGIN
    SELECT @Code='', @i=0;
    WHILE @i<6 BEGIN
      SET @Code+=SUBSTRING(@abc, CAST(CRYPT_GEN_RANDOM(1) AS INT)%LEN(@abc)+1, 1);
      SET @i+=1;
    END
    IF NOT EXISTS(SELECT 1 FROM dbo.Guests WHERE Code=@Code) RETURN;
  END
END
GO
/* תוצאה 1: משפחות. תוצאה 2: מוזמנים עם מצב המשחק שלהם */
CREATE OR ALTER PROC dbo.usp_AdminListGuests AS
BEGIN
  SET NOCOUNT ON;
  SELECT f.FamilyId, f.Name, f.SortOrder, (SELECT COUNT(*) FROM dbo.Guests g WHERE g.FamilyId=f.FamilyId) AS Guests
  FROM dbo.Families f ORDER BY f.SortOrder, f.Name;
  SELECT g.GuestId, g.FamilyId, g.FullName, g.Phone, g.Code, g.IsActive, g.LastSeenAt,
    CASE WHEN a.AttemptId IS NULL THEN 'None' WHEN a.FinishedAt IS NULL THEN 'Playing' ELSE 'Finished' END AS GameState,
    a.Score, a.Total
  FROM dbo.Guests g LEFT JOIN dbo.Attempts a ON a.GuestId=g.GuestId
  ORDER BY g.FullName;
END
GO
CREATE OR ALTER PROC dbo.usp_AdminSaveFamily @FamilyId INT, @Name NVARCHAR(150) AS
BEGIN
  SET NOCOUNT ON;
  SET @Name=NULLIF(LTRIM(RTRIM(@Name)),N'');
  IF @Name IS NULL OR LEN(@Name)>100 BEGIN SELECT 'BadValue' AS Status, CAST(NULL AS INT) AS FamilyId; RETURN; END
  IF EXISTS(SELECT 1 FROM dbo.Families WHERE Name=@Name AND FamilyId<>ISNULL(@FamilyId,0))
  BEGIN SELECT 'Duplicate' AS Status, CAST(NULL AS INT) AS FamilyId; RETURN; END
  IF @FamilyId IS NULL
  BEGIN
    INSERT dbo.Families(Name,SortOrder) VALUES(@Name, ISNULL((SELECT MAX(SortOrder) FROM dbo.Families),0)+1);
    SET @FamilyId=SCOPE_IDENTITY();
  END
  ELSE
  BEGIN
    UPDATE dbo.Families SET Name=@Name WHERE FamilyId=@FamilyId;
    IF @@ROWCOUNT=0 BEGIN SELECT 'NotFound' AS Status, @FamilyId AS FamilyId; RETURN; END
  END
  INSERT dbo.AdminAudit(Action,Details) VALUES('SaveFamily',CONCAT(N'FamilyId=',@FamilyId));
  SELECT 'OK' AS Status, @FamilyId AS FamilyId;
END
GO
CREATE OR ALTER PROC dbo.usp_AdminDeleteFamily @FamilyId INT AS
BEGIN
  SET NOCOUNT ON;
  IF EXISTS(SELECT 1 FROM dbo.Guests WHERE FamilyId=@FamilyId) BEGIN SELECT 'HasGuests' AS Status; RETURN; END
  DELETE FROM dbo.Families WHERE FamilyId=@FamilyId;
  IF @@ROWCOUNT=0 BEGIN SELECT 'NotFound' AS Status; RETURN; END
  INSERT dbo.AdminAudit(Action,Details) VALUES('DeleteFamily',CONCAT(N'FamilyId=',@FamilyId));
  SELECT 'OK' AS Status;
END
GO
/* טלפון אחרי נרמול: 05XXXXXXXX או קווי (9–10 ספרות שמתחילות ב־0) */
CREATE OR ALTER FUNCTION dbo.fn_IsValidPhone(@p VARCHAR(15)) RETURNS BIT AS
BEGIN
  RETURN CASE WHEN @p LIKE '0%' AND LEN(@p) BETWEEN 9 AND 10 AND @p NOT LIKE '%[^0-9]%' THEN 1 ELSE 0 END;
END
GO
/* @Json: {"guestId":null|N,"familyId":N,"fullName":"...","phone":"050-...","isActive":true}
   מחזיר Status: OK | BadValue | NotFound, Field (fullName/familyId/phone/phoneTaken), GuestId, Code */
CREATE OR ALTER PROC dbo.usp_AdminSaveGuest @Json NVARCHAR(MAX) AS
BEGIN
  SET NOCOUNT ON; SET XACT_ABORT ON;
  DECLARE @gid INT, @fid INT, @name NVARCHAR(150), @rawPhone NVARCHAR(40), @active BIT, @code VARCHAR(16);
  SELECT @gid=guestId, @fid=familyId, @name=NULLIF(LTRIM(RTRIM(fullName)),N''), @rawPhone=NULLIF(LTRIM(RTRIM(phone)),N''), @active=ISNULL(isActive,1)
  FROM OPENJSON(@Json) WITH (guestId INT, familyId INT, fullName NVARCHAR(150), phone NVARCHAR(40), isActive BIT);
  DECLARE @phone VARCHAR(15)=dbo.fn_NormalizePhone(@rawPhone);

  DECLARE @field VARCHAR(20)=CASE
    WHEN @name IS NULL OR LEN(@name)>100 THEN 'fullName'
    WHEN NOT EXISTS(SELECT 1 FROM dbo.Families WHERE FamilyId=@fid) THEN 'familyId'
    WHEN @phone IS NOT NULL AND dbo.fn_IsValidPhone(@phone)=0 THEN 'phone'
    WHEN @phone IS NOT NULL AND EXISTS(SELECT 1 FROM dbo.Guests WHERE Phone=@phone AND GuestId<>ISNULL(@gid,0)) THEN 'phoneTaken'
  END;
  IF @field IS NOT NULL BEGIN SELECT 'BadValue' AS Status, @field AS Field, @gid AS GuestId, CAST(NULL AS VARCHAR(16)) AS Code; RETURN; END

  IF @gid IS NULL
  BEGIN
    EXEC dbo.usp_AdminNewCode @code OUTPUT;
    INSERT dbo.Guests(FamilyId,FullName,Phone,Code,IsActive) VALUES(@fid,@name,@phone,@code,@active);
    SET @gid=SCOPE_IDENTITY();
  END
  ELSE
  BEGIN
    UPDATE dbo.Guests SET FamilyId=@fid, FullName=@name, Phone=@phone, IsActive=@active WHERE GuestId=@gid;
    IF @@ROWCOUNT=0 BEGIN SELECT 'NotFound' AS Status, CAST(NULL AS VARCHAR(20)) AS Field, @gid AS GuestId, CAST(NULL AS VARCHAR(16)) AS Code; RETURN; END
    SET @code=(SELECT Code FROM dbo.Guests WHERE GuestId=@gid);
  END
  INSERT dbo.AdminAudit(Action,Details) VALUES('SaveGuest',CONCAT(N'GuestId=',@gid));
  SELECT 'OK' AS Status, CAST(NULL AS VARCHAR(20)) AS Field, @gid AS GuestId, @code AS Code;
END
GO
/* קוד חדש: הקישור הישן מפסיק לעבוד (למשל אם נשלח לאדם הלא נכון) */
CREATE OR ALTER PROC dbo.usp_AdminNewGuestCode @GuestId INT AS
BEGIN
  SET NOCOUNT ON;
  DECLARE @code VARCHAR(16);
  EXEC dbo.usp_AdminNewCode @code OUTPUT;
  UPDATE dbo.Guests SET Code=@code WHERE GuestId=@GuestId;
  IF @@ROWCOUNT=0 BEGIN SELECT 'NotFound' AS Status, CAST(NULL AS VARCHAR(16)) AS Code; RETURN; END
  INSERT dbo.AdminAudit(Action,Details) VALUES('NewGuestCode',CONCAT(N'GuestId=',@GuestId));
  SELECT 'OK' AS Status, @code AS Code;
END
GO
/* מוזמן ששיחק לא נמחק (הניקוד שלו בלוח): מאפסים קודם או משביתים */
CREATE OR ALTER PROC dbo.usp_AdminDeleteGuest @GuestId INT AS
BEGIN
  SET NOCOUNT ON;
  IF EXISTS(SELECT 1 FROM dbo.Attempts WHERE GuestId=@GuestId) BEGIN SELECT 'InUse' AS Status; RETURN; END
  DELETE FROM dbo.Guests WHERE GuestId=@GuestId;
  IF @@ROWCOUNT=0 BEGIN SELECT 'NotFound' AS Status; RETURN; END
  INSERT dbo.AdminAudit(Action,Details) VALUES('DeleteGuest',CONCAT(N'GuestId=',@GuestId));
  SELECT 'OK' AS Status;
END
GO
/* @Json: [{"fullName":"...","family":"משפחת כהן","phone":"050..."},...]
   משפחות חדשות נוצרות לפי שם. הכול או כלום. מחזיר Status, Imported, NewFamilies, BadRow, Field */
CREATE OR ALTER PROC dbo.usp_AdminImportGuests @Json NVARCHAR(MAX) AS
BEGIN
  SET NOCOUNT ON; SET XACT_ABORT ON;
  IF ISJSON(@Json)<>1 BEGIN SELECT 'BadValue' AS Status, 0 AS Imported, 0 AS NewFamilies, CAST(NULL AS INT) AS BadRow, CAST(NULL AS VARCHAR(20)) AS Field; RETURN; END
  DECLARE @r TABLE(n INT PRIMARY KEY, Name NVARCHAR(150), Family NVARCHAR(150), Phone VARCHAR(15), RawPhone NVARCHAR(40));
  INSERT @r(n,Name,Family,RawPhone)
  SELECT CAST(j.[key] AS INT)+1, NULLIF(LTRIM(RTRIM(x.fullName)),N''), NULLIF(LTRIM(RTRIM(x.family)),N''), NULLIF(LTRIM(RTRIM(x.phone)),N'')
  FROM OPENJSON(@Json) j CROSS APPLY OPENJSON(j.[value]) WITH (fullName NVARCHAR(150), family NVARCHAR(150), phone NVARCHAR(40)) x;
  UPDATE @r SET Phone=dbo.fn_NormalizePhone(RawPhone);

  DECLARE @bad INT, @field VARCHAR(20);
  SELECT TOP 1 @bad=n, @field=CASE
      WHEN Name IS NULL OR LEN(Name)>100 THEN 'fullName'
      WHEN Family IS NULL OR LEN(Family)>100 THEN 'family'
      WHEN Phone IS NOT NULL AND dbo.fn_IsValidPhone(Phone)=0 THEN 'phone'
      WHEN Phone IS NOT NULL AND (EXISTS(SELECT 1 FROM dbo.Guests g WHERE g.Phone=r.Phone)
                                  OR EXISTS(SELECT 1 FROM @r r2 WHERE r2.Phone=r.Phone AND r2.n<r.n)) THEN 'phoneTaken'
    END
  FROM @r r
  WHERE Name IS NULL OR LEN(Name)>100 OR Family IS NULL OR LEN(Family)>100
     OR (Phone IS NOT NULL AND (dbo.fn_IsValidPhone(Phone)=0 OR EXISTS(SELECT 1 FROM dbo.Guests g WHERE g.Phone=r.Phone)
                                OR EXISTS(SELECT 1 FROM @r r2 WHERE r2.Phone=r.Phone AND r2.n<r.n)))
  ORDER BY n;
  IF @bad IS NOT NULL OR NOT EXISTS(SELECT 1 FROM @r)
  BEGIN SELECT 'BadValue' AS Status, 0 AS Imported, 0 AS NewFamilies, @bad AS BadRow, @field AS Field; RETURN; END

  BEGIN TRAN;
  DECLARE @before INT=(SELECT COUNT(*) FROM dbo.Families), @base INT=ISNULL((SELECT MAX(SortOrder) FROM dbo.Families),0);
  INSERT dbo.Families(Name,SortOrder)
  SELECT f.Family, @base+ROW_NUMBER() OVER(ORDER BY f.FirstRow)
  FROM (SELECT Family, MIN(n) AS FirstRow FROM @r GROUP BY Family) f
  WHERE NOT EXISTS(SELECT 1 FROM dbo.Families x WHERE x.Name=f.Family);

  DECLARE @n INT=1, @max INT=(SELECT MAX(n) FROM @r), @code VARCHAR(16);
  WHILE @n<=@max
  BEGIN
    EXEC dbo.usp_AdminNewCode @code OUTPUT;
    INSERT dbo.Guests(FamilyId,FullName,Phone,Code)
    SELECT f.FamilyId, r.Name, r.Phone, @code FROM @r r JOIN dbo.Families f ON f.Name=r.Family WHERE r.n=@n;
    SET @n+=1;
  END
  INSERT dbo.AdminAudit(Action,Details) VALUES('ImportGuests',CONCAT(N'Count=',@max));
  COMMIT;
  SELECT 'OK' AS Status, @max AS Imported, (SELECT COUNT(*) FROM dbo.Families)-@before AS NewFamilies, CAST(NULL AS INT) AS BadRow, CAST(NULL AS VARCHAR(20)) AS Field;
END
GO
