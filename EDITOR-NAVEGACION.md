# Navegación del mapa durante la edición

Con cualquier herramienta, mantener el botón derecho y arrastrar mueve la vista. Al soltarlo se continúa con la misma herramienta, selección y trazado, incluyendo los puntos pendientes de rehacer. La rueda conserva el zoom. El menú contextual se suprime únicamente sobre el lienzo.

En móvil y pantallas táctiles, arrastrar dos dedos desplaza la vista y separarlos o juntarlos modifica el zoom alrededor de su punto medio. Al levantar un dedo, el restante queda reservado para terminar el gesto: no coloca objetos, pinta público ni añade vértices. Un toque normal coloca la pieza al levantar el dedo. Los arrastres de edición siguen disponibles con un dedo.

Si el segundo dedo llega después de iniciar un arrastre de edición, se restaura el documento, la selección y el historial anteriores a ese arrastre. También se cancela el movimiento de la fotografía guía. La navegación no modifica el mapa ni crea una entrada de deshacer.

Los cambios de botones del ratón mientras se mantiene el izquierdo se reconocen mediante `buttons`: la edición queda pausada durante el desplazamiento, sus anclajes de pantalla se ajustan a la cámara y puede continuar al soltar el derecho. Escape durante la navegación, la pérdida de foco y la pérdida de captura liberan el gesto.

Verificación automatizada: matemáticas de desplazamiento y zoom, límites y dedos coincidentes; secuencias de botones; todos los tipos de herramienta originales, colisiones, recorridos y medición; conservación de puntos y su historial; desplazamiento, pellizco y cancelación táctil con DOM y Canvas reales. La comprobación en navegador y en dispositivos físicos queda pendiente.
