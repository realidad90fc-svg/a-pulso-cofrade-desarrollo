# Toldos, dinteles y arcos independientes

Biblioteca → Toldos y portales ofrece cinco toldos sueltos, tres dinteles y un arco inspirado en el Postigo. Las miniaturas usan el mismo dibujante que el plano y el juego. Los toldos unidos a una fachada siguen disponibles como decoración del edificio.

En Propiedades se definen ancho total, fondo, giro, altura libre mínima y, en portales, grosor de los dos laterales. Seleccionar una pieza permite volver a editar estos datos; admite copiar, duplicar, grupos y plantillas como el resto del mobiliario. La anchura útil del portal es el ancho total menos los laterales. El edificio no se recorta automáticamente: el autor debe dejar el vano libre y colocar suelo transitable bajo él.

La altura libre se compara con la altura de simulación del paso en posición normal, agachado o arriado. Se pueden calibrar los ocho pasos por mapa. Los valores iniciales (3,80 / 3,25 / 2,90 m) son referencias de juego, no medidas históricas. La comparación conserva el volumen horizontal real de los colliders del motor y lo trata como una envolvente vertical conservadora. No simula una abertura curva ni alturas distintas de cada adorno. Se usa la altura mínima del hueco. Una abertura demasiado baja también bloquea al paso agachado; los laterales siempre son obstáculos.

Las piezas se almacenan en la capa urban, con size, clearance y pier; las calibraciones en gameplay.heightProfiles. Se conservan en exportaciones, proyectos, versiones y publicación. La API valida las nuevas piezas y elimina campos ajenos al formato público.

Comprobación: pruebas con el motor original para ocho pasos y los modos de colisión heredada y sustituida, validación inicial, colisión al jugar, estados normal/agachado/arriado, medidas, plantillas, perfiles, publicación y flujo DOM/Canvas de colocación y edición. Las pruebas de CSS móvil incluyen la corrección anterior de la capa gris. Pendiente revisión manual en navegador y teléfono físico.
