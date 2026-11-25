@echo off
setlocal
cd /d "%~dp0"
if not exist "server\.env" (
 echo ERROR: server\.env is missing.
 echo Copy server\.env from your ORIGINAL StyleCircle project into this new server folder.
 echo Keep the same MONGO_URI and JWT_SECRET. Never share the .env file.
 pause
 exit /b 1
)
echo Installing backend dependencies...
cd server
call npm.cmd install
if errorlevel 1 goto :failed
cd ..\client
echo Installing frontend dependencies (includes Three.js and MediaPipe)...
call npm.cmd install
if errorlevel 1 goto :failed
echo Testing frontend build...
call npm.cmd run build
if errorlevel 1 goto :failed
cd ..
echo Installation complete. Starting StyleCircle servers in separate windows.
start "StyleCircle Backend" cmd /k "cd /d ""%~dp0server"" && npm.cmd run dev"
start "StyleCircle Frontend" cmd /k "cd /d ""%~dp0client"" && npm.cmd run dev"
echo Visit the frontend URL printed in the frontend terminal.
pause
exit /b 0
:failed
echo Something failed. Read the first error message above.
pause
exit /b 1
