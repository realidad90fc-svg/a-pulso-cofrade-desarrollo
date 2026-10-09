@echo off
chcp 65001 >nul
cd /d "%~dp0"
where git >nul 2>&1
if errorlevel 1 (
 echo Necesitas Git para Windows: https://git-scm.com/download/win
 pause
 exit /b 1
)
echo.
echo Crea ANTES un repositorio VACIO en https://github.com/new
 echo Nombre recomendado: a-pulso-cofrade-desarrollo
 echo No marques Readme ni gitignore en GitHub.
echo.
set /p REPO_URL=Pega la direccion HTTPS del repositorio (https://github.com/usuario/repo.git): 
if not defined REPO_URL exit /b 1
if not exist ".git" git init
git checkout -B main
git add .
git -c user.name="A Pulso Cofrade" -c user.email="a-pulso-local@users.noreply.github.com" commit -m "Version web de desarrollo inicial"
git remote get-url origin >nul 2>&1
if errorlevel 1 (git remote add origin "%REPO_URL%") else (git remote set-url origin "%REPO_URL%")
git push -u origin main
if errorlevel 1 (
 echo No se ha podido subir a GitHub. Comprueba autenticacion y URL.
 pause
 exit /b 1
)
echo.
echo HECHO. Importa el repositorio en https://vercel.com/new
pause
