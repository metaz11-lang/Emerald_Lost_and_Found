@echo off
REM Simple starter for Emerald Lost & Found (development mode)
SETLOCAL ENABLEDELAYEDEXPANSION
echo =============================================
echo  Emerald Lost and Found - Starter
echo  This will install dependencies (if needed)
echo  and then start the dev server on port 3000.
echo =============================================
echo.
IF NOT EXIST node_modules ( 
  echo Installing packages...
  call npm install || ( echo Install failed. Press any key to exit... & pause >nul & exit /b 1 )
) ELSE (
  echo Dependencies already installed. Skipping npm install.
)
echo Starting server (watch mode)...
call npm run dev
echo.
echo If the browser does not open automatically, go to:
echo   http://localhost:3000
echo Then click the green "Basic Admin Page" button (bottom-left) or visit:
echo   http://localhost:3000/admin-basic.html
echo.
pause
ENDLOCAL