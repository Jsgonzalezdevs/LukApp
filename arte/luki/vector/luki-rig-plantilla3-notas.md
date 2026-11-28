# Luki — rig extraído de `luki-plantilla3.ai`

## El personaje ensamblado (empieza aquí)

**[`luki-ensamblado.svg`](luki-ensamblado.svg)** / **[`luki-ensamblado-demo.html`](luki-ensamblado-demo.html)**
es el entregable real: un solo Luki compuesto, no piezas sueltas, que respira,
parpadea, saluda, mueve la cola y camina — sin huecos en ningún frame.

**Por qué no simplemente "conservar el solape oculto" de cada pieza:** lo
comprobé directamente contra el contenido del PDF (no a ojo) — parseé los
764 operadores de dibujo de `luki-plantilla3.ai` en su propio orden, con su
propia transformación, y confirmé que la pose pequeña ensamblada
(`luki-root`) no tiene un brazo dibujado por separado del torso: a esa
escala, el hombro-a-mano es parte del mismo relleno que el saco. No hay
geometría oculta debajo de la manga que se pueda recuperar — nunca se dibujó.
Esto es cierto tanto para `luki-root` como para las piezas explotadas de más
abajo (torso, manga, brazo...), que tampoco se solapan entre sí en la lámina
de referencia, así que tampoco tienen un borde oculto que extraer.

**La solución que sí construí:** en vez de inventar esa geometría (lo cual
habría sido redibujar a Luki, justo lo que se pidió evitar), superpuse sobre
`luki-root` copias recortadas (`clip-path`) de esa misma ilustración real,
cada una rotando desde un pivote (hombro, cadera, base de la cola, cuello).
Como la base de abajo siempre tiene el brazo/pierna/cola ya en su lugar,
nunca aparece un hueco al mover una pieza — lo que se ve detrás de la parte
que gira es la misma ilustración, no vacío. Cero geometría inventada: es el
arte original, duplicado y recortado, nunca redibujado. Limitación honesta:
en rotaciones grandes se nota una línea fina donde termina el recorte —
por eso las animaciones usan ángulos moderados.

Las coordenadas del recorte y el pivote de cada parte animada están al final
de este archivo, en **Pivotes del personaje ensamblado**.

## Piezas sueltas (`luki-rig-plantilla3.svg`) — referencia, no para animar solas

`luki-rig-plantilla3.svg` es una lámina vectorial real: cada grupo de abajo es
un `<g id="...">` propio, construido con `<use>` sobre las 683 rutas reales del
`.ai` (recortadas por posición, no redibujadas). El archivo fuente sigue en
`luki-plantilla3.ai` — esta lámina es la extracción, no lo reemplaza. Sirve
para ver cada pieza grande y clara, o para abrir en Illustrator como punto de
partida — **no** para animar directamente, porque estos recortes están al
borde visible de cada pieza tal como aparece en la lámina explotada (que es
exactamente lo que no sirve para rotar sin huecos, según lo de arriba).

Coordenadas de origen: todas las posiciones de abajo son puntos PDF (72 pt/in)
dentro de `luki-plantilla3.ai`, que mide 1536 × 1024 pt.

## Mapa de capas

| Grupo | Qué es | Región fuente (x, y, ancho, alto en pt) |
|---|---|---|
| `luki-root` | Pose completa ensamblada, para comprobar proporciones | 10, 50, 485, 310 |
| `head` | Cabeza completa (con orejas, ojos, hocico ya puestos) | 60, 50, 175, 125 |
| `ears-left` / `ears-right` | Orejas | 65,52,50,45 · 175,52,50,45 |
| `eyebrows-left` / `eyebrows-right` | Cejas | 95,75,60,35 · 145,73,60,35 |
| `eyes-left` / `eyes-right` | Ojos (blanco + pupila) | 90,85,55,50 · 158,82,55,50 |
| `pupils-left` / `pupils-right` | Solo pupilas | 100,93,35,38 · 165,90,35,38 |
| `muzzle` | Hocico completo (incluye nariz y boca de fondo) | 82,108,130,65 |
| `nose` | Nariz sola | 128,110,45,35 |
| `mouth` | Boca sola | 112,122,75,30 |
| `whiskers-left` / `whiskers-right` | Bigotes | 58,110,65,35 · 170,108,65,35 |
| `torso` | Torso desnudo | 650,60,265,300 |
| `hoodie` | Saco morado completo | 995,65,405,270 |
| `hood` | Capucha | 690,60,260,300 |
| `lukapp-mark` | Isotipo de LukApp | 545,285,80,90 |
| `left-arm` / `right-arm` | Brazo desnudo | 915,30,100,135 · 1015,30,100,135 |
| `left-sleeve` / `right-sleeve` | Manga del saco | 1215,0,95,160 · 1320,0,115,160 |
| `left-hand` / `right-hand` | Mano abierta | 1130,165,140,110 · 1130,280,110,100 |
| `left-fingers` / `right-fingers` | Fila de dedos individuales | 1140,350,350,50 · 1140,400,350,50 |
| `left-leg` / `right-leg` | Pierna | 145,350,115,195 · 260,350,110,195 |
| `left-foot` / `right-foot` | Pie | 845,445,105,115 · 1005,445,105,115 |
| `left-toes` / `right-toes` | Fila de dedos del pie | 1165,445,95,115 · 1260,445,105,115 |
| `tail-base` | Cola, segmento base | 825,440,165,65 |
| `tail-middle` | Cola, segmento medio | 995,440,160,65 |
| `tail-tip` | Cola, punta (degradado a morado) | 1415,440,170,65 |

