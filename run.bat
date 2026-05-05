@echo off
echo ===================================================
echo   Starting AI-Powered Plant Disease Detection System
echo ===================================================
echo.

:: Check if Python is installed
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python is not installed or not in PATH.
    pause
    exit /b
)

:: Start the FastAPI backend server in a new window so it stays running
echo [1/2] Starting the AI Backend Server on port 8000...
start "AI Backend Server" cmd /k "cd /d "%~dp0" && python backend/main.py"

:: Wait 15 seconds for the server and TensorFlow model to initialize into memory
echo Please wait about 15 seconds while the AI model loads into memory...
timeout /t 15 /nobreak >nul

:: Open the frontend in the default web browser
echo [2/2] Launching the Frontend Web Interface...
start "" "%~dp0frontend\index.html"

echo.
echo ===================================================
echo The system is now running!
echo 1. Your browser should open automatically.
echo 2. The AI server is running in the newly opened black terminal window.
echo.
echo IMPORTANT: To shut down the system later, simply close the "AI Backend Server" window.
echo ===================================================
pause
