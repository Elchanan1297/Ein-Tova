/* קליפי קול לדוגמה (צלצולים, לא הקול של אבא), לבדיקה מקומית בלבד. למחוק לפני האירוע,
   יחד עם web/public/assets/voice/dev/ */
-- נדרש לאינדקסים מסוננים (Options, Guests). sqlcmd מכבה את זה כברירת מחדל
SET QUOTED_IDENTIFIER ON; SET ANSI_NULLS ON;
GO
SET NOCOUNT ON;
IF NOT EXISTS(SELECT 1 FROM dbo.VoiceClips)
  INSERT dbo.VoiceClips(EventType,FileUrl,Transcript) VALUES
   ('Welcome',  '/assets/voice/dev/chime-up.wav',   N'ברוכים הבאים ליום ההולדת שלי!'),
   ('GameStart','/assets/voice/dev/chime-up.wav',   N'בואו נראה כמה אתם מכירים אותי.'),
   ('Correct',  '/assets/voice/dev/chime-up.wav',   N'יפה מאוד! ידעתי שאתם מכירים אותי.'),
   ('Correct',  '/assets/voice/dev/chime-up.wav',   N'בדיוק ככה!'),
   ('Incorrect','/assets/voice/dev/chime-down.wav', N'לא נורא, עכשיו אתם יודעים.'),
   ('GameEnd',  '/assets/voice/dev/chime-up.wav',   N'כל הכבוד שסיימתם! תודה ששיחקתם.');
GO
