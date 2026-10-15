# Editor 2.3.0 — Colisiones y recorridos

Los paneles **Colisiones** y **Recorrido** aparecen en Ajustes/Opciones, tanto en móvil como en PC. Sus botones superiores permiten elegir las zonas y puntos en el plano. Guardar, exportar mapa y exportar ciudad conservan la configuración.

## Colisiones

Activa la vista superpuesta: verde para suelo transitable, rojo para obstáculos y azul para límites. Dibuja zonas, modifica sus vértices con coordenadas exactas o arrástralos. Puedes insertar o eliminar puntos y desactivar una zona sin borrarla.

El modo original conserva la física existente y permite añadir restricciones. **Usar suelo y obstáculos del editor** convierte las calles, aceras, zonas transitables y objetos del documento en la física del mapa. Selecciona objetos y pulsa Hacer sólidos/Hacer transitables para cambiar su comportamiento. Los elementos bloqueados deben desbloquearse antes. Las zonas de suelo físico no añaden una textura: el pavimento visible se sigue dibujando con Calle/Acera.

## Recorridos

Activa **Usar los acontecimientos de este editor** y aplica las reglas. Puedes importar controles ya existentes o colocar entradas, checkpoints, presentaciones, anuncios, salidas y una llegada. El orden de la lista es editable. Configura radio, obligatoriedad, arriado, orientación/tolerancia y tiempo de parada. Los anuncios se activan mediante puntos invisibles; no pintan texto en el suelo durante el juego.

Una salida indica mapa y entrada de destino. Guarda los destinos antes de probar las conexiones; para otros visitantes, publica ambos mapas. La configuración se valida al publicar. La prueba local y la publicación usan el mismo formato. La ciudad exportada conserva los mapas y sus vínculos, sin fotografías privadas.

Los tiempos de tres y dos estrellas son editables en segundos. Los eventos configurados sustituyen los controles y la llegada originales solo cuando se activa el recorrido personalizado. Los mapas sin configuración nueva mantienen su comportamiento anterior. El movimiento, los ocho pasos y los controles originales se conservan.

## Validación

Pruebas de contornos, patios, obstáculos, límites, activación y orden de eventos, presentaciones, pausas, snapshots, conexiones, interfaz y saneado de publicaciones. Prueba del motor con 136 combinaciones (17 mapas × 8 pasos), además de la regresión de movimiento, checkpoint, llegada y campaña. Las pruebas DOM/Canvas no sustituyen una comprobación manual en navegador o la ejecución del instalador en Windows.
