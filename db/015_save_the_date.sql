-- עין טובה: מצב "Save the date". נעילת האפליקציה לכולם חוץ מהמנהל, עם מסך תאריך וספירה לאחור.
-- בלי שינוי סכמה: רק שורות חדשות ב־Settings. ברירת מחדל: כבוי. בטוח להריץ שוב.
-- חזרה אחורה מיידית (בלי מסך הניהול):
--   UPDATE dbo.Settings SET SettingValue=N'0' WHERE SettingKey='SaveTheDateEnabled';
--   (השרת קולט את השינוי תוך 5 שניות)
SET QUOTED_IDENTIFIER ON; SET ANSI_NULLS ON;
GO
MERGE dbo.Settings AS t USING (VALUES
 ('SaveTheDateEnabled',N'0',N'Save the date: 1 = האפליקציה נעולה לכולם חוץ מהמנהל'),
 ('SaveTheDateEventAt',NULL,N'Save the date: מועד האירוע, ISO UTC'),
 ('SaveTheDateDisplay',N'both',N'gregorian | hebrew | both'),
 ('SaveTheDateHebrewText',NULL,N'דריסה ידנית של התאריך העברי'),
 ('SaveTheDateAfterNightfall',N'0',N'1 = האירוע אחרי השקיעה (התאריך העברי של היום הבא)'),
 ('SaveTheDateHeadline',N'Save the date',N'הכותרת הגדולה'),
 ('SaveTheDateSubline',N'70 · עין טובה',N'שורה קטנה מעל הכותרת'),
 ('SaveTheDateLocation',NULL,N'מקום האירוע (אופציונלי)'),
 ('SaveTheDateShowCountdown',N'1',N'1 = ספירה לאחור'),
 ('SaveTheDateAutoOpenAt',NULL,N'ISO UTC: מרגע זה האפליקציה נפתחת לבד גם אם הנעילה דלוקה')
) AS s(k,v,n) ON t.SettingKey=s.k WHEN NOT MATCHED THEN INSERT(SettingKey,SettingValue,Note) VALUES(s.k,s.v,s.n);
GO
/* נעול = הנעילה דלוקה, ופתיחה אוטומטית לא מוגדרת או עוד לא הגיעה */
CREATE OR ALTER FUNCTION dbo.fn_IsSaveTheDateLocked() RETURNS BIT AS
BEGIN
  IF ISNULL(dbo.fn_Setting('SaveTheDateEnabled'),N'0')<>N'1' RETURN 0;
  DECLARE @open DATETIMEOFFSET=TRY_CONVERT(DATETIMEOFFSET,dbo.fn_Setting('SaveTheDateAutoOpenAt'));
  IF @open IS NOT NULL AND @open<=SYSDATETIMEOFFSET() RETURN 0;
  RETURN 1;
END
GO
/* כל ההגדרות + המצב בפועל. משמש גם את /api/config (הלקוח) וגם את מסך הניהול */
CREATE OR ALTER PROC dbo.usp_GetSaveTheDate AS
BEGIN
  SET NOCOUNT ON;
  SELECT dbo.fn_IsSaveTheDateLocked() AS Locked,
    CAST(CASE WHEN dbo.fn_Setting('SaveTheDateEnabled')=N'1' THEN 1 ELSE 0 END AS BIT) AS Enabled,
    dbo.fn_Setting('SaveTheDateEventAt') AS EventAt,
    ISNULL(dbo.fn_Setting('SaveTheDateDisplay'),N'both') AS Display,
    dbo.fn_Setting('SaveTheDateHebrewText') AS HebrewText,
    CAST(CASE WHEN dbo.fn_Setting('SaveTheDateAfterNightfall')=N'1' THEN 1 ELSE 0 END AS BIT) AS AfterNightfall,
    ISNULL(dbo.fn_Setting('SaveTheDateHeadline'),N'Save the date') AS Headline,
    dbo.fn_Setting('SaveTheDateSubline') AS Subline,
    dbo.fn_Setting('SaveTheDateLocation') AS Location,
    CAST(CASE WHEN ISNULL(dbo.fn_Setting('SaveTheDateShowCountdown'),N'1')=N'1' THEN 1 ELSE 0 END AS BIT) AS ShowCountdown,
    dbo.fn_Setting('SaveTheDateAutoOpenAt') AS AutoOpenAt;
END
GO
/* שמירה אטומית מ־JSON. @Json: {"Enabled":"1","EventAt":"2027-01-14T17:00:00Z",...}
   (שמות בלי הקידומת SaveTheDate). תאריכים נשמרים ב־UTC.
   מחזיר Status: OK | BadKey | BadValue, ו־Field עם המפתח הבעייתי */
CREATE OR ALTER PROC dbo.usp_AdminSaveSaveTheDate @Json NVARCHAR(MAX) AS
BEGIN
  SET NOCOUNT ON; SET XACT_ABORT ON;
  IF ISJSON(@Json)<>1 BEGIN SELECT 'BadValue' AS Status, CAST(NULL AS VARCHAR(50)) AS Field; RETURN; END
  DECLARE @s TABLE(k VARCHAR(50) PRIMARY KEY, v NVARCHAR(400) NULL);
  INSERT @s SELECT [key], NULLIF(LTRIM(RTRIM([value])),N'') FROM OPENJSON(@Json);

  DECLARE @bad VARCHAR(50)=(SELECT TOP 1 k FROM @s WHERE k NOT IN
    ('Enabled','EventAt','Display','HebrewText','AfterNightfall','Headline','Subline','Location','ShowCountdown','AutoOpenAt'));
  IF @bad IS NOT NULL BEGIN SELECT 'BadKey' AS Status, @bad AS Field; RETURN; END

  SELECT TOP 1 @bad=k FROM @s WHERE
       (k IN ('Enabled','AfterNightfall','ShowCountdown') AND ISNULL(v,'') NOT IN (N'0',N'1'))
    OR (k='Display' AND ISNULL(v,'') NOT IN (N'gregorian',N'hebrew',N'both'))
    OR (k IN ('EventAt','AutoOpenAt') AND v IS NOT NULL AND TRY_CONVERT(DATETIMEOFFSET,v) IS NULL)
    OR (k IN ('HebrewText','Headline','Subline','Location') AND LEN(v)>120);
  IF @bad IS NOT NULL BEGIN SELECT 'BadValue' AS Status, @bad AS Field; RETURN; END

  -- תאריכים ל־UTC בפורמט אחיד (2027-01-14T17:00:00Z)
  UPDATE @s SET v=CONVERT(NVARCHAR(40),SWITCHOFFSET(TRY_CONVERT(DATETIMEOFFSET,v),0),127)
  WHERE k IN ('EventAt','AutoOpenAt') AND v IS NOT NULL;

  BEGIN TRAN;
  UPDATE t SET SettingValue=s.v FROM dbo.Settings t JOIN @s s ON t.SettingKey='SaveTheDate'+s.k;
  -- אי אפשר לנעול בלי תאריך אירוע
  IF dbo.fn_Setting('SaveTheDateEnabled')=N'1' AND TRY_CONVERT(DATETIMEOFFSET,dbo.fn_Setting('SaveTheDateEventAt')) IS NULL
  BEGIN ROLLBACK; SELECT 'BadValue' AS Status, CAST('EventAt' AS VARCHAR(50)) AS Field; RETURN; END
  INSERT dbo.AdminAudit(Action,Details) VALUES('SaveTheDate',LEFT(@Json,400));
  COMMIT;
  SELECT 'OK' AS Status, CAST(NULL AS VARCHAR(50)) AS Field;
END
GO
