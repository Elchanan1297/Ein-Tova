# עין טובה — מסד נתונים (שלב 1)

**לא נבדק מול SQL Server בסביבה שלי — להריץ מקומית ולדווח על שגיאות.**

## הרצה ב־Windows (LocalDB או SQL Express)
1. יצירת מסד: `sqlcmd -S "(localdb)\MSSQLLocalDB" -Q "CREATE DATABASE EinTova"`
   (ל־Express: `-S .\SQLEXPRESS -E`).
2. הרצה לפי הסדר:
   `sqlcmd -S "(localdb)\MSSQLLocalDB" -d EinTova -i 001_schema.sql`, אחר כך `002_procs.sql`, ולבדיקה `003_seed_sample.sql`, ואז `004_timeout.sql` ו־`005_leaderboard_display.sql`, `006_content_procs.sql` (ולבדיקה `007_seed_content_sample.sql`, `008_seed_voice_sample.sql`), `009_admin_settings.sql`, `010_admin_questions.sql`, `011_admin_guests.sql`, `012_admin_content.sql`, `013_admin_reset_all.sql`, `014_photos.sql`, `015_save_the_date.sql` (מצב Save the date, כבוי כברירת מחדל), `016_show_quiz.sql` (החידון במצגת).

**חשוב:** ב־sqlcmd להוסיף `-I` (או `SET QUOTED_IDENTIFIER ON` בראש הקובץ, כמו בסקריפטים 004 ואילך). בלי זה פרוצדורות שנוגעות ב־Options/Guests נכשלות בגלל האינדקסים המסוננים.
3. בדיקה מהירה (SSMS / Azure Data Studio):
   `EXEC usp_GetPublicConfig; EXEC usp_LoginByCode 'DANA2024'; EXEC usp_StartAttempt 1; EXEC usp_NextQuestion 1;`

## מספר דינמי
- `QuestionCount` — כמה שאלות במשחק (0 = כל הפעילות; נלקחות הראשונות לפי `SortOrder`, וכולם מקבלים אותו סט בסדר אקראי).
- `FactsLabelCount` — המספר שמופיע בכותרת "X דברים שלא ידעתם על אבא". ריק = כמספר השאלות.
- שניהם נערכים ב־`Settings` (בהמשך ממסך הניהול).
