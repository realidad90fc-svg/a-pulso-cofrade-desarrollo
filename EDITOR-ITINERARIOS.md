# Taller 3.1: calles propias e itinerarios jugables

1. En Proyecto, exportar una copia completa `.apulso` antes de retirar contenido.
2. En Mapas, crear un mapa vacío por calle o tramo. Las zonas permiten reutilizar una parte de un mapa. El buscador enlaza el origen, sin duplicar su geometría.
3. Dibujar suelo, edificios y objetos; marcar inicio, controles y llegada. Los mapas propios usan únicamente el suelo y los obstáculos del editor. Revisar y probar el paso con el motor real.
4. Adjuntar mapas o zonas a una hermandad. Las flechas cambian su orden. Entrada y llegada pueden variar por pasada. «Añadir otra pasada» permite volver a usar la misma calle sin copiarla.
5. Elegir un paso disponible y pulsar «Activar itinerario en Semana Santa». Se crea una versión de recuperación antes del cambio. La pertenencia y el orden del itinerario activo se actualizan explícitamente; los cambios de una calle compartida se reflejan en todos sus usos.
6. Abrir el juego, Semana Santa y la hermandad. Cada tramo tiene su llegada, tiempos y récord, y desbloquea el siguiente. Los identificadores de los tramos son estables al reordenarlos. En esta versión de desarrollo se mantiene el acceso de pruebas a todos los recorridos.
7. «En Semana Santa mostrar solo los itinerarios creados por mí» retira los recorridos anteriores del catálogo sin eliminar los archivos o sus récords. Juego Libre conserva su funcionamiento.
8. Guardar y exportar periódicamente el proyecto completo `.apulso`. Incluye mapas, imágenes propias, zonas, referencias y asignaciones activas. Las fotografías de referencia se incluyen solo al marcar la casilla. Los récords del juego se guardan aparte, en este dispositivo.

La opción «Retirar itinerario del juego» conserva el trabajo y los datos. Si el mismo itinerario estaba publicado, la retirada local también lo oculta. Para cambiar la versión de otros jugadores hay que publicar de nuevo.

## Publicación

«Publicar ciudad e itinerarios» envía a GitHub un paquete único con los mapas necesarios, sus referencias, imágenes propias y los itinerarios activos. No publica las fotos privadas. Se conserva la autorización existente: token temporal de la cuenta propietaria, mismo origen, confirmación explícita y escritura con versión comprobada. El límite del endpoint de publicación es 3,6 MB; los proyectos más grandes pueden trasladarse con `.apulso`.

La publicación directa usa el editor de desarrollo en Vercel. En el EXE o en ChatGPT Sites, abrir el `.apulso` en ese editor para publicarlo. Guardar y activar en el EXE permite jugar localmente sin publicar ni introducir credenciales.

La distribución de Windows mantiene el identificador y la carpeta de datos existentes. La actualización del programa no contiene instrucciones para borrar guardados.

## Validación

- `tests/city-campaign.mjs`: referencias compartidas, dos hermandades, activación explícita, orden, conservación de récords, archivo, retirada, proyecto completo y ocho pasos con el motor real.
- `tests/city-campaign-web.mjs`: editor → asignación y segunda pasada → entradas y llegadas → activación con versión previa → backup → menú Semana Santa → mapa y paso correctos → llegada, guardado y reintento. Incluye una textura propia almacenada en IndexedDB.
- `tests/city-campaign-publication.mjs`: publicación del paquete, imágenes, autorización, origen, conflicto de versión y exclusión de fotografías privadas.

Las pruebas de DOM y Canvas no equivalen a una comprobación manual en Safari, Chromium o el EXE instalado.
