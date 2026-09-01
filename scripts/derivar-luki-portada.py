#!/usr/bin/env python3
"""Deriva el Luki de la portada a partir del Luki ensamblado.

`public/luki-vector/luki-ensamblado.svg` es la lamina completa del rig: siete
figuras, piezas sueltas y una demo de animacion encima. La portada solo usa una
de esas figuras, y con otras proporciones: la de la lamina se lee cuadrada
--torso corto, saco que termina alto, piernas pegadas al saco--, mientras que la
mascota aprobada es una nutria de pie, mas vertical y estilizada.

Este script recorta esa figura y le corrige la anatomia. No redibuja nada: toma
las rutas reales y les aplica un mapa vertical lineal por tramos, o sea que la
misma coordenada `y` de origen siempre va al mismo `y` de destino, sin importar
a que ruta pertenezca. Al ser una funcion continua, la silueta no puede abrirse:
es imposible que aparezcan huecos, cortes, contornos duplicados ni piezas
separadas, porque los bordes que antes coincidian siguen coincidiendo.

El reparto de los tramos esta en TRAMOS. La cabeza y los pies quedan fuera de
todo estirado --se mueven enteros o no se mueven--, y la franja del isotipo se
declara rigida a proposito: asi el saco crece un 20% sin que la marca salga
estrecha, sin taparla ni redibujarla.

    python3 scripts/derivar-luki-portada.py
"""

from __future__ import annotations

import re
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
ORIGEN = RAIZ / 'public/luki-vector/luki-ensamblado.svg'
DESTINO = RAIZ / 'public/luki-vector/luki-portada.svg'

# Donde esta la figura de pie dentro de la lamina, ya medido sobre el dibujo.
FIGURA = (28.0, 45.0, 244.0, 335.0)  # x0, y0, x1, y1 en coordenadas de la lamina

# Tramos del mapa vertical: (desde, hasta, cuanto se alarga).
# El trazado es una vectorizacion por colores: cada color de TODA la lamina vive
# en una sola ruta compuesta, asi que no se puede recortar por rutas ni mover
# una pieza sola. Por eso el mapa se aplica a la lamina entera y el encuadre es
# quien deja ver unicamente a esta figura.
TRAMOS = [
    (175.0, 189.0, 1.54),   # pecho: donde se gana el largo del saco
    (189.0, 234.0, 1.00),   # isotipo: rigido, la marca no se deforma
    (234.0, 262.0, 1.54),   # falda y pretina del saco, hasta el borde inferior
    (262.0, 302.0, 1.18),   # piernas
]

MARGEN = 12.0  # aire alrededor de la figura en el viewBox final

# Tamaño de la lámina de Illustrator de la que salió la vectorización.
LAMINA = (1536.0, 1024.0)


def nodos_del_mapa() -> tuple[list[float], list[float]]:
    origen, destino = [0.0], [0.0]
    for desde, hasta, k in TRAMOS:
        if origen[-1] < desde:
            destino.append(destino[-1] + (desde - origen[-1]))
            origen.append(desde)
        destino.append(destino[-1] + (hasta - desde) * k)
        origen.append(hasta)
    destino.append(destino[-1] + (2000.0 - origen[-1]))
    origen.append(2000.0)
    return origen, destino


ORIGEN_Y, DESTINO_Y = nodos_del_mapa()


def mapear_y(y: float) -> float:
    for i in range(len(ORIGEN_Y) - 1):
        a, b = ORIGEN_Y[i], ORIGEN_Y[i + 1]
        if y <= b or i == len(ORIGEN_Y) - 2:
            t = (y - a) / (b - a)
            return DESTINO_Y[i] + t * (DESTINO_Y[i + 1] - DESTINO_Y[i])
    return y


NUMERO = re.compile(r'-?\d+(?:\.\d+)?(?:[eE][-+]?\d+)?')


def puntos_de(d: str) -> list[tuple[float, float]]:
    """Los pares (x, y) de una ruta de solo M/L/C/Z absolutos."""
    pares = []
    for tramo in re.finditer(r'([MLCZ])([^MLCZ]*)', d):
        nums = [float(n) for n in NUMERO.findall(tramo.group(2))]
        pares.extend(zip(nums[0::2], nums[1::2]))
    return pares


