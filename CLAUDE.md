# עין טובה — אפליקציית משחק משפחתית ליום הולדת 70 של אבא

הוראות לעבודה בפרויקט הזה. **לענות למשתמש בעברית.** המשתמש הוא מפתח Angular מנוסה (Windows, .NET 9 SDK, SQL Server Express `ELCHANAN\SQLEXPRESS`, SSMS). הוא מעדיף הוראות קצרות, צעד אחר צעד, ושאלה אחת בין שלב לשלב. לא לכתוב הסברים ארוכים.

## מה בונים
PWA בעברית (RTL) שכל מוזמן פותח בטלפון: משחק "70 עובדות שלא ידעתם על אבא" (חידון), לוח תוצאות חי לפי משפחות, ברכות מצולמות, תוכנית הערב, קולות של אבא (קליפים מוכנים), ומצגת למסך גדול. מסך ניהול דינמי. חייב לעבוד טוב בטלפון, ב־iPad mini ובטאבלטי סמסונג.

## סטאק
- **DB:** SQL Server (גם Azure SQL בהמשך). לוגיקה עסקית בפרוצדורות. סקריפטים ב־`db/` (001 סכמה, 002 פרוצדורות, 003 נתוני דוגמה, 004 סגירת שאלה בזמן, 005 DisplayScore בלוח התוצאות, 006 תוכנית וברכות, 007 דוגמה לתוכנית וברכות, 008 קליפי קול לדוגמה, 009 ניהול: הגדרות וסטטיסטיקה, 010 ניהול שאלות, 011 ניהול מוזמנים, 012 ניהול תוכן, 013 איפוס המשחק לכולם, 014 תמונות "מסע בזמן"). להריץ סקריפטים ב־sqlcmd רק עם `SET QUOTED_IDENTIFIER ON` בראש הקובץ (יש אינדקסים מסוננים). **רצים ועובדים.**
- **API:** .NET 9 Minimal API + Dapper + JWT (`api/`, פתרון `EinTova.sln` בחמש שכבות, ראה "מבנה `api/`"). **רץ ועובד.** קורא רק לפרוצדורות.
- **Web:** Angular 22 (zoneless, OnPush, Signals, standalone, lazy routes), PWA עם Service Worker (`web/`). קיימים: פתיחה, כניסה, בית, משחק, לוח תוצאות, ברכות, תוכנית, קולות (תמלול + השתקה), אופליין, ניהול, מצגת.
- **אירוח:** יוחלט ברגע ההעלאה (Azure או VPS). לכן: הגדרות ממשתני סביבה, Docker, T-SQL שרץ גם ב־Express וגם ב־Azure SQL.

## החלטות שננעלו (לא לפתוח מחדש בלי לשאול)
- כניסה: קישור אישי עם קוד (`Guests.Code`) + גיבוי במספר טלפון. אין הרשמה עצמית.
- המשחק: כל אחד משחק לבד מהטלפון, **ניסיון אחד בלבד** (נאכף ב־`UNIQUE(GuestId)`). כולם מקבלים אותו סט שאלות בסדר אקראי; סדר התשובות אקראי וקבוע לשחקן.
- טיימר לשאלה **נמדד בשרת** (`ServedAt`); בטלפון רק תצוגה. השרת לא שולח את התשובה הנכונה לפני המענה.
- ניקוד: מספר תשובות נכונות. סיכום לכל משפחה; `LeaderboardRank` = `Total` או `Average`.
- לוח תוצאות חי ותמיד גלוי (רענון כל 5–10 שניות באפליקציה, SignalR רק במצגת, מטמון קצר בשרת).
- מספר השאלות במשחק (`QuestionCount`) והמספר בכותרת "X דברים שלא ידעתם על אבא" (`FactsLabelCount`) דינמיים ונערכים במסך הניהול.
- המשחק נפתח/נסגר דרך `GameMode` (`Always` | `Window` | `Closed`) + כפתור "פתח/סגור עכשיו".
- השאלות נכתבות על ידי המשתמש במסך הניהול (גם ייבוא CSV/Excel). אין הגשת שאלות על ידי המשפחה.
- "ברכות" (במקום "סיפורי חיים"): המשתמש מעלה בעצמו דרך הניהול; תמונות מקטינים אוטומטית ל־WebP; סרטונים כקישור חיצוני (YouTube לא רשום). תצוגה: פיד אנכי (ברירת מחדל).
- קולות של אבא (נוצרו חיצונית, בינה מלאכותית): טבלת `VoiceClips` לפי אירוע (Welcome, GameStart, Correct, Incorrect, GameEnd, Winner), כמה וריאציות לכל אירוע, `VoiceChance` להסתברות ניגון. ניגון רק אחרי לחיצה (מסך הפתיחה משחרר את חסימת האודיו). **חובה:** תמלול על המסך, כפתור השתקה, וסימון "קול שנוצר בבינה מלאכותית".
- אופליין: Service Worker שומר מעטפת, תמונות וקליפי קול. משחק עצמו דורש חיבור.

