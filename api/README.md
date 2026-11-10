# עין טובה — API

.NET 9 Minimal API, בחמש שכבות (`EinTova.sln`).

```
api/
├─ EinTova.Models/          DTOs, בקשות ותשובות (בלי תלויות)
├─ EinTova.DataAccess/      Repositories (Dapper, רק פרוצדורות) + StoredProcedures.cs
├─ EinTova.Infrastructure/  Options (הגדרות) + Storage (קבצים על דיסק)
├─ EinTova.Business/        שירות לכל תחום (ממשק + מימוש), מטמון, טוקנים, עיבוד תמונות
└─ EinTova.Api/             רק HTTP: Application/, Mapping/, Hubs/, Middleware/, Program.cs
```

כיוון התלויות: `Api → Business → DataAccess / Infrastructure → Models`.
ה־Repositories הם `internal`: ה־Api לא יכול לגשת ל־DB, רק לשירותים.

## הרצה (Windows, .NET 9)
מתיקיית הפרויקט (`eintova/`):
```powershell
dotnet run --project api/EinTova.Api --urls http://localhost:5080
```
בפיתוח ההגדרות ב־`EinTova.Api/appsettings.Development.json`.

## ייצור: משתני סביבה (חובה)
| משתנה | מה זה |
|---|---|
| `ASPNETCORE_ENVIRONMENT` | `Production` |
| `ConnectionStrings__Db` | חיבור ל־SQL Server / Azure SQL |
| `Jwt__Key` | מחרוזת אקראית, לפחות 32 תווים |
| `Admin__Password` | סיסמת המנהל, לפחות 10 תווים |
| `Media__Root`, `Photos__Root` | תיקיות קבועות לקבצים (volume) |

חסר ערך, או נשאר ערך של פיתוח: השרת לא עולה ומדפיס מה חסר.
`/health` מחזיר 200 כשהשרת וה־DB עונים.

## בדיקה ב־PowerShell
```powershell
Invoke-RestMethod http://localhost:5080/health
$r = Invoke-RestMethod -Method Post http://localhost:5080/api/login/code -ContentType application/json -Body '{"code":"YOSI2024"}'
$h = @{ Authorization = "Bearer $($r.token)" }
Invoke-RestMethod -Method Post http://localhost:5080/api/game/start -Headers $h
Invoke-RestMethod http://localhost:5080/api/leaderboard
```
