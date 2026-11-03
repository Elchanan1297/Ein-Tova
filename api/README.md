# עין טובה — API (שלב 2)

**לא קומפל בסביבה שלי (אין שם .NET). אם יש שגיאת build, תעתיק אותה אליי כמו שהיא.**

## הרצה (Windows, .NET 9)
```powershell
cd api
dotnet run --urls http://localhost:5080
```
## בדיקה ב־PowerShell
```powershell
Invoke-RestMethod http://localhost:5080/api/config
$r = Invoke-RestMethod -Method Post http://localhost:5080/api/login/code -ContentType application/json -Body '{"code":"YOSI2024"}'
$h = @{ Authorization = "Bearer $($r.token)" }
Invoke-RestMethod -Method Post http://localhost:5080/api/game/start -Headers $h
$q = Invoke-RestMethod http://localhost:5080/api/game/next -Headers $h; $q.head; $q.options
Invoke-RestMethod -Method Post http://localhost:5080/api/game/answer -Headers $h -ContentType application/json -Body ('{"optionId":' + $q.options[0].optionId + '}')
Invoke-RestMethod http://localhost:5080/api/leaderboard
```
דנה (GuestId 1) כבר התחילה ניסיון בבדיקה הקודמת. לאיפוס ב־SSMS: `EXEC usp_AdminResetAttempt 1;`
