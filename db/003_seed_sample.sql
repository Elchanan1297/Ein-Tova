/* נתוני דוגמה לבדיקה מקומית בלבד — למחוק לפני האירוע */
SET NOCOUNT ON;
INSERT dbo.Families(Name,SortOrder) VALUES(N'משפחה א׳',1),(N'משפחה ב׳',2);
INSERT dbo.Guests(FamilyId,FullName,Phone,Code) VALUES
 (1,N'דנה',dbo.fn_NormalizePhone('050-111-2222'),'DANA2024'),
 (1,N'יוסי',dbo.fn_NormalizePhone('+972501113333'),'YOSI2024'),
 (2,N'רות',dbo.fn_NormalizePhone('0521114444'),'RUTH2024');
DECLARE @i INT=1,@q INT;
WHILE @i<=5 BEGIN
  INSERT dbo.Questions(SortOrder,Body,Fact) VALUES(@i,CONCAT(N'שאלה לדוגמה מספר ',@i,N'?'),CONCAT(N'עובדה לדוגמה ',@i));
  SET @q=SCOPE_IDENTITY();
  INSERT dbo.Options(QuestionId,Body,IsCorrect,SortOrder) VALUES(@q,N'תשובה נכונה',1,1),(@q,N'תשובה ב׳',0,2),(@q,N'תשובה ג׳',0,3),(@q,N'תשובה ד׳',0,4);
  SET @i+=1;
END
INSERT dbo.ProgramItems(SortOrder,TimeText,Title,Icon) VALUES(1,'19:00',N'קבלת פנים','door'),(2,'19:30',N'ברכות','mic'),(3,'20:00',N'המשחק הגדול','spark');
GO
