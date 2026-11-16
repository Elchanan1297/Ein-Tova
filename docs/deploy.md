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


## משחק בטלפון כשר (ימות המשיח)

מי שאין לו סמארטפון מתקשר למספר בימות המשיח ומשחק בהקשות. אותו משחק, אותו ניקוד, אותו לוח תוצאות.

1. **מפתח סודי:** ב־PowerShell מריצים `-join ((48..57)+(97..122) | Get-Random -Count 24 | % {[char]$_})` ומעתיקים את התוצאה. לא שומרים אותה בקוד.
2. **Azure:** App Service → Environment variables → App settings → מוסיפים `Ivr__Key` עם המפתח → Apply. ריק = הקו כבוי.
3. **ימות המשיח:** בשלוחה הראשית (או בשלוחה ייעודית) מגדירים:
   ```
   type=api
   api_link=https://<הדומיין>/api/ivr?key=<המפתח>
   ```
4. **זיהוי:** לפי המספר שממנו מתקשרים (הטלפון של המוזמן במסך הניהול). מספר לא מוכר (טלפון בבית) מתבקש להקיש את מספר הטלפון של המוזמן.
5. **זמן:** זמן לשאלה כמו במשחק, ועוד "זמן נוסף בטלפון" (ניהול → הגדרות, ברירת מחדל 30 שניות).

בדיקה: `https://<הדומיין>/api/ivr?key=<המפתח>&ApiPhone=<טלפון של מוזמן>` מחזיר שורה שמתחילה ב־`read=t-שלום`.

## דשבורד וסיום המשחק

- **בזמן המשחק:** ניהול → דשבורד. מתעדכן כל 3 שניות: מי התחיל, מי משחק עכשיו, משפחות, שחקנים ושאלות. גלוי רק למנהל.
- **בסוף:** "סיום המשחק ופרסום" סוגר את המשחק לכולם ופותח את "תוצאות וסטטיסטיקות" באפליקציה, ואת סצנת "סטטיסטיקות" במצגת (מקש 5).
- **ביטול:** "ביטול הפרסום" באותו מסך. כדי לפתוח שוב את המשחק: הגדרות ומשחק → פתח עכשיו.
- **מהירות:** זמן מהגשת השאלה ועד התשובה. בשוויון בניקוד, המהיר עולה. שחקני טלפון כשר לא נמדדים במהירות.

## תובנות AI (Gemini)

1. **מפתח:** ב־aistudio.google.com → Get API key (בלי כרטיס אשראי). לא שומרים בקוד.
2. **Azure:** App settings → מוסיפים `AI__ApiKey` עם המפתח → Apply.
3. **מודלים:** ב־`appsettings.json` (`AI__Model`, `AI__FallbackModel`). לפני האירוע לבדוק ב־AI Studio (Rate limits) שהמודל עדיין קיים וחינמי, ואפשר לדרוס במשתני סביבה בלי קוד.
4. **הפעלה:** ניהול → הגדרות ומשחק → תובנות AI. כשכבוי אין שום קריאה חיצונית.
5. **פרטיות:** בשכבה החינמית Google עשויה להשתמש בתוכן. נשלחים נתונים מצטברים וטקסט השאלות, בלי שמות שחקנים, טלפונים או קודים.
