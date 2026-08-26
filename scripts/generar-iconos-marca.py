#!/usr/bin/env python3
"""Deriva todos los iconos de LukApp desde el logo oficial.

Las fuentes viven en public/brand/ (copiadas del disco de la marca), así que
esto se puede volver a correr sin tener el disco externo conectado:

    python3 scripts/generar-iconos-marca.py

iOS solo acepta PNG en apple-touch-icon y rellena de negro cualquier
transparencia, por eso los iconos se dibujan opacos sobre el morado de marca.
Se dejan cuadrados a propósito: iOS aplica su propia máscara redondeada y
pre-redondearlos deja un doble borde visible.
"""

from pathlib import Path
from PIL import Image

RAIZ = Path(__file__).resolve().parent.parent
MARCA = RAIZ / 'public' / 'brand'
SALIDA = RAIZ / 'public'

# El morado del logo oficial con fondo (LogoApp.png).
FONDO = (42, 1, 65, 255)


def recortado(ruta: Path) -> Image.Image:
    """La imagen sin el aire transparente que trae alrededor."""
    im = Image.open(ruta).convert('RGBA')
    caja = im.split()[3].getbbox()
    return im.crop(caja) if caja else im


def icono(iso: Image.Image, lado: int, ocupacion: float) -> Image.Image:
    """Isotipo centrado sobre el morado, ocupando `ocupacion` del lado."""
    lienzo = Image.new('RGBA', (lado, lado), FONDO)
    alto = round(lado * ocupacion)
    ancho = round(iso.width * alto / iso.height)
    lienzo.alpha_composite(
        iso.resize((ancho, alto), Image.LANCZOS),
        ((lado - ancho) // 2, (lado - alto) // 2),
    )
    return lienzo


# La Estrella IA: cuerpo lila #735AC2, brazos y piernas morado #4A0182.
CUERPO = (115, 90, 194)
EXTREMIDADES = (74, 1, 130)


def es(pixel, color, tolerancia=25) -> bool:
    return pixel[3] > 128 and all(abs(pixel[i] - color[i]) < tolerancia for i in range(3))


def estrella() -> None:
    """El personaje entero y, aparte, solo la cara.

    La versión "cara" existe porque a 32px —el avatar del chat del asesor— el
    personaje completo son dos palos y una mancha: los brazos y las piernas se
    comen el alto y la carita queda en nada. Recortada a la estrella se lee.
    """
    completo = recortado(MARCA / 'lukapp-estrella.png')
    completo.save(SALIDA / 'lukapp-estrella.png')
    print('cuerpo entero:')
    ojos(completo)

    # La caja de la estrella sola: el lila del cuerpo, sin contar extremidades.
    px = completo.load()
    xs, ys = [], []
    for y in range(completo.height):
        for x in range(completo.width):
            if es(px[x, y], CUERPO):
                xs.append(x)
                ys.append(y)
    cara = completo.crop((min(xs), min(ys), max(xs) + 1, max(ys) + 1))

    # Los brazos y piernas van dibujados DETRÁS de la estrella, así que al
    # recortar quedan muñones asomando por los bordes. Borrarlos por color deja
    # el fantasma de sus píxeles suavizados, así que en vez de eso se conserva
    # solo lo que está pegado a la estrella: relleno desde el centro sobre el
    # cuerpo y la cara, y fuera todo lo demás.
    px = cara.load()
    dentro = set()
    pila = [(cara.width // 2, cara.height // 2)]
    while pila:
        x, y = pila.pop()
        if (x, y) in dentro or not (0 <= x < cara.width and 0 <= y < cara.height):
            continue
        r, g, b, a = px[x, y]
        # El borde suavizado de la estrella baja de alpha sin cambiar de tono,
        # y los muñones son de otro color: el corte va por el color, no por el
        # alpha, y así el contorno de la estrella no queda dentado.
        if a < 8 or es((r, g, b, 255), EXTREMIDADES, 45):
            continue
        dentro.add((x, y))
        pila += [(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)]

    for y in range(cara.height):
        for x in range(cara.width):
            if (x, y) not in dentro:
                px[x, y] = (0, 0, 0, 0)
    cara = cara.crop(cara.split()[3].getbbox())
    cara.save(SALIDA / 'lukapp-estrella-cara.png')

    print('solo la cara:')
    ojos(cara)


def ojos(cara: Image.Image) -> None:
    """Imprime dónde caen los ojos, en fracciones de la cara ya recortada.

    Estos números van copiados a mano dentro de Estrella.tsx, que los usa para
    colocar los párpados del parpadeo encima del PNG. Si algún día cambia el
    arte del personaje, se vuelve a correr esto y se copian los nuevos.
    """
    px = cara.load()
    columnas: dict[int, list[int]] = {}
    for y in range(cara.height):
        for x in range(cara.width):
            r, g, b, a = px[x, y]
            blanco = r > 240 and g > 240 and b > 240
            negro = r < 40 and g < 40 and b < 40
            if a > 200 and (blanco or negro):
                columnas.setdefault(x, []).append(y)

    # Ojo izquierdo, boca y ojo derecho salen como tres bloques de columnas
    # separados por huecos; la boca es el del medio y se descarta.
    bloques: list[list[int]] = []
    for x in sorted(columnas):
        if bloques and x - bloques[-1][-1] <= 2:
            bloques[-1].append(x)
        else:
            bloques.append([x])
    print('ojos (fracción de la cara recortada):')
    for nombre, bloque in zip(('izquierdo', 'derecho'), (bloques[0], bloques[-1])):
        ys = [y for x in bloque for y in columnas[x]]
        print(
            f'  {nombre}: left {bloque[0] / cara.width:.4f} '
            f'top {min(ys) / cara.height:.4f} '
            f'width {(bloque[-1] - bloque[0]) / cara.width:.4f} '
            f'height {(max(ys) - min(ys)) / cara.height:.4f}'
        )


def main() -> None:
    iso = recortado(MARCA / 'lukapp-isotipo.png')

    # Iconos normales: el isotipo respira como en el logo oficial.
    for lado in (32, 180, 192, 512):
        icono(iso, lado, 0.62).save(SALIDA / f'lukapp-icon-{lado}.png')

    # Maskable: Android recorta hasta un círculo, así que el arte se encoge
    # para caber entero en la zona segura (el 80% central).
    icono(iso, 512, 0.46).save(SALIDA / 'lukapp-icon-maskable-512.png')

    # Open Graph: 1200x630 apaisado, isotipo centrado sobre el morado.
    og = Image.new('RGBA', (1200, 630), FONDO)
    alto = 380
    marca = iso.resize((round(iso.width * alto / iso.height), alto), Image.LANCZOS)
    og.alpha_composite(marca, ((1200 - marca.width) // 2, (630 - alto) // 2))
    og.convert('RGB').save(SALIDA / 'lukapp-og.png')

    # Isotipo transparente en tamaño de interfaz: el original son 2040px y
    # 120 KB para pintarse a 20px en una cabecera.
    alto = 256
    iso.resize((round(iso.width * alto / iso.height), alto), Image.LANCZOS).save(
        SALIDA / 'lukapp-isotipo.png'
    )

    # Logotipo horizontal ("Luk"), tal cual viene de marca.
    recortado(MARCA / 'lukapp-wordmark.png').save(SALIDA / 'lukapp-wordmark.png')

    estrella()

    print('Iconos generados en', SALIDA)


if __name__ == '__main__':
    main()
