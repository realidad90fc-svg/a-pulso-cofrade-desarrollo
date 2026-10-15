# Materiales originales · Taller de Sevilla 2.0

`vegetacion-*-v1.webp` contiene siete copas cenitales realistas: naranjo, plátano de sombra, ficus, palmera, árbol pequeño, ciprés y árbol de sombra claro. Se generaron individualmente con `image_gen` integrado, usando `assets/original-animation/sprite-563.webp` como referencia de estilo. Se conservan el árbol original, los identificadores `tree-0` a `tree-7` y los radios de colisión. La conversión de entrega mantiene la proporción y la transparencia en un lienzo WebP de 512 × 512; los siete archivos suman aproximadamente 1 MB y se incluyen en el instalador sin conexión. Prompts completos: `vegetacion-prompts.json`.

`piedra.webp`, `caliza.webp` y `teja.webp` son recursos generados con la herramienta integrada de generación de imágenes, convertidos a WebP para el juego. Se distribuyen con el editor y se cargan también sin Internet. El patrón de suelo conserva unidades del mapa y dispone de un material procedimental si no se carga el archivo.

Briefs de generación: texturas repetibles en vista cenital ortográfica para un RPG de Sevilla; adoquín gris cálido gastado; losas calizas crema con juntas alternadas; teja curva de arcilla con variación y pátina. Luz difusa uniforme, detalle fino de pixel art, sin texto, objetos ni perspectiva. Los prompts completos se conservan en `prompts.json`.

`gambrinus.png` procede del sitio oficial de Cruzcampo: https://uk.cruzcampo.com/-/media/project/cruzcampo/panel-images/gambrinus.png (15/10/2026). Se conserva sin modificar; el dibujante encuadra el personaje para mostrarlo en la banderola. Gambrinus y Cruzcampo pertenecen a sus respectivos titulares. Este recurso no es generado con IA y se incluye para funcionar sin conexión.
