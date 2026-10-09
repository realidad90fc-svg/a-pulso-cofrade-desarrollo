# A Pulso Cofrade — desarrollo web

Esta carpeta contiene una **copia de desarrollo** del juego recuperado. El enlace anterior de ChatGPT Sites no se modifica.

## La ruta recomendada: GitHub + Vercel

1. En Windows, descomprime completamente el ZIP.
2. Instala [Git](https://git-scm.com/download/win) si no lo tienes.
3. Crea un repositorio **vacío** en [GitHub](https://github.com/new), por ejemplo `a-pulso-cofrade-desarrollo`. No añadas README ni .gitignore en la creación.
4. Ejecuta `VINCULAR_GITHUB.bat` desde la carpeta del juego. Pega la URL HTTPS de tu repositorio y completa el inicio de sesión de GitHub si aparece.
5. En [Vercel > New Project](https://vercel.com/new), selecciona Import Git Repository, elige ese repositorio y pulsa Deploy. Framework Preset: Other (sitio estático), raíz: `/`.
6. Vercel te dará una URL estable `tu-proyecto.vercel.app`. Cualquier `git push` futuro a la rama de producción generará un nuevo despliegue automáticamente. Para publicar cambios que tengas en esta carpeta, ejecuta `SUBIR_CAMBIOS_GITHUB.bat`: genera un número de versión nuevo, hace commit y sube los cambios.

Para publicar **hoy sin GitHub**, puedes ejecutar `PUBLICAR_EN_VERCEL.bat` (requiere [Node.js LTS](https://nodejs.org/)), iniciar sesión y aceptar la creación del proyecto. Podrás repetir el BAT para subir actualizaciones. Si eliges esto, las actualizaciones **no** serán automáticas desde esta conversación: habrá que desplegar los nuevos archivos.

## Funcionamiento de las versiones

- El archivo `version.json` identifica cada actualización; también cambia la constante `INSTALLED_VERSION` en `web-version.js` en cada publicación.
- Cuando se publica una versión nueva (tras ejecutar `ACTUALIZAR_VERSION.ps1` o `SUBIR_CAMBIOS_GITHUB.bat`) y el navegador detecta que hay otra, muestra **Actualizar** al salir de un recorrido, sin interrumpir la partida.
- Si abres el enlace de nuevo, se carga la versión web más reciente.
- **El progreso, las estrellas y los récords están guardados localmente en cada navegador/dispositivo. No están sincronizados entre móviles y PC.**
- Durante las pruebas se mantienen los recorridos sin requisitos de estrellas, sin borrar progreso real.

## Qué NO cambia en esta entrega

- No se ha modificado todavía la geometría ni las colisiones de los mapas.
- Pendiente de aplicar: fidelidad urbanística de Sevilla, continuidad de aceras/tejados, árboles/señales de ubicación real, presentación obligatoria en la capilla del Baratillo, y colisiones ajustadas al tamaño del paso sin facilitar artificialmente los giros.
- El nombre y recursos originales del juego pueden tener derechos de terceros: no publiques libremente los recursos si careces de permiso.

## Cómo probar el juego offline

La versión anterior para Windows sigue sirviendo para prueba local. Esta carpeta está preparada para despliegue web. Para ejecutar esta copia localmente: con Python `py -m http.server 8765` y abrir http://localhost:8765/ en tu navegador.
