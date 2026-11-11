# העלאה לאוויר

אימג' Docker אחד: ה־API מגיש גם את אפליקציית Angular. הנתונים: SQL Server + תיקייה `/data` (קבצים שהועלו ותמונות).

## מה צריך בכל מקרה
| משתנה | מה זה |
|---|---|
| `ConnectionStrings__Db` | חיבור ל־SQL Server / Azure SQL |
| `Jwt__Key` | מחרוזת אקראית, לפחות 32 תווים. **לא להחליף אחרי ששולחים קישורים** (מנתק את כולם) |
| `Admin__Password` | סיסמת מסך הניהול, לפחות 10 תווים |

חסר ערך או נשאר ערך של פיתוח: השרת לא עולה ומדפיס מה חסר.

יצירת מפתח אקראי:
```powershell
[Convert]::ToBase64String((1..48 | % { Get-Random -Max 256 }) -as [byte[]])
```

## בניית המסד (פעם אחת)
```powershell
.\db\setup.ps1 -Server '<שרת>' -Database EinTova -User '<משתמש>'
```
בלי נתוני דוגמה. בטוח להריץ שוב (גם אחרי שמוסיפים סקריפט חדש).

---

## אפשרות א: Azure (מומלץ)
1. **Azure SQL Database** (Basic או Serverless). ב־Networking: "Allow Azure services" + כתובת ה־IP שלך (להרצת setup).
2. בניית המסד: `setup.ps1` מול `<server>.database.windows.net`.
3. **App Service** (Linux, Docker container, B1). מקור: האימג' (Azure Container Registry, או Docker Hub פרטי).
4. **Configuration → Environment variables:** שלושת המשתנים למעלה, ועוד `WEBSITES_PORT=8080`.
5. **Configuration → General:** WebSockets = On (המצגת), Always On = On.
6. **Storage mount:** Azure Files אל `/data` (בלי זה קבצים שהועלו נמחקים בכל עלייה מחדש).
7. **Health check:** `/health`.
8. **דומיין + HTTPS:** Custom domains → Add, ואז Managed certificate (חינם).
9. **גיבוי:** Azure SQL מגבה לבד (7 ימים). Azure Files: לסמן Backup.

## אפשרות ב: שרת VPS עם Docker
1. שרת Linux עם 2GB זיכרון לפחות (SQL Server), Docker מותקן.
2. להעתיק את הפרויקט, ו־`.env` לפי `.env.example`.
3. `docker compose up -d --build`
4. בניית המסד (מהשרת): `setup.ps1 -Server 'tcp:127.0.0.1,14333' -User sa -Create` (דווקא `tcp:127.0.0.1`, לא `localhost`).
5. HTTPS: Caddy או nginx לפני הפורט 8080 (Caddy מוציא תעודה לבד).
6. גיבוי: `BACKUP DATABASE` יומי + העתקה של ה־volume `appdata` למקום אחר.

## בדיקה מקומית של האימג'
```powershell
docker compose up -d --build      # עם .env מלא
$env:SQLCMDPASSWORD = '<SQL_SA_PASSWORD מה־.env>'
.\db\setup.ps1 -Server 'tcp:127.0.0.1,14333' -User sa -Create
```
ואז `http://localhost:8080`. עצירה: `docker compose down` (הנתונים נשמרים ב־volumes; `down -v` מוחק גם אותם).

Docker Desktop נסגר מיד עם "unexpected error ... .sock: The file cannot be accessed"? קבצי socket ישנים מהפעלה קודמת: לסגור את Docker, לשנות שם לתיקיות `%LOCALAPPDATA%\Docker\run` ו־`%LOCALAPPDATA%\docker-secrets-engine`, ולהפעיל מחדש.

## אחרי ההעלאה
- כניסה ל־`/admin` עם `Admin__Password`.
- מוזמנים, שאלות, תוכנית, ברכות, קולות ותמונות.
- בדיקה בטלפונים אמיתיים (אייפון, אנדרואיד, iPad mini): כניסה מקישור, משחק, התקנה למסך הבית.

## מצב Save the date (נעילת האפליקציה)
מסך "שמרו את התאריך" במקום האפליקציה, לכל המוזמנים (גם למי שכבר מחובר). מנהלים ממשיכים כרגיל, עם פס עליון.
- **סדר פריסה:** `db/015_save_the_date.sql` (דרך `setup.ps1`), ואז האימג' החדש. אחרי הפריסה **שום דבר לא משתנה**: הנעילה כבויה עד שמדליקים.
- **הדלקה וכיבוי:** ניהול → Save the date → המתג (עם אישור). שם גם התאריך, הנוסח, הספירה, פתיחה אוטומטית ותצוגה מקדימה.
- **הנעילה בשרת:** כל `/api` מחזיר `423` חוץ מ־`/api/config`, `/api/admin/**` וקבצי תמונות חתומים. הטלפונים עוברים למסך תוך כמה שניות (SignalR `/hubs/state`, ובגיבוי בדיקה כל 60 שניות).
- **חזרה אחורה מיידית בלי מסך הניהול** (ב־Query editor של Azure SQL):
  ```sql
  UPDATE dbo.Settings SET SettingValue=N'0' WHERE SettingKey='SaveTheDateEnabled';
  ```
  השרת קולט את זה תוך 5 שניות, והמוזמנים חוזרים לאפליקציה לבד.

