# Luki vectorial

Luki es la nutria mascota de LukApp: delgada, con saco morado. Vive fuera de
`src/` porque se sirve como archivo estático, inline o vía `<object>`.

## Archivos

| Archivo | Qué es |
|---|---|
| `luki.svg` | El maestro: editable, modular, fuente de verdad. |
| `luki-neutral.svg`, `luki-expressions.svg`, `luki-poses.svg` | Variantes de entrega (mismo contenido que el maestro). |
| `public/brand/luki-mascot.svg` | Copia de entrega para el manual de marca. |
| `luki-guia-piezas-vectorial.svg` | Lámina de referencia con piezas reales de `luki-saludo.svg` separadas y ampliadas (`<use>` sobre los grupos originales, sin redibujar nada). Cubre ~20 piezas que sí se separan limpias con contorno propio: cabeza, orejas, cejas, ojos, pupilas, hocico, nariz, boca, lengua, manos, pies, isotipo y la cola visible en esa pose. Le faltan torso, saco, mangas, brazos, piernas y base de la cola — en `luki-saludo.svg` esas piezas comparten relleno y contorno con partes vecinas y no se pueden aislar solas sin quedar rotas; separarlas bien requiere abrir `Luki-saludo.ai` en Illustrator. |
| `luki-ensamblado.svg` | **El entregable real de `luki-plantilla3.ai`.** Un solo Luki compuesto (no piezas sueltas) que respira, parpadea, saluda, mueve la cola y camina sin huecos en ningún frame — copias recortadas (`clip-path`) de la pose real superpuestas sobre sí misma, rotando desde pivotes reales. Nada de geometría inventada. Ver la explicación completa en `luki-rig-plantilla3-notas.md`. |
| `luki-ensamblado-demo.html` | La demo animada del archivo de arriba, con contexto de por qué se construyó así. |
| `luki-rig-plantilla3.svg` | Piezas sueltas de referencia (43 grupos) extraídas de `luki-plantilla3.ai` — útiles para ver cada pieza grande o abrir en Illustrator, pero **no sirven para animar solas** (recortadas al borde visible, sin solape oculto; ver notas). |
| `luki-rig-plantilla3-notas.md` | Explica por qué se pasó de piezas sueltas a personaje ensamblado, más el mapa de capas, pivotes y catálogo de variantes de ambos archivos. |
| `luki-layers.json` | IDs, pivotes (coordenadas absolutas del `viewBox`), paleta HEX y rango de las pupilas. |
| `examples.css` | Keyframes: `luki-breathe`, `luki-blink`, `luki-wave`, `luki-dance`. |
| `examples.js` | Control por Web Animations API: `saludar`, `respirar`, `bailar`, `parpadear`. |
| `demo.html` | Previsualización suelta del SVG y sus animaciones en el navegador. |
| `.../components/LukiMascot.tsx` | Componente React que monta a Luki en la app (seguimiento de mouse, expresiones). |

Todos los SVG comparten `viewBox="0 0 512 512"` y son solo formas vectoriales.

## Capas

El árbol completo de IDs y sus pivotes está en `luki-layers.json` — no se
repite aquí para no desincronizarse. En resumen, cuelgan de `luki-root`:
cola (`tail-base`/`tail-tip`), piernas y pies, `luki-body` (con `belly`),
brazos (`arm-left`/`arm-right`, cada uno con manga, puño y mano),
`luki-hoodie` (capucha, pretina, marca) y `luki-head` (orejas, cara).

## Paleta

Tomada de `luki-layers.json → palette` (no editar los HEX acá, editar allá):
`outline #251533` · `furLight #C79868` · `furDark #8F5E42` ·
`furShadow #6E4530` · `cream #F6E7CC` · `hoodieLight #7355C4` ·
`hoodieDark #5B3FA8` · `hoodieTrim #43297E` · `tailTipLight #8567D6` ·
`tongue #E0416F` · `eyeBlack #17101F` · `isotipoPurple #7C33E0` ·
`isotipoLime #A9E23E` · `isotipoWarm #F0A73C`.

## Cómo editar cada expresión

Pivotes exactos en `luki-layers.json`. Para rotar un grupo desde su pivote
(no desde el centro de su caja), usar `transform-box: view-box` y
`transform-origin: <x>px <y>px` con esas coordenadas — ver `examples.css`.

- **Mirada**: `luki-pupil-left`/`luki-pupil-right` se desplazan dentro del
  rango de `eyePupilClamp` (en `luki-layers.json`). `luki-eyelid-left`/`right`
  controlan el parpadeo (`scaleY`). `luki-eyebrow-left`/`right` dan el gesto
  (enojo, sorpresa, duda).
- **Boca**: `luki-mouth` cambia la forma (sonrisa, línea, sorpresa);
  `luki-tongue` solo aparece en gestos abiertos (risa, cansancio).
- **Brazos**: rotar `luki-arm-left`/`luki-arm-right` desde su pivote en
  `luki-layers.json` (ese grupo arrastra manga, puño y mano). Para un gesto
  solo de muñeca, rotar `luki-hand-left`/`luki-hand-right` desde su propio
  pivote en vez del brazo completo.
- **Cola**: `luki-tail-base` pivota desde donde nace en el cuerpo;
  `luki-tail-tip` es independiente y permite un balanceo de dos tramos
  (base y punta desfasados) para que se vea orgánico.
