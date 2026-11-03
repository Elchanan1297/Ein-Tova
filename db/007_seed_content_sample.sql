/* נתוני דוגמה לתוכנית ולברכות, לבדיקה מקומית בלבד. למחוק לפני האירוע */
-- נדרש לאינדקסים מסוננים (Options, Guests). sqlcmd מכבה את זה כברירת מחדל
SET QUOTED_IDENTIFIER ON; SET ANSI_NULLS ON;
GO
SET NOCOUNT ON;
IF NOT EXISTS(SELECT 1 FROM dbo.ProgramItems WHERE Icon='film')
  INSERT dbo.ProgramItems(SortOrder,TimeText,Title,Icon) VALUES(4,'20:45',N'סרט מחווה','film'),(5,'21:15',N'הענקת מתנה','gift');
IF NOT EXISTS(SELECT 1 FROM dbo.Greetings)
  INSERT dbo.Greetings(SortOrder,SenderName,Relation,Kind,Body,MediaUrl) VALUES
   (1,N'דנה',N'הבת',  'image',N'אבא, תודה על כל מה שנתת לנו. מזל טוב!','/assets/father-bust.png'),
   (2,N'יוסי',N'הבן', 'text', N'לאבא הכי טוב בעולם, עד 120 בבריאות ובשמחה.',NULL),
   (3,N'רות',N'הנכדה','text', N'סבא, אתה הגיבור שלי. אוהבת המון.',NULL);
GO
