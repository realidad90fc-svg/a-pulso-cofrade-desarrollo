@echo off
chcp 65001 >nul
cd /d "%~dp0"
if not exist .git (
 echo Todavia no has conectado este juego a un repositorio Git.
 echo Ejecuta primero VINCULAR_GITHUB.bat.
 pause
 exit /b 1
)
echo Preparando numero de la nueva version...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0ACTUALIZAR_VERSION.ps1"
if errorlevel 1 (pause & exit /b 1)
git add .
git -c user.name="A Pulso Cofrade" -c user.email="a-pulso-local@users.noreply.github.com" commit -m "Actualizacion A Pulso Cofrade"
if errorlevel 1 (pause & exit /b 1)
git push
if errorlevel 1 (pause & exit /b 1)
echo.
echo CAMBIOS SUBIDOS. Vercel publicara automaticamente si se importo el repositorio.
pause