## עיצוב (סגור): לוגו העין
- לוגו נבחר: עין זהובה + קשת (כחול/שמנת) + "ע׳ין טובה" בכתב יד. נכסים ב־`design/brand/` ו־`web/public/assets/logo/`. **אין לשנות את הלוגו.**
- גרסה לרקע כהה (`*-dark`) באפליקציה; גרסה לרקע בהיר (`*-light`) בהדפסים/רקע שמנת.
- פלטה: חצות `#1E2235`, חצות בהיר `#2F3659`, זהב `#D9B66F`, זהב עמוק `#BE9550`, זהב כהה `#9A7634`, שמנת `#F8F3EA`.
- פונטים: Frank Ruhl Libre (כותרות, מספרים, שעות), Assistant (גוף וממשק). RTL.
- זכוכית נוזלית (liquid glass): `web/src/styles/glass.css` + `tokens.css`. מעבר מרובע־אנימציה: ספרינג `cubic-bezier(.34,1.5,.5,1)`, עדשת זכוכית שנעה על סרגל הטאבים, `rise` מדורג בכניסה, כיבוד `prefers-reduced-motion`. `backdrop-filter` רק במקומות הכרחיים (ביצועים בטלפון ישן).
- מסכים (הדמיות מדויקות ב־`design/reference/`): פתיחה (70 זהב + אבא + לוגו + "בואו נתחיל"), בית (4 אריחים), לוח תוצאות, ברכות, משחק (טיימר, 4 תשובות, "המשך"), תוכנית הערב. סרגל תחתון: בית · תוכנית · ברכות · תמונות · משחק · תוצאות.
- פריסה: טלפון → עמודה עד 560px; ≥744px (iPad mini / טאבלט) עמודה מרכזית 680px ורשת אריחים; ≥1100px מצגת/מסך גדול. לבדוק גם אנכי וגם אופקי.
- תמונת אבא ממורכזת **לפי הראש** (קובץ `father-bust.png`/`father-full.png`, גזירה שקופה). התמונה ברזולוציה נמוכה (900px) — להחליף במקור גבוה לפני הדפסה.

## מבנה `api/` (שכבות, הפרדת אחריות)
- `EinTova.Models` — DTOs, בקשות ותשובות. בלי תלויות.
- `EinTova.DataAccess` — `Repositories/` (Dapper, רק פרוצדורות) + `StoredProcedures.cs` (כל שמות ה־usp). ה־Repositories הם `internal` ונראים רק ל־Business (`InternalsVisibleTo`): ה־Api לא יכול לגשת ל־DB.
- `EinTova.Infrastructure` — `Options/` (JwtOptions, AdminOptions, MediaOptions, PhotosOptions) ו־`Storage/` (קבצים על דיסק).
- `EinTova.Business` — שירות לכל תחום: ממשק ציבורי + מימוש `internal` (Auth, Game, Leaderboard, Content, Admin, Media, Photos, Show). מטמון, טוקנים, עיבוד תמונות. `BusinessRegistration.cs` רושם את השכבה ואת ה־Repositories. לא מכיר HTTP (המצגת דרך `IShowNotifier`).
- `EinTova.Api` — רק HTTP. `Application/` (ApplicationServices, InfrastructureServices, ApplicationBusinessServices, ApplicationMiddleware, ApplicationMappings), `Mapping/` (קובץ לכל תחום, נקודות דקות), `Hubs/` (ShowHub), `Middleware/` (שגיאות במקום אחד). `Program.cs` כ־10 שורות.
- הגדרות: סודות הפיתוח רק ב־`appsettings.Development.json`. בייצור השרת **לא עולה** אם חסר `ConnectionStrings__Db` / `Jwt__Key` / `Admin__Password`, או אם נשאר ערך פיתוח.
- `/health` בודק שהשרת חי וה־DB עונה.
- נקודה חדשה: Repository → שירות ב־Business (ממשק + מימוש, רישום ב־`BusinessRegistration`) → `Mapping/`.

