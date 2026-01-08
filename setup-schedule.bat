@echo off
chcp 65001 >nul
echo ═══════════════════════════════════════════════════════
echo   OiiOii 自動簽到 - Windows 排程設定
echo ═══════════════════════════════════════════════════════
echo.

set TASK_NAME=OiiOii_AutoCheckin
set SCRIPT_PATH=%~dp0run-checkin.bat

echo 📌 將建立每日排程任務: %TASK_NAME%
echo 📁 腳本路徑: %SCRIPT_PATH%
echo.

set /p HOUR=請輸入執行時間（小時，0-23）: 
set /p MINUTE=請輸入執行時間（分鐘，0-59）: 

echo.
echo ⏰ 將設定為每天 %HOUR%:%MINUTE% 執行
echo.

:: 刪除舊的排程（如果存在）
schtasks /delete /tn "%TASK_NAME%" /f >nul 2>&1

:: 建立新的排程
schtasks /create /tn "%TASK_NAME%" /tr "\"%SCRIPT_PATH%\"" /sc daily /st %HOUR%:%MINUTE% /f

if %errorlevel% == 0 (
    echo.
    echo ✅ 排程任務建立成功！
    echo.
    echo 📋 任務詳情：
    schtasks /query /tn "%TASK_NAME%" /v /fo list | findstr /i "TaskName Status Next"
) else (
    echo.
    echo ❌ 排程任務建立失敗，請以系統管理員身分執行
)

echo.
pause
