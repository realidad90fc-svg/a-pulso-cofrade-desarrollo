# Puntos de trazado, Deshacer/Rehacer y balcones

Mientras se dibuja una calzada, acera, edificio, patio o zona de colisión, Deshacer retira solamente el último punto y Rehacer lo recupera. La misma función está en los botones Quitar punto y Reponer punto junto a Terminar. El contador muestra los puntos del contorno y los que se pueden recuperar.

Atajos: Ctrl Z para Deshacer, Ctrl Y o Ctrl Mayús Z para Rehacer; en Mac, Cmd Z y Cmd Mayús Z. Retroceso y Supr quitan el último punto durante el trazado. Los atajos no interfieren al escribir en los campos del editor. Añadir un punto diferente descarta los puntos pendientes de Rehacer, manteniendo intacto el historial del mapa guardado. Cancelar o cambiar de herramienta descarta el borrador y sus puntos recuperables; terminar el polígono crea una sola operación de historial del mapa.

Deshacer y Rehacer permanecen visibles en el menú inferior del móvil. Los botones se desactivan cuando no hay acciones disponibles. El menú de trazado se adapta al ancho de pantalla.

Biblioteca → Balcones abre directamente las variantes existentes. En los ajustes del edificio se eligen lado de fachada, inicio y porcentaje del tramo, cantidad, flores y colgaduras. Una indicación muestra el tramo efectivo y su longitud en metros. La publicación conserva todos esos campos; antes descartaba posición, ancho del tramo, cantidad y detalles y el juego podía reconstruirlos con los valores por defecto. No se modifican el contorno ni la colisión del edificio.

Verificación: historial de puntos separado del mapa guardado, todos los tipos de trazado, botones de móvil, atajos de teclado, nuevas ramas de trazado, commit del contorno y deshacer/rehacer del mapa; edición y publicación real de los parámetros de los balcones; regresiones de recursos, selección, plantillas, toldos y compatibilidad. DOM/Canvas y motor real; queda pendiente comprobar la interacción en un navegador y teléfono físicos.
