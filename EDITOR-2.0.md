# Taller de Sevilla 2.0

## Corrección 2.0.2: puntos de anuncio de calle

En **Anuncios de calle** escribe el nombre y el radio de activación. Selecciona **Aa Punto de calle** y colócalo donde deba anunciarse. El centro del paso debe entrar en el círculo: entonces aparece el nombre exacto en el cartel superior durante unos segundos. La calle activa se conserva hasta cruzar otro punto con otro nombre. Ni los puntos ni sus círculos se dibujan en el juego.

Con **Seleccionar** puedes arrastrar el punto o su texto. Para modificar el nombre o el radio, selecciona el punto, cambia los campos y pulsa **Aplicar nombre y radio**. Puedes eliminarlo o colocar varios puntos. Los nombres ya guardados se convierten en puntos con un radio inicial de un metro. En un mapa editado no se deducen nombres por proximidad ni se recuperan los nombres automáticos del recorrido. Sin puntos no hay anuncios del editor.

Los puntos conservan nombre, posición y radio al guardar, reabrir, exportar, publicar o enlazar zonas. El último punto activado también se conserva en los checkpoints y partidas guardadas. Se comprueban cruces entre fotogramas para no saltarse puntos pequeños.

## Corrección 2.0.1: suelo e identificadores

La prueba de Arenal carga el documento guardado completo. Sus calles y aceras definen tanto el dibujo como el suelo transitable, también fuera de los límites del mapa original. Borrar todas las superficies elimina el suelo anterior. Una salida sin suelo o que invade un edificio se rechaza al probar, con el motivo para corregirla en el editor.

Los nombres de calle se conservan como referencias visibles en el editor y aparecen en el cartel superior del juego al pasar por sus anclas. No se pintan sobre el pavimento. El cartel cambia de nombre al entrar en el siguiente tramo identificado.

Regresión reproducida y verificada mediante guardado, lectura de la prueba, colisiones reales y renderizado vertical con cámara girada; incluye suelo fuera de los límites originales, borrado de suelo, edificio sobre la salida y cambio de cartel entre Arfe y Adriano. El instalador conserva el mismo perfil y los mapas existentes.

El editor conserva los mapas, las fotografías privadas, los identificadores de los materiales antiguos y el perfil de Windows de la versión 1.0.4.

## Mapas y calles compartidas

1. Abre **Ciudad** en la cabecera.
2. En **Mapas y zonas**, crea un plano vacío con nombre, barrio y dimensiones, o añade un JSON de un mapa nuevo.
3. Dibuja calzadas, aceras y edificios con las herramientas habituales. Guarda.
4. Para un tramo, selecciona sus elementos o encuádrala en el editor. En Ciudad pulsa **Registrar zona del mapa abierto**. Revisa sus límites y nombres de calles. Puedes conservar la posición actual del paso como salida de esa zona.
5. En **Buscar calles**, busca por nombre, barrio o nombre alternativo. Las calles originales, incluido O’Donnell–Campana–Sierpes, aparecen en el catálogo. Los mapas clásicos siguen siendo guías de colisiones en el editor; no se afirma que sus polígonos sean una reconstrucción exacta de sus fachadas.
6. **Enlazar al mapa abierto** coloca una referencia compartida. Ajusta X, Y y giro en **Zonas enlazadas**. Para cambiar su geometría, utiliza **Editar origen**. Retirar el vínculo no borra la calle original.

Una edición de la calle se refleja en todos sus vínculos. La cabecera indica las hermandades afectadas, también cuando la calle se utiliza a través de otro mapa enlazado. La biblioteca evita añadir dos veces el mismo mapa, zona o vínculo de un itinerario. Una misma calle puede tener varios tramos y mapas de origen.

## Hermandades e itinerarios

En Ciudad → Hermandades elige una hermandad y adjunta mapas completos o zonas. Ordénalos con las flechas. Cada visita tiene sus propias notas, opción de público y presentación obligatoria. Para una presentación, debe existir un checkpoint en la zona. Quitar una visita conserva el mapa y las demás hermandades.

Los itinerarios son proyectos del editor. Ordenarlos no construye las calles que faltan entre mapas ni altera los desbloqueos y estrellas de la campaña existente. Puedes probar una zona con los controles y colisiones originales del paso. En mapas propios, un checkpoint marcado como presentación o llegada exige arriar; una llegada espera las presentaciones obligatorias anteriores. Los ensayos del editor no sustituyen una partida guardada del juego.

## Pavimentos y cubiertas

El editor y el juego utilizan el mismo material repetido en coordenadas del mapa. El pavimento se recorta al polígono, conserva su escala al girar la cámara y tiene un acabado procedimental disponible si falla una imagen. La biblioteca mantiene los 52 pavimentos anteriores y añade piedra y caliza ilustradas. Las cubiertas de teja incorporan una nueva imagen de arcilla. Se conservan los acabados de azotea, cubiertas mixtas, patios, castilletes, comercios y mobiliario.

La referencia aérea inicial se consultó en el servicio PNOA del IGN para el Arenal (entorno de Maestranza, Adriano, Arfe y río). Referencia: <https://pnoa.ign.es/pnoa-imagen/visualizadores-y-servicios-web>. Las imágenes de textura se generaron como recursos originales; no son recortes de la ortofoto. Los motivos de los materiales son una interpretación artística y no certifican qué pavimento existe en cada calle.

## Guardado y copias

- **Guardar** conserva el mapa y el catálogo en el mismo perfil. En Windows se mantiene el perfil `A Pulso Cofrade - Windows` y sus copias de seguridad existentes.
- **Exportar mapa** conserva el JSON del plano. Un mapa con vínculos compartidos necesita también el catálogo de ciudad de origen.
- **Exportar ciudad completa** incluye mapas, zonas, referencias e itinerarios; nunca adjunta fotografías privadas. Es la opción para trasladar la ciudad a otro equipo o perfil.
- **Restaurar ciudad** valida el archivo completo y los enlaces antes de escribirlo. Si falta espacio, restaura los valores anteriores.
- Las fotografías siguen en su almacén separado. No cambia su escala ni sus proporciones.

La edición local requiere espacio en el navegador/perfil. Ante un error de guardado, exporta la ciudad antes de cerrar.

## Validación de esta versión

Pruebas de modelo para vínculos, exportación/restauración, nombres alternativos y ciclos; igualdad de píxeles entre editor y juego; renderizados de materiales y del Arenal con cámaras giradas; integración de la interfaz mediante DOM y Canvas; controles, colisiones, presentaciones y checkpoints con el motor original. Las pruebas DOM/Canvas no sustituyen una prueba en Safari, Chrome ni la ejecución del EXE en Windows.
