@echo off
echo ========================================
echo   ONE RUPEE RAPIDFIX - Network Hosting
echo ========================================
echo.

REM Get IP Address
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do (
    set IP=%%a
    goto :found
)
:found
set IP=%IP:~1%

echo Your IP Address: %IP%
echo.
echo Frontend will be available at:
echo   http://localhost:8080
echo   http://%IP%:8080
echo.
echo Backend will be available at:
echo   http://localhost:5000
echo   http://%IP%:5000
echo.
echo ========================================
echo Starting servers...
echo ========================================
echo.

REM Start Backend
echo [1/2] Starting Backend Server...
start "Backend Server" cmd /k "cd backend && npm start"

REM Wait a bit for backend to start
timeout /t 3 /nobreak >nul

REM Start Frontend
echo [2/2] Starting Frontend Server...
start "Frontend Server" cmd /k "npm run dev"

echo.
echo ========================================
echo   Servers are starting...
echo   Check the opened windows for status
echo ========================================
echo.
echo Press any key to exit (servers will keep running)...
pause >nul

