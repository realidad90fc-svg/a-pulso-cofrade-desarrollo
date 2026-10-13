# A Pulso Cofrade - Editor de Mapas para Windows

Este instalador .exe abre directamente el Taller de Mapas de A Pulso Cofrade,
el mismo editor del sitio web de Vercel. El motor del juego se incluye
únicamente para permitir la vista previa desde «Probar en juego».

## Instalación
1. GitHub > Actions > "Editor de mapas A Pulso - Windows".
2. Abre la ejecución más reciente que termine en verde.
3. Descarga el artefacto "A-Pulso-Editor-de-Mapas-Windows-Instalador".
4. Descomprime el ZIP y ejecuta el instalador EXE.
5. La aplicación no está firmada; Windows SmartScreen podría pedir confirmación.

## Tus datos quedan protegidos
- Windows guarda los mapas (localStorage) y las fotografías (IndexedDB)
  en %APPDATA%\A Pulso Cofrade - Windows, fuera del perfil de Chrome/Edge.
- Al cerrar la app se crea una copia en Documentos\A Pulso Cofrade\Copias de seguridad.
- Se conservan las 12 copias más recientes. Puedes crear otra desde Archivo.
- Archivo > Restaurar copia de seguridad permite recuperar una copia completa.
- Instalar una actualización NO borra tus datos. Evita borrar manualmente
  %APPDATA%\A Pulso Cofrade - Windows.
- El Taller de Mapas y su vista previa funcionan sin Internet; publicar mapas en
  GitHub sí requiere conexión.

## ¡Importante! Tus datos actuales del navegador no aparecen automáticamente
Antes de abandonar el editor Vercel:
1. Entra en el editor web y selecciona el recorrido.
2. Pulsa «Exportar mapa». Repite para cada recorrido editado.
3. Instala la app Windows; elige cada recorrido e «Importar diseño JSON».
4. Las fotografías privadas del navegador NO están incluidas en esos JSON.
   Conserva los PNG/JPG originales y añádelos a la aplicación de Windows.
5. Comprueba que todo aparece y crea una copia desde Archivo.

El instalador no elimina ni modifica datos del editor web.
La carpeta de datos de la versión anterior 1.0.1 se sigue utilizando;
no se cambia el perfil al renombrar la aplicación.
No requiere despliegue de Vercel para ejecutarse; incorpora una copia del
código de este repositorio en el momento de la compilación.

## Compilar localmente en Windows
    cd desktop
    npm install
    npm run prepare:web
    npm run dist:windows

Se necesita Node.js 22, Internet durante la compilación y Windows x64.
