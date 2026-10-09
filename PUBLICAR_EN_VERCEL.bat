@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ----------------------------------------
echo A PULSO COFRADE - PUBLICAR EN VERCEL
echo ----------------------------------------
where node >nul 2>&1
if errorlevel 1 (
 echo Falta Node.js. Instala Node LTS desde https://nodejs.org/
 pause
 exit /b 1
)
where npx >nul 2>&1
if errorlevel 1 (
 echo No se ha encontrado npx. Reinstala Node.js con npm.
 pause
 exit /b 1
)
echo La primera vez Vercel te pedira iniciar sesion y vincular un proyecto.
echo Al terminar aparecera la direccion de tu juego.
echo.
call npx --yes vercel@latest --prod
if errorlevel 1 (
 echo.
 echo ERROR EN PUBLICACION. Revisa las indicaciones de Vercel.
 pause
 exit /b 1
)
echo.
echo PUBLICACION COMPLETADA. Copia el enlace que aparece arriba.
pause
