# Editor 2.4.0 — Prueba real, proyectos e historial

Los paneles **Prueba y revisión · motor real** y **Proyecto completo e historial** se encuentran en Ajustes/Opciones. Se mantienen los 17 mapas, los ocho pasos, el movimiento, las colisiones, los controles y los formatos de mapa anteriores.

## Revisar y jugar

Selecciona un paso y la salida guardada, un acontecimiento o un punto temporal. También puedes introducir X, Y y orientación o pulsar **Marcar punto en el plano**. Este punto solo sirve para la prueba: no cambia la salida del mapa.

**Revisar mapa** ejecuta el controlador original con los volúmenes reales del paso. Comprueba la posición temporal y los controles/presentaciones/llegadas, el suelo, los obstáculos y los límites. Revisa también imágenes ausentes y salidas que apunten a mapas o entradas inexistentes. La opción de los ocho pasos comprueba sus diferentes dimensiones. Pulsa un resultado con posición para localizarlo en el plano.

La revisión de posiciones no demuestra que se pueda realizar toda maniobra entre ellas. Para comprobar el recorrido, pulsa **Preparar prueba desde este punto** y después **Abrir prueba preparada**. La partida usa una instantánea local del mapa y del paso elegido; no escribe récords, progreso ni preferencias de la partida normal. La instantánea caduca a las 24 horas.

En la partida puedes ver los volúmenes de colisión, pausar, avanzar un fotograma y marcar la posición. Al chocar se guarda la posición, el motivo y los contornos reales del paso. **Volver al editor** abre el mapa correspondiente y recupera ese resultado. Si la prueba pasa a otro mapa, el editor ofrece abrir el mapa de destino. Las conexiones leen los mapas guardados: guarda también sus destinos antes de probar.

## Proyecto completo

Pon nombre al proyecto. **Exportar proyecto completo** genera un archivo `.apulso` que contiene los mapas, las zonas compartidas, las hermandades y sus itinerarios, las reglas, los recursos importados y las plantillas. También conserva recursos y plantillas todavía sin colocar. Las imágenes de recursos se incluyen una sola vez.

Las fotografías guía son privadas y se excluyen por defecto del archivo exportado. Solo se añaden al marcar **Incluir fotografías privadas**. Al importar o recuperar una versión se muestra primero su contenido; restaurar las fotografías incluidas requiere marcar su casilla. **Crear copia independiente** conserva otra identidad de proyecto y copias separadas de sus fotografías.

El archivo se valida antes de sustituir datos. Se conserva una versión anterior antes de abrir o recuperar un proyecto. Si falla la escritura, se intenta devolver conjuntamente mapas, catálogo, recursos, plantillas y fotografías a su estado anterior; la copia anterior permanece en el historial. Una ventana que mantenga el proyecto anterior no puede guardarlo sobre el recién restaurado: debe recargarse.

## Historial local

Puedes crear versiones con nombre y fecha, revisarlas, renombrarlas y recuperarlas. El guardado automático conserva cambios cada dos minutos mientras el editor permanece abierto; el primer guardado se prepara unos segundos después de detectar cambios. Incluye modificaciones del mapa, del catálogo de ciudad, de los recursos, de las plantillas y de las fotografías.

Se conservan hasta 30 versiones automáticas y 60 manuales por proyecto. Las automáticas más antiguas se reemplazan; las manuales se eliminan desde sus controles. Mapas e imágenes sin cambios se reutilizan mediante huellas SHA-256, y al recuperar se comprueba su integridad. El historial pertenece a este dispositivo y este dominio o instalación. Exporta `.apulso` para trasladar el proyecto o conservar una copia fuera del dispositivo. El paquete admite hasta 192 MB y las fotos incluidas hasta 96 MB de datos de imagen.

## Comprobaciones

Pruebas con el motor original para las 136 combinaciones de 17 mapas y ocho pasos; regresiones de movimiento, llegadas, checkpoints y campaña. Pruebas DOM/Canvas del editor completo y de la entrada real de `game.js`: selección del paso y posición temporal, aislamiento del progreso, colisiones, pausa/fotograma, retorno del fallo, exportación, validación de archivos e historial. Pruebas de IndexedDB para deduplicación, versiones, fotos privadas separadas, restauración completa, copia independiente y recuperación tras simular falta de espacio.

Estas comprobaciones automatizadas no sustituyen la interacción manual en Safari/Chromium ni la ejecución manual del instalador de Windows.
