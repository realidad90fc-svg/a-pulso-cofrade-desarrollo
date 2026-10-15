# Taller de Sevilla 2.0

## Actualización 2.2.0: edición completa y plantillas reutilizables

**Editar selección** permite copiar, pegar y duplicar las doce familias del mapa: calzadas, aceras, edificios con sus patios y fachadas, público, árboles, señales, checkpoints, vallas, sillas, puntos de calle, mobiliario urbano y recursos propios. El botón de duplicar que ya existía también funciona con cualquiera de ellos. Las copias son independientes; los checkpoints reciben identificadores nuevos. El portapapeles del editor permite copiar entre mapas y pestañas del mismo perfil, sin duplicar las imágenes en el guardado automático.

En el panel puedes introducir el centro X/Y, ancho, fondo y giro. Para un elemento, las medidas siguen sus ejes propios; para un conjunto, siguen los ejes del plano. Los conjuntos mantienen sus proporciones al redimensionarse. Los puntos de calle y checkpoints se dimensionan por su diámetro de activación y mantienen su forma circular. Los tamaños de mobiliario, árboles, público y recursos propios se usan también en la partida. Redimensionar una superficie conserva la escala física de su textura. Las fotografías guía mantienen sus medidas y su almacén privado.

La alineación funciona a izquierda, centro o derecha y arriba, centro o abajo. **Repartir huecos** iguala las separaciones horizontales o verticales entre al menos tres elementos o grupos independientes. Cada grupo cuenta como una unidad. **Agrupar** crea un conjunto mixto que puedes mover, girar, escalar, copiar o guardar como plantilla; **Seleccionar miembros por separado** permite ajustar una pieza sin deshacer el grupo. **Desagrupar** conserva todos sus elementos.

**Bloquear** protege el conjunto seleccionado: sigue siendo seleccionable y copiable, pero no puede desplazarse, girarse, redimensionarse, borrarse ni recibir cambios de materiales, fachadas, vértices o checkpoint hasta desbloquearlo. Los bloqueos y grupos se guardan y exportan con el mapa. Deshacer y rehacer conservan las operaciones completas.

Atajos: Ctrl+C / Ctrl+V / Ctrl+D para copiar, pegar y duplicar; Ctrl+A selecciona las capas visibles; Ctrl+G agrupa y Ctrl+Mayús+G desagrupa. Las flechas desplazan 10 cm, con Mayús 1 m y con Alt 1 cm. Pegar coloca en el centro de la vista, con un pequeño desplazamiento entre pegados sucesivos; duplicar desplaza 30 cm. Los atajos respetan la escritura en campos y los diálogos abiertos.

**Plantillas** guarda la selección con nombre y vista previa. Por ejemplo, un edificio con comercio, toldo, banderola y balcones; una fila de sillas; o una fachada acompañada de árboles y mobiliario. Elige el giro, pulsa **Colocar plantilla en el plano** y marca su centro. Aparece una guía antes de colocarla; Escape cancela. Cada colocación crea un grupo independiente. Puedes actualizar una plantilla con otra selección, cambiarle el nombre o eliminarla del catálogo sin alterar las copias ya colocadas.

Exporta una plantilla o el catálogo completo para llevarlo a otro equipo. Las imágenes utilizadas se incluyen una sola vez por catálogo exportado; el almacén local conserva referencias al catálogo de recursos. Se admiten hasta 100 plantillas y 5000 elementos por plantilla. Los mapas clásicos con ediciones de objetos usan su escena completa para que las posiciones anteriores no queden como duplicados en el juego; su publicación requiere una llegada marcada, como en la versión 2.1.0. Los mapas originales sin ediciones conservan su funcionamiento, pasos y controles.

## Actualización 2.1.0: recursos propios y dibujo preciso

**Mis recursos** abre el importador de PNG, WebP o JPEG. Define nombre, categoría, ancho y fondo en metros, giro y colisión: ninguna, rectángulo o círculo para un tronco/poste. El visor muestra la imagen y la huella de colisión. Puedes conservar la proporción de la imagen, guardar el recurso y colocarlo individualmente o en filas con la separación de Vallas y sillas. Los pavimentos y cubiertas se eligen como materiales de sus superficies; si ya hay una superficie de esa categoría seleccionada, se aplica el material. La colisión de un edificio sigue su contorno y sus patios.

Los recursos guardados aparecen automáticamente en **Visor de todos los elementos → Mis recursos**, con la misma imagen y escala que se usan en la partida. Las imágenes se adaptan a un máximo de 1024 píxeles conservando transparencia. Se guardan una sola vez en IndexedDB; los guardados automáticos contienen únicamente sus referencias. **Exportar mapa**, **Exportar ciudad completa** y la publicación incluyen las imágenes utilizadas. **Exportar catálogo de imágenes** permite trasladar también los recursos aún no colocados. Una importación con una imagen dañada no reemplaza parcialmente los recursos existentes. Las fotografías guía siguen en su almacén privado.

**Dibujo preciso** reúne estas operaciones:

