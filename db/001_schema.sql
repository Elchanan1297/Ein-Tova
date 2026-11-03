/* עין טובה — סכמה. להריץ אחרי יצירת מסד ריק בשם EinTova (SQL Server 2019+ / Azure SQL). כל הזמנים ב־UTC. */
SET NOCOUNT ON;
GO
IF OBJECT_ID('dbo.Families') IS NULL
CREATE TABLE dbo.Families(
  FamilyId INT IDENTITY PRIMARY KEY,
  Name NVARCHAR(100) NOT NULL UNIQUE,
  SortOrder INT NOT NULL DEFAULT 0);
GO
IF OBJECT_ID('dbo.Guests') IS NULL
CREATE TABLE dbo.Guests(
  GuestId INT IDENTITY PRIMARY KEY,
  FamilyId INT NOT NULL REFERENCES dbo.Families(FamilyId),
  FullName NVARCHAR(100) NOT NULL,
  Phone VARCHAR(15) NULL,          -- מנורמל: 05XXXXXXXX
  Code VARCHAR(16) NOT NULL,       -- קוד אישי לקישור
  IsActive BIT NOT NULL DEFAULT 1,
  CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  LastSeenAt DATETIME2 NULL);
GO
IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE name='UX_Guests_Code') CREATE UNIQUE INDEX UX_Guests_Code ON dbo.Guests(Code);
IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE name='UX_Guests_Phone') CREATE UNIQUE INDEX UX_Guests_Phone ON dbo.Guests(Phone) WHERE Phone IS NOT NULL;
GO
IF OBJECT_ID('dbo.Settings') IS NULL
CREATE TABLE dbo.Settings(SettingKey VARCHAR(50) PRIMARY KEY, SettingValue NVARCHAR(400) NULL, Note NVARCHAR(200) NULL);
GO
IF OBJECT_ID('dbo.Questions') IS NULL
CREATE TABLE dbo.Questions(
  QuestionId INT IDENTITY PRIMARY KEY,
  SortOrder INT NOT NULL DEFAULT 0,
  Body NVARCHAR(500) NOT NULL,
  ImageUrl NVARCHAR(400) NULL,
  Fact NVARCHAR(600) NULL,         -- "ידעתם?" אחרי המענה
  TimeLimitSec INT NULL,           -- NULL = ברירת המחדל מההגדרות
  IsActive BIT NOT NULL DEFAULT 1);
GO
IF OBJECT_ID('dbo.Options') IS NULL
CREATE TABLE dbo.Options(
  OptionId INT IDENTITY PRIMARY KEY,
  QuestionId INT NOT NULL REFERENCES dbo.Questions(QuestionId) ON DELETE CASCADE,
  Body NVARCHAR(200) NOT NULL,
  IsCorrect BIT NOT NULL DEFAULT 0,
  SortOrder INT NOT NULL DEFAULT 0);
GO
IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE name='UX_Options_OneCorrect') CREATE UNIQUE INDEX UX_Options_OneCorrect ON dbo.Options(QuestionId) WHERE IsCorrect=1;
GO
IF OBJECT_ID('dbo.Attempts') IS NULL
CREATE TABLE dbo.Attempts(
  AttemptId INT IDENTITY PRIMARY KEY,
  GuestId INT NOT NULL UNIQUE REFERENCES dbo.Guests(GuestId),   -- ניסיון אחד בלבד, נאכף ב־DB
  StartedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  FinishedAt DATETIME2 NULL,
  Score INT NOT NULL DEFAULT 0,
  Total INT NOT NULL);
GO
IF OBJECT_ID('dbo.AttemptQuestions') IS NULL
CREATE TABLE dbo.AttemptQuestions(  -- רשימת השאלות הקפואה והמעורבבת של כל שחקן
  AttemptId INT NOT NULL REFERENCES dbo.Attempts(AttemptId) ON DELETE CASCADE,
  Position INT NOT NULL,
  QuestionId INT NOT NULL REFERENCES dbo.Questions(QuestionId),
  ServedAt DATETIME2 NULL,
  AnsweredAt DATETIME2 NULL,
  OptionId INT NULL,
  IsCorrect BIT NULL,
  TimedOut BIT NOT NULL DEFAULT 0,
  PRIMARY KEY(AttemptId, Position));
GO
IF OBJECT_ID('dbo.VoiceClips') IS NULL
CREATE TABLE dbo.VoiceClips(
  ClipId INT IDENTITY PRIMARY KEY,
  EventType VARCHAR(20) NOT NULL CHECK (EventType IN ('Welcome','GameStart','Correct','Incorrect','GameEnd','Winner')),
  FileUrl NVARCHAR(400) NOT NULL,
  Transcript NVARCHAR(300) NULL,
  IsActive BIT NOT NULL DEFAULT 1);
GO
IF OBJECT_ID('dbo.Greetings') IS NULL
CREATE TABLE dbo.Greetings(
  GreetingId INT IDENTITY PRIMARY KEY,
  SortOrder INT NOT NULL DEFAULT 0,
  SenderName NVARCHAR(100) NOT NULL,
  Relation NVARCHAR(100) NULL,
  Kind VARCHAR(10) NOT NULL DEFAULT 'text' CHECK (Kind IN ('text','image','video')),
  Body NVARCHAR(2000) NULL,
  MediaUrl NVARCHAR(400) NULL,     -- תמונה מקומית או קישור YouTube
  IsActive BIT NOT NULL DEFAULT 1);
GO
IF OBJECT_ID('dbo.ProgramItems') IS NULL
CREATE TABLE dbo.ProgramItems(
  ItemId INT IDENTITY PRIMARY KEY,
  SortOrder INT NOT NULL DEFAULT 0,
  TimeText NVARCHAR(10) NOT NULL,
  Title NVARCHAR(100) NOT NULL,
  Icon VARCHAR(20) NULL,
  IsActive BIT NOT NULL DEFAULT 1);
GO
IF OBJECT_ID('dbo.AdminAudit') IS NULL
CREATE TABLE dbo.AdminAudit(AuditId INT IDENTITY PRIMARY KEY, At DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(), Action VARCHAR(50) NOT NULL, Details NVARCHAR(400) NULL);
GO
/* הגדרות ברירת מחדל — כולן ניתנות לעריכה ממסך הניהול */
MERGE dbo.Settings AS t USING (VALUES
 ('GameMode',N'Always',N'Always | Window | Closed'),
 ('OpensAt',NULL,N'ISO UTC, למצב Window'),
 ('ClosesAt',NULL,N'ISO UTC, למצב Window'),
 ('QuestionCount',N'0',N'כמה שאלות במשחק. 0 = כל השאלות הפעילות. נלקחות הראשונות לפי סדר'),
 ('FactsLabelCount',NULL,N'המספר שמוצג בכותרת "X דברים שלא ידעתם על אבא". ריק = כמספר השאלות במשחק'),
 ('SecondsPerQuestion',N'20',N'זמן לשאלה כברירת מחדל'),
 ('GraceMs',N'1500',N'מרווח לרשת באלפיות שנייה'),
 ('VoiceChance',N'0.34',N'הסתברות לניגון קליפ בתשובה נכונה/לא נכונה (0–1)'),
 ('LeaderboardRank',N'Total',N'Total | Average — לפי מה מדרגים משפחות')
) AS s(k,v,n) ON t.SettingKey=s.k WHEN NOT MATCHED THEN INSERT(SettingKey,SettingValue,Note) VALUES(s.k,s.v,s.n);
GO
