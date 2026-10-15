# Taller de Sevilla 3.0 — Estudio visual

La interfaz conserva los formatos y las funciones del editor 2.4. Las preferencias de presentación se guardan por dispositivo, separadas de los mapas. El perfil de Windows y la identidad de la aplicación se mantienen.

## Ordenador

- **Construir:** biblioteca visual a la izquierda, mapa central e inspector de propiedades a la derecha. Selecciona una familia, busca por nombre dentro de ella y pulsa una imagen. Las 21 familias del visor siguen disponibles en el selector, incluidas fachadas, balcones, toldos, fotografías y recursos propios.
- **Recorrido:** salida, anuncios de calle, controles, presentaciones, conexiones, hermandades e itinerarios. Los controles originales se reutilizan y conservan sus guardados.
- **Revisar:** prueba con el motor real, suelo transitable, colisiones, obstáculos y límites. El inspector mantiene visibles los controles de colisión al dibujar o seleccionar una zona.
- **Capas:** mostrar/ocultar por familia y bloquear o desbloquear sus elementos actuales. El bloqueo incluye los grupos vinculados. La visibilidad es solo del editor y no elimina ni desactiva elementos del juego.
- **Proyecto:** mapas, exportaciones, publicación, copias completas, plantillas, historial y recuperación. El inspector y el buscador de funciones permiten acceder a todos los paneles anteriores.
- **Ctrl/Cmd+K:** buscar una función por su nombre. **V:** seleccionar. **H:** mover. **M:** medir. Se mantienen los atajos de copiar, pegar, duplicar, agrupar, deshacer y las herramientas de precisión.

Selecciona un elemento para mostrar sus medidas, giro y acciones. Los catálogos preparan piezas y materiales; se mantienen los botones explícitos de aplicar cambios a elementos seleccionados. En vallas, sillas, público y recursos propios, el inspector ofrece acceso directo a la colocación individual o en fila.

## Móvil y pantallas táctiles

La distribución cambia a controles táctiles en pantallas pequeñas o con puntero táctil. También se puede activar manualmente en Ajustes.

La barra inferior ofrece **Añadir, Elegir, Propiedades, Capas y Deshacer**. Biblioteca y propiedades se abren como paneles inferiores, uno cada vez. Se cierran con la X, tocando fuera o deslizando hacia abajo desde la cabecera. Al elegir una pieza, la biblioteca se cierra por defecto para dejar el mapa libre. Las acciones de terminar o cancelar una forma permanecen sobre el plano.

Pulsa el nombre del mapa para abrir la ciudad y cambiar de mapa. El botón de proyecto y el engranaje de ajustes permanecen accesibles en la cabecera. Las pestañas Construir, Recorrido y Revisar también están presentes en móvil.

En **Ajustes → Configuración para móvil** puedes elegir:

- Controles del plano de 48 o 56 píxeles.
- Mano preferente y posición de las herramientas flotantes.
- Paneles cómodos o compactos para dejar más mapa visible.
- Cerrar la biblioteca al elegir una pieza o mantenerla abierta.
- Mostrar u ocultar instrucciones de la herramienta.

Se respetan las áreas seguras del dispositivo. Los campos tienen tamaño de letra apropiado para entrada táctil. El mapa mantiene sus gestos existentes de desplazamiento y zoom.

## Verificación

Pruebas DOM/Canvas de biblioteca y búsqueda, inspector contextual, navegación entre espacios, acceso a todos los paneles, visibilidad sin alteración del documento, bloqueo/desbloqueo real, edición precisa, modos individual/fila, paneles móviles, cierre por fondo y por gesto, preferencias y recuperación. Regresión del flujo completo anterior: mapas, importación de recursos, dibujo preciso, patios, grupos, plantillas, calles compartidas y comercios. Se conservan las comprobaciones del motor, recorridos, proyectos e historial en la compilación de Windows.

La validación automatizada no sustituye la interacción manual en Safari/Chromium, teléfonos físicos o el instalador de Windows.
