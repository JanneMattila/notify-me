@echo off
setlocal

if "%~1"=="" (
    echo Usage: notifyme "text" ["url"]
    echo    or: notifyme text without quotes
    exit /b 1
)

set "TMPFILE=%TEMP%\notifyme_%RANDOM%.json"

REM If 0 or 1 effective argument, or 3+, it's text-only
if "%~2"=="" goto :textonly
if not "%~3"=="" goto :textonly

REM Exactly 2 args - check if second looks like a URL
set "CHECK=%~2"
if /i "%CHECK:~0,4%"=="http" goto :texturl

:textonly
if "%~2"=="" (
    echo {"text":"%~1"}>"%TMPFILE%"
) else (
    echo {"text":"%*"}>"%TMPFILE%"
)
goto :send

:texturl
echo {"text":"%~1","url":"%~2"}>"%TMPFILE%"

:send
curl %NOTIFY_ME_URL% -H "Authorization: Bearer %NOTIFY_ME%" --json @"%TMPFILE%"
set "CURL_EXIT=%errorlevel%"
del "%TMPFILE%" 2>nul
exit /b %CURL_EXIT%