def transformar_d(d: str, fn) -> str:
    """Reescribe la ruta aplicando `fn` a cada punto, respetando los comandos."""
    salida = []
    for tramo in re.finditer(r'([MLCZ])([^MLCZ]*)', d):
        cmd, cuerpo = tramo.group(1), tramo.group(2)
        nums = [float(n) for n in NUMERO.findall(cuerpo)]
        if not nums:
            salida.append(cmd)
            continue
        pts = [fn(x, y) for x, y in zip(nums[0::2], nums[1::2])]
        salida.append(cmd + ' ' + ' '.join(f'{v:.4f}'.rstrip('0').rstrip('.') for p in pts for v in p))
    return ' '.join(salida)


def _aplanar(sub: str) -> list[tuple[float, float]]:
    """Convierte un subtrazado M/L/C/Z en una polilinea, para poder decidir que
    esta dentro de que."""
    piezas = re.findall(r'[MLCZ]|-?\d+(?:\.\d+)?', sub)
    pts: list[tuple[float, float]] = []
    actual = (0.0, 0.0)
    i = 0
    while i < len(piezas):
        cmd = piezas[i]
        if cmd in ('M', 'L'):
            actual = (float(piezas[i + 1]), float(piezas[i + 2]))
            pts.append(actual)
            i += 3
        elif cmd == 'C':
            p1 = (float(piezas[i + 1]), float(piezas[i + 2]))
            p2 = (float(piezas[i + 3]), float(piezas[i + 4]))
            p3 = (float(piezas[i + 5]), float(piezas[i + 6]))
            p0 = actual
            for k in range(1, 9):
                u = k / 8.0
                v = 1.0 - u
                pts.append((
                    v ** 3 * p0[0] + 3 * v * v * u * p1[0] + 3 * v * u * u * p2[0] + u ** 3 * p3[0],
                    v ** 3 * p0[1] + 3 * v * v * u * p1[1] + 3 * v * u * u * p2[1] + u ** 3 * p3[1],
                ))
            actual = p3
            i += 7
        else:
            i += 1
    return pts


def _dentro(punto: tuple[float, float], poligono: list[tuple[float, float]]) -> bool:
    x, y = punto
    adentro = False
    j = len(poligono) - 1
    for i in range(len(poligono)):
        xi, yi = poligono[i]
        xj, yj = poligono[j]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / ((yj - yi) or 1e-12) + xi:
            adentro = not adentro
        j = i
    return adentro


def sin_fondo_de_lamina(d: str) -> str:
    """Quita el fondo blanco que Illustrator dejó bajo toda la lámina.

    La vectorización es por colores: el blanco de la lámina entera vive en una
    sola ruta compuesta con `fill-rule="evenodd"`, montada en tres niveles --el
    rectángulo de la lámina, los agujeros con la forma de cada figura, y dentro
    de esos agujeros los brillos blancos de ojos y detalles--. Recortar el
    viewBox dejaba ese rectángulo justo detrás de Luki: la tarjeta blanca.

    Borrar solo el rectángulo no basta y además engaña: en `evenodd` la
    paridad se invierte, los agujeros pasan a pintarse de blanco --una mancha
    invisible pero real bajo la mascota-- y los brillos se convierten en
    agujeros. Por eso se quitan el rectángulo Y sus hijos directos, que nunca
    pintaron nada, y se conservan los niveles más hondos: al bajar dos niveles
    de golpe la paridad se mantiene y los brillos siguen siendo brillos.

    Se decide por geometría, no por el texto de la ruta: da igual cómo se
    escriban las coordenadas o si la lámina cambia de exportador.
    """
    trozos = [m.group(0) for m in re.finditer(r'M[^M]*', d)]
    if len(trozos) < 2:
        return d

    poligonos = [_aplanar(t) for t in trozos]
    cajas = []
    for pts in poligonos:
        if not pts:
            cajas.append(None)
            continue
        xs = [p[0] for p in pts]
        ys = [p[1] for p in pts]
        cajas.append((min(xs), min(ys), max(xs), max(ys)))

    ancho, alto = LAMINA
    cubre = [
        i for i, c in enumerate(cajas)
        if c and (c[2] - c[0]) >= ancho * 0.95 and (c[3] - c[1]) >= alto * 0.95
    ]
    if not cubre:
        return d

    # Punto interior de cada subtrazado, para medir a que profundidad esta.
    interiores = []
    for pts, c in zip(poligonos, cajas):
        if not pts:
            interiores.append(None)
            continue
        centro = ((c[0] + c[2]) / 2, (c[1] + c[3]) / 2)
        interiores.append(centro if _dentro(centro, pts) else (pts[0][0] + 1e-3, pts[0][1] + 1e-3))

    def profundidad(i: int) -> int:
        pt = interiores[i]
        if pt is None:
            return 0
        n = 0
        for j, (pts, c) in enumerate(zip(poligonos, cajas)):
            if j == i or not pts or not c:
                continue
            if not (c[0] <= pt[0] <= c[2] and c[1] <= pt[1] <= c[3]):
                continue
            if _dentro(pt, pts):
                n += 1
        return n + 1

    quedan = [t for i, t in enumerate(trozos) if profundidad(i) > 2]
    return ' '.join(quedan)


