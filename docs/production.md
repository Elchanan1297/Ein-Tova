# הפרודקשן שלנו בפועל (ואיך עובדים עליו מכל מחשב)

`docs/deploy.md` הוא מדריך כללי. כאן מה שבאמת קיים באוויר, איך מעלים גרסה, ואיפה כל דבר נשמר.
**אין כאן סודות.** הערכים עצמם נמצאים רק ב־Azure (App settings) וב־`.env` המקומי, שלא נכנס ל־git.

## המשאבים ב־Azure
כולם ב־Resource group ‏`eintova-rg`, אזור **Israel Central**.

| מה | שם | הערות |
|---|---|---|
| App Service (Linux, Docker container) | `eintova-elchanan` | תוכנית `eintova-plan`. מריץ את האימג' מ־ACR |
| Container Registry | `eintovaelchanan.azurecr.io` | אימג' `eintova:latest` |
| Azure SQL | שרת `eintova-sql-elchanan.database.windows.net`, מסד `EinTova` | משתמש `eintova_admin` |
| Storage account | `eintovafiles` (Azure Files, SMB) | מחובר ל־App Service ב־Path mappings בשם `data`, לנתיב `/data` |
| דומיין | `hofman70.co.il` ו־`www.hofman70.co.il` | DNS אצל LiveDNS. תעודה: App Service Managed certificate |
| כתובת ברירת מחדל | `https://eintova-elchanan-fhgrbkc5asdvcnbd.israelcentral-01.azurewebsites.net` | בדיקה: `/health` מחזיר `{"status":"OK"}` |

## משתני סביבה ב־App Service (רק שמות)
`ConnectionStrings__Db`, ‏`Jwt__Key` (לא להחליף אחרי ששלחו קישורים), ‏`Admin__Password`, ‏`WEBSITES_PORT=8080`, ‏`Ivr__Key` (קו הטלפון הכשר), ‏`AI__ApiKey` (Gemini).
ב־General settings: WebSockets = On, Always On = On. Health check: `/health`.

## איפה כל דבר נשמר
- **נתונים** (מוזמנים, שאלות, תשובות, הגדרות, ברכות, תוכנית): Azure SQL. לוגיקת המשחק בפרוצדורות (`db/`).
- **קבצים שהמנהל מעלה** (תמונות ברכות, קליפי קול): `/data/media` (`Media__Root`), מוגשים ב־`/media`.
- **תמונות "מסע בזמן"**: `/data/photos` (`Photos__Root`), מוגשות רק בכתובת חתומה דרך `/api/photos/...`.
- `/data` הוא Azure Files, ולכן נשאר אחרי ריסטרט ואחרי העלאת גרסה. בלי ה־mount הקבצים היו נמחקים.
- מקומית אותם קבצים נשמרים ב־`api/EinTova.Api/media/` וב־`api/EinTova.Api/photos-data/` (לא ב־git).

## העלאת גרסה (כך עשינו בכל פעם)
1. `npm run build` ב־`web/` ו־`dotnet build` עוברים, ונבדק בטלפון וב־iPad mini.
2. אם יש סקריפט DB חדש: להריץ קודם מול Azure SQL:
   `./db/setup.ps1 -Server 'tcp:eintova-sql-elchanan.database.windows.net,1433' -Database EinTova -User eintova_admin`
   (הסיסמה נשאלת ולא נשמרת. בטוח להריץ שוב.)
3. בניית האימג' מתיקיית הפרויקט:
   `docker build -t eintova:latest .`
   **במק עם שבב Apple (M1 ומעלה) חובה:** `docker build --platform linux/amd64 -t eintova:latest .`
   אחרת האימג' ייבנה ל־ARM וה־App Service לא יעלה.
4. כניסה ל־ACR (פעם אחת לכל מחשב, המשתמש מקליד בעצמו): `az login`, ואז `az acr login --name eintovaelchanan`.
5. `docker tag eintova:latest eintovaelchanan.azurecr.io/eintova:latest`
   `docker push eintovaelchanan.azurecr.io/eintova:latest` (אם נכשל באמצע, פשוט לנסות שוב).
6. **ריסטרט ידני** ב־Azure Portal: App Service `eintova-elchanan` → Restart. בלי זה הגרסה הישנה ממשיכה לרוץ.
7. בדיקה: `/health` בשתי הכתובות, ופתיחה של `/admin` בדפדפן (Ctrl+Shift+R אם נראית גרסה ישנה).

## Git
- מאגר: `https://github.com/Elchanan1297/Ein-Tova` (ענף `main`).
- **דוחפים רק כ־`Elchanan1297`**, לא בחשבון אחר. את ה־push מריץ המשתמש בעצמו בטרמינל.
- commit ו־push רק כשהמשתמש מבקש.
- לא ב־git: `.env`, `appsettings.Production.json`, `media/`, `photos-data/`. גם `dashboard-demo.html` ו־`dashboard-spec.md` לא נכנסים ל־commit.

## הקמה במק (פעם אחת)
1. להתקין: Docker Desktop, ‏.NET 9 SDK, ‏Node 22 (כמו ב־`Dockerfile`), ‏Azure CLI (`brew install azure-cli`), ‏PowerShell (`brew install powershell`, בשביל `db/setup.ps1`), ‏sqlcmd (`brew install sqlcmd`).
2. `git clone https://github.com/Elchanan1297/Ein-Tova.git`, ואז `npm ci` ב־`web/`.
3. להעביר את `.env` מהמחשב הישן בדרך בטוחה (לא במייל, לא בצ'אט).
4. **SQL Server מקומי:** במק אין SQL Server Express, אז מריצים את ה־SQL מ־`docker-compose.yml` (ב־Docker Desktop להפעיל "Use Rosetta for x86/amd64 emulation"). בניית המסד:
   `pwsh ./db/setup.ps1 -Server 'tcp:127.0.0.1,14333' -User sa -Create`
   ואז נתוני הדוגמה (`003`, `007`, `008`) אם רוצים לבדוק עם נתונים.
5. מחרוזת החיבור לפיתוח במק שונה מ־Windows (`ELCHANAN\SQLEXPRESS` לא קיים): להגדיר `ConnectionStrings__Db` כמשתנה סביבה מקומי אל `127.0.0.1,14333`, ולא לשנות את `appsettings.json`.
6. הרצה מקומית: API ב־`dotnet run --project api/EinTova.Api --urls http://localhost:5080`, ו־`npm start` ב־`web/` (proxy ל־5080). סיסמת ניהול בפיתוח: `dev-admin`. מוזמן לדוגמה: הטלפון `050-111-2222` (דנה, מ־`db/003_seed_sample.sql`).

## מצב נכון ל־24.11.2026
- באוויר: עיצוב הניהול החדש (תפריט צד, רוחב מלא, הגדרות כאריחים), רשימות נפתחות חדשות, AI מהיר יותר.
- האימג' עם **תמונות ברכה שלמות** (רקע מטושטש, בלי חיתוך) הועלה ל־ACR, **וצריך לוודא שנעשה ריסטרט**.
- לא נבדק עדיין: מהירות Gemini האמיתית בפרודקשן, ובדיקות בטלפונים אמיתיים.