**Extra, no pedido como grupo pero sí como variante:** `hand-fist-1/2` (puño),
`hand-point-1/2` (señalando) — mismas manos en otro estado, listas para
intercambiar por `left-hand`/`right-hand` según el gesto.

## Piezas que no existen como grupo aparte

`torso` y `belly` están fusionados en una sola forma en el archivo fuente — no
hay una barriga separable sin abrir el `.ai` en Illustrator y partir el
trazado a mano. `left-fingers`/`right-fingers` son la fila de dedos suelta que
existe en la lámina, pero no están pre-agrupados por dedo individual (pulgar,
índice...) — son 10 óvalos sueltos por mano, sin diferenciar cuál va con cuál.

## Puntos de pivote (estimados)

No vienen marcados en el archivo — son una estimación anatómica sobre la pose
de `luki-root`, pensada como punto de partida para animar. Ajústalos a ojo
contra el dibujo real antes de animar en serio. Coordenadas relativas a la
esquina superior izquierda de `luki-root` (su propia caja, 485 × 310):

| Pieza | Pivote (x, y) | Desde donde gira |
|---|---|---|
| `head` | 140, 110 | cuello |
| `left-arm` | 95, 130 | hombro izquierdo |
| `right-arm` | 300, 125 | hombro derecho |
| `left-hand` | — | desde la muñeca, extremo del brazo opuesto al hombro |
| `right-hand` | — | ídem |
| `left-leg` | 170, 225 | cadera izquierda |
| `right-leg` | 250, 225 | cadera derecha |
| `tail-base` | 40, 210 | nace del cuerpo |
| `tail-tip` | — | independiente, sigue a `tail-base` con retraso para que ondee natural |

## Catálogo de variantes disponibles

Estas no están individualmente recortadas (son tiras de referencia completas,
`row-heads`, `row-facestates`, `row-poses` en el archivo) — muestran qué
expresiones y poses ya existen dibujadas en `luki-plantilla3.ai`, por si hace
falta aislar una en Illustrator más adelante:

- **`row-heads`** (11 variantes): expresiones de cabeza completa — sonriendo,
  ojos cerrados, guiño, sorpresa, mirando a los lados, dormido, riendo.
- **`row-facestates`** (~17 iconos): ojos abiertos/cerrados/mirando en varias
  direcciones, párpados medio cerrados, bocas (cerrada, sonrisa, abierta,
  con lengua), narices y lenguas sueltas.
- **`row-poses`** (7 poses de cuerpo completo): de pie neutral, ojos cerrados,
  saludando, caminando, saltando con brazos arriba, corriendo, sentado.

Sumado a `hand-fist-1/2` y `hand-point-1/2` ya extraídas como grupos, esto
cubre casi toda la lista de variantes pedida (ojos abiertos/cerrados/dormidos,
pupilas en direcciones distintas, boca cerrada/sonrisa/abierta/sorpresa,
lengua, mano abierta/puño/señalando, saludo, pies de pie/sentado). Lo único
que no aparece dibujado en ningún lado del archivo es una variante de "pies
levantados" independiente de una pose completa.

## Pivotes del personaje ensamblado (`luki-ensamblado.svg`)

Medidos directamente contra una grilla superpuesta sobre el render real de
`luki-root` (no estimados a ojo) — coordenadas en puntos del `.ai` original
(0–1536 × 0–1024). Cada pieza es una elipse de recorte (`clip-path`) más un
pivote de rotación:

| Pieza | Recorte: centro (x,y), radios (rx,ry) | Pivote (x,y) | Gira desde |
|---|---|---|---|
| `left-arm` | 100, 242 · 35, 28 | 100, 195 | hombro izquierdo |
| `right-arm` | 233, 242 · 35, 28 | 220, 195 | hombro derecho |
| `left-leg` | 152, 310 · 30, 32 | 152, 270 | cadera izquierda |
| `right-leg` | 198, 310 · 30, 32 | 198, 270 | cadera derecha |
| `tail` | 95, 255 · 90, 45 | 125, 262 | base de la cola |
| `eyes` | 165, 108 · 68, 22 | 165, 108 | parpadeo (`scaleY`) |
| `head` | 165, 120 · 105, 95 | 165, 148 | cuello |

Verificado con muestreo de píxeles real (no solo lectura visual) contra el
render del SVG: cada recorte cae sobre pelaje/tela real del personaje, no
sobre fondo blanco. Confirmado también en reposo (idéntico a la referencia)
y con todas las piezas rotadas a la vez a ángulos exagerados (sin huecos).