def main() -> None:
    bruto = ORIGEN.read_text()
    rutas = re.findall(r'<path[^>]*/?>', bruto)
    print(f'rutas en la lamina: {len(rutas)}')

    conservadas = []
    for ruta in rutas:
        md = re.search(r'\sd="([^"]*)"', ruta)
        if not md:
            continue
        d = md.group(1)

        # Las rutas que vienen del PDF traen un volteo en Y propio: se hornea en
        # los datos para poder trabajar todas en el mismo espacio.
        mt = re.search(r'\stransform="matrix\(([^)]*)\)"', ruta)
        if mt:
            a, b, c, e, tx, ty = [float(v) for v in NUMERO.findall(mt.group(1))]
            assert (a, b, c, e) == (1.0, 0.0, 0.0, -1.0), f'matriz inesperada: {mt.group(1)}'
            d = transformar_d(d, lambda x, y, tx=tx, ty=ty: (x + tx, ty - y))
            ruta = ruta.replace(mt.group(0), '')

        # Se limpia despues de hornear la matriz para que las dos copias del
        # fondo --la normal y la volteada-- se midan en el mismo espacio.
        d = sin_fondo_de_lamina(d)

        if not puntos_de(d):
            continue
        conservadas.append((ruta, transformar_d(d, lambda x, y: (x, mapear_y(y)))))

    fx0, fy0, fx1, fy1 = FIGURA
    by0, by1 = mapear_y(fy0), mapear_y(fy1)
    vb = (fx0 - MARGEN, by0 - MARGEN, (fx1 - fx0) + 2 * MARGEN, (by1 - by0) + 2 * MARGEN)
    saco = (mapear_y(262.0) - 151.0) / (262.0 - 151.0) - 1.0
    print(f'rutas conservadas: {len(conservadas)}')
    print(f'saco {saco * 100:+.1f}%   pies {fy1:.0f} -> {by1:.1f}')
    print(f'figura: {fx1 - fx0:.0f} x {by1 - by0:.0f}   viewBox {vb[0]:.1f} {vb[1]:.1f} {vb[2]:.1f} {vb[3]:.1f}')

    cuerpo = '\n'.join(
        re.sub(r'\sd="[^"]*"', '', ruta).replace('/>', '').replace('>', '') + f' d="{d}"/>'
        for ruta, d in conservadas
    )
    svg = (
        f'<svg xmlns="http://www.w3.org/2000/svg" '
        f'viewBox="{vb[0]:.1f} {vb[1]:.1f} {vb[2]:.1f} {vb[3]:.1f}" '
        f'aria-hidden="true" focusable="false">\n'
        f'<!-- Generado por scripts/derivar-luki-portada.py a partir de '
        f'luki-ensamblado.svg. No editar a mano. -->\n'
        f'{cuerpo}\n</svg>\n'
    )
    DESTINO.write_text(svg)
    print(f'escrito {DESTINO.relative_to(RAIZ)} ({len(svg) / 1024:.0f} kB)')


if __name__ == '__main__':
    main()
