<#
  עין טובה: בניית מסד נתונים מאפס, כל הסקריפטים לפי הסדר.
  בלי נתוני הדוגמה (003, 007, 008) אלא אם מוסיפים -Sample.

  דוגמאות:
    # מקומי (Windows Authentication), יוצר את המסד אם אין
    .\db\setup.ps1 -Server 'ELCHANAN\SQLEXPRESS' -Database EinTova_Test -Create -Sample

    # Azure SQL / Docker (משתמש וסיסמה; הסיסמה נשאלת ולא נשמרת)
    .\db\setup.ps1 -Server 'myserver.database.windows.net' -Database EinTova -User eintova_admin

  בטוח להריץ שוב: הסכמה בודקת אם טבלה קיימת, והפרוצדורות הן CREATE OR ALTER.
#>
param(
    [Parameter(Mandatory)][string]$Server,
    [string]$Database = 'EinTova',
    [string]$User,
    [switch]$Create,
    [switch]$Sample
)
$ErrorActionPreference = 'Stop'
$dir = $PSScriptRoot

$scripts = @(
    '001_schema.sql', '002_procs.sql', '003_seed_sample.sql',
    '004_timeout.sql', '005_leaderboard_display.sql', '006_content_procs.sql',
    '007_seed_content_sample.sql', '008_seed_voice_sample.sql',
    '009_admin_settings.sql', '010_admin_questions.sql', '011_admin_guests.sql',
    '012_admin_content.sql', '013_admin_reset_all.sql', '014_photos.sql', '015_save_the_date.sql'
)
$sampleOnly = '003_seed_sample.sql', '007_seed_content_sample.sql', '008_seed_voice_sample.sql'

# -I: QUOTED_IDENTIFIER ON (יש אינדקסים מסוננים). -b: עוצר בשגיאה הראשונה. -f 65001: UTF-8 (עברית)
$auth = @('-E')
if ($User) {
    # אם SQLCMDPASSWORD כבר מוגדר (סקריפט אוטומטי), לא שואלים
    if (-not $env:SQLCMDPASSWORD) {
        $secure = Read-Host "Password for $User" -AsSecureString
        $env:SQLCMDPASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure))
    }
    $auth = @('-U', $User)
}

try {
    if ($Create) {
        Write-Host "Creating database $Database (if missing)..."
        & sqlcmd -S $Server @auth -b -Q "IF DB_ID(N'$Database') IS NULL CREATE DATABASE [$Database]"
        if ($LASTEXITCODE) { throw "CREATE DATABASE failed" }
    }
    foreach ($s in $scripts) {
        if (-not $Sample -and $sampleOnly -contains $s) { Write-Host "skip  $s (sample data)"; continue }
        Write-Host "run   $s"
        & sqlcmd -S $Server -d $Database @auth -I -b -f 65001 -i (Join-Path $dir $s)
        if ($LASTEXITCODE) { throw "$s failed (exit $LASTEXITCODE)" }
    }
    Write-Host "Done: $Database is ready."
}
finally {
    Remove-Item Env:SQLCMDPASSWORD -ErrorAction SilentlyContinue
}