- Medir distancia o anchura entre dos puntos, en metros y sin depender del zoom.
- Ajustar a cuadrícula con paso configurable, a vértices o a bordes cercanos; Alt omite el ajuste temporalmente.
- Introducir coordenadas X/Y exactas para un punto nuevo o un vértice seleccionado.
- Añadir un vértice sobre un borde o eliminar una esquina, incluidos los contornos de patios.
- Unir superficies de una misma capa, conservando el material de la primera; dividir una superficie marcando dos puntos de una recta.
- Recortar patios y huecos dibujando su contorno y cerrándolo con Enter o el botón de terminar. Son huecos reales en el dibujo y en la colisión, con deshacer y rehacer.
- Ajustar ancho/fondo de una repetición de textura, giro y distribución: repetir a tamaño real o ajustar una imagen a la superficie. Las medidas corresponden a la imagen completa, que puede contener varias baldosas o tejas.

Las superficies, huecos, imágenes propias y colisiones se conservan al guardar, exportar, reabrir, probar y enlazar zonas. La prueba rechaza una salida sobre un hueco o dentro de un objeto con colisión. Los mapas clásicos con contornos de precisión se prueban usando su escena completa; para publicarlos, debe existir un checkpoint marcado como **Llegada del mapa**. Se mantienen los controles, modelos y límites de tiempo de los pasos originales. Los mapas clásicos sin cambios de contorno conservan su funcionamiento anterior.

El recorte y las operaciones de polígonos usan polygon-clipping 0.15.7, incluido localmente con su licencia MIT en `assets/vendor/polygon-clipping-LICENSE.md`. Todas las nuevas herramientas y sus dependencias están incluidas en el instalador de Windows para funcionar sin conexión.

## Actualización 2.0.6: sillas de madera de Carrera Oficial

La silla utiliza una textura cenital de madera barnizada color miel, con asiento de listones, respaldo abierto y herrajes discretos, basada en la construcción de la fotografía de referencia. La misma textura aparece en las miniaturas, el visor ampliado, las filas, el mapa y la partida. También se incluye sin conexión en Windows. Si la imagen no carga, se dibuja una silla de madera con listones separados.

Los mapas anteriores muestran el nuevo aspecto sin recolocar sillas. Se mantienen el ancho, el giro, la separación de las filas y la huella de colisión de 0,40 × 0,43 m. La foto se utiliza solo como referencia; no se distribuye ni se modifica. Prompt completo: `assets/sevilla/silla-carrera-prompts.json`.

## Actualización 2.0.5: primavera y visor completo

En Ajustes se encuentra **Visor de todos los elementos**: imagen ampliada, miniaturas seleccionables y acceso a los ajustes del elemento. Incluye veinte secciones: edificios, calzadas, aceras, árboles, público, vallas/sillas, urbanismo, señales, checkpoints, puntos de calle, huella del paso, detalles de cubierta, pretiles, comercios, balcones/rejas, toldos, banderolas, colores de toldo, macetas/colgaduras y fotografías guía privadas. El visor utiliza los mismos dibujantes y recursos que el editor. La fila de mobiliario sigue su separación; el modo aleatorio de público prepara y muestra el próximo personaje antes de colocarlo. Navegar por miniaturas no crea objetos ni modifica las fotografías.

Las decoraciones de fachada se aplican con el botón existente después de seleccionar el edificio. Las fotos conservan dimensiones, posición y escala. Los puntos de calle mantienen su guía invisible en el juego y el nombre en el cartel superior. Se corrige el mínimo de píxeles de vallas y sillas cuando se dibujan en unidades del juego.

La vegetación representa primavera: naranjo con azahar blanco y sin naranjas visibles; plátano con hojas nuevas y ramas parcialmente visibles. Se conserva el modelo original y el follaje de los modelos perennes. No se alteran los identificadores, posiciones ni radios guardados. Fuentes botánicas y prompts: `assets/sevilla/primavera-prompts.json`.

## Actualización 2.0.4: vegetación realista

Los siete modelos alternativos de árbol utilizan texturas raster cenitales con follaje, luces, sombras internas y transparencia. El árbol original se conserva. El catálogo y la vista previa grande tienen el doble de resolución para pantallas de alta densidad. Editor y juego usan los mismos recursos; al abrir mapas anteriores se actualiza el aspecto sin cambiar sus tipos, posiciones, tamaños, giros ni colisiones. La descarga incluye las texturas para funcionar sin conexión.

## Actualización 2.0.3: vegetación y banderolas

Árboles y vegetación tiene ocho miniaturas y una vista ampliada que se actualiza al elegir modelo o radio. Elegir una miniatura desactiva la alternancia para colocar ese modelo concreto; con Alternar activado se muestra el siguiente árbol. Se utiliza el mismo dibujante que en el mapa.

En Fachadas y comercios, el rótulo saliente puede elegirse de forma automática o manual: cruz luminosa de farmacia, Gambrinus de Cruzcampo, Tabacos de estanco, taza de cafetería y comercio tradicional. Selecciona el lado de fachada que mira a la calle y ajusta posición, salida y tamaño. Pulsa Aplicar a edificios seleccionados. Los rótulos son decoración y se guardan, exportan, publican y dibujan también al probar el mapa. La opción Sin banderola los quita.


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