## מבנה `web/` (גישת פיצ'רים)
- `src/app/core/` — שירותים גלובליים (singleton): `auth/` (store, guard, interceptor, models), `config/` (הגדרות ציבוריות), `audio/` (קולות של אבא).
- `src/app/layout/` — מעטפת (`shell`) וסרגל טאבים (`tab-bar`).
- `src/app/features/<name>/` — פיצ'ר לכל מסך: `<name>-page.ts` (default export ל־lazy load), ובתוכו לפי צורך `data/` (API + models), `ui/` (רכיבים פנימיים), `<name>.routes.ts`.
- `src/app/shared/ui/` — רק רכיבים שמשמשים ביותר מפיצ'ר אחד. קיימים: `icon` (אייקוני קו לפי שם), `eye-loader` (ספינר העין שמצמצת, CSS ב־`styles/eye-loader.css`; כל טעינה באפליקציה משתמשת בו, לא בטקסט "טוען…").
- `src/styles/` — `tokens.css`, `glass.css`. `public/assets/` — לוגו ותמונות.
- ה־Service Worker פועל רק ב־build של production. לבדיקה: `dotnet run --project api/EinTova.Api --urls http://localhost:5080 -- --webroot <web/dist/eintova-web/browser>` (כך גם יעבוד באירוע: ה־API מגיש את האפליקציה). הדפדפן המובנה של Claude לא תומך ב־SW, לבדוק ב־Chrome.
- קבצים שמועלים בניהול: `Media__Root` (ברירת מחדל `api/EinTova.Api/media/`, לא ב־git), מוגשים ב־`/media`. בפיתוח `proxy.conf.json` מעביר גם `/media` ו־`/hubs` (WebSocket) ל־5080. תמונות: SkiaSharp (לא ImageSharp: גרסה 4 דורשת רישיון ו־3.1 עם פגיעויות).
- תמונות "מסע בזמן" (`PhotoService`, `PhotoProcessor`, `PhotoUrls` ב־Business; `DiskPhotoStorage` ב־Infrastructure): בתיקייה `Photos__Root` (ברירת מחדל `api/EinTova.Api/photos-data/`, לא ב־git), **לא** תחת `/media`. מוגשות דרך `/api/photos/{id}/{size}` עם כתובת חתומה (HMAC, תוקף ~יומיים; `k=g` רק שפורסמו, `k=a` מנהל כולל מקור). כל קובץ מקודד מחדש (בלי EXIF/GPS). HEIC עוד לא נתמך (שלב ב׳).
- כל רכיב `OnPush` + Signals, בלי zone.js. קריאות API יחסיות (`/api/...`); בפיתוח `proxy.conf.json` → `localhost:5080`.
- שמות קבצים לפי מדריך הסגנון החדש: `login-page.ts` / `LoginPage`, `auth-store.ts` / `AuthStore`.

## מצב נוכחי ומה הבא
ראה `docs/roadmap.md`. ניהול נבנה בפרוסות: 1) כניסה + הגדרות + מצב משחק (קיים, `/admin`, סיסמת פיתוח `dev-admin`, בייצור `Admin__Password`). 2) שאלות (קיים). 3) מוזמנים ומשפחות (קיים). 4) תוכן + העלאות (קיים). 5) מצגת `/show` + שלט `/admin/show` (קיים). הצעד הבא: העלאה לאוויר (Dockerfile, משתני סביבה, Azure/VPS), ובדיקות בטלפונים אמיתיים.

## כללים
- לא לכתוב לוגיקת משחק/ניקוד ב־API או ב־Angular: היא בפרוצדורות.
- שינוי סכמה = סקריפט חדש ממוספר ב־`db/` (לא לערוך את 001/002 אחרי שרצו, חוץ מתיקון באג — ואז לציין).
- כל מחרוזת חיבור/מפתח ממשתני סביבה; `appsettings.json` רק ערכי פיתוח.
- לפני סיום משימה: להריץ build, ולבדוק במסכים בגדלי טלפון ואייפד מיני.
- לא לשמור סודות בקוד. מפתח JWT בפיתוח בלבד.
- טקסט באפליקציה: בלי מקפים ארוכים (— / –) ובלי ניסוחים "של AI". משפטים קצרים וטבעיים בעברית.
- פונטים אחידים: Frank Ruhl רק לכותרות (h1/h2) ולמספרים גדולים עומדים לבד (70, ציון, נתוני פתיחה). כל השאר, כולל מספרים בתוך ממשק (אחוזים, טיימר, אותיות תשובה), ב־Assistant.
