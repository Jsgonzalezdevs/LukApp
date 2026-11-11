#!/usr/bin/env python3
"""Genera Lucide.kt con los trazos EXACTOS de lucide-react que usa la web.

Se copian los trazos y no se dibujan a ojo porque la iconografía es parte de la
identidad de LukApp: un ícono "parecido" de Material se nota. Se guardan como
texto SVG y no como ImageVector porque la web cambia el grosor del trazo según
el estado (2 inactivo, 2.5 activo, 1.8 por defecto) y un ImageVector lo hornea.

Uso, desde la raíz del repo:  python3 apps/android/herramientas/generar-iconos-lucide.py
"""
import json
import re
from pathlib import Path

RAIZ = Path.cwd()
LUCIDE = RAIZ / "node_modules/lucide-react/dist/esm"
DESTINO = RAIZ / "apps/android/app/src/main/java/app/lukapp/ui/iconos/Lucide.kt"

indice = (LUCIDE / "lucide-react.mjs").read_text()
alias: dict[str, str] = {}
for partes, archivo in re.findall(r"export \{([^}]+)\} from '\./icons/([a-z0-9-]+)\.mjs'", indice):
    for parte in partes.split(","):
        nombre = parte.strip().removeprefix("default as ").strip()
        if nombre and not nombre.endswith("Icon") and not nombre.startswith("Lucide"):
            alias[nombre] = archivo

usados: set[str] = set()
for ruta in (RAIZ / "src/features/lukapp").rglob("*"):
    if ruta.suffix not in (".ts", ".tsx") or ".test." in ruta.name:
        continue
    texto = ruta.read_text()
    for bloque in re.findall(r"import\s*(?:type\s*)?\{([^}]+)\}\s*from\s*'lucide-react'", texto):
        for p in bloque.split(","):
            n = re.split(r"\s+as\s+", p.strip())[0].removeprefix("type ").strip()
            if n in alias:
                usados.add(n)
    # Íconos guardados por nombre en los datos (categorías, cuentas, cajitas).
    for n in re.findall(r"['\"]([A-Z][A-Za-z0-9]+)['\"]", texto):
        if n in alias:
            usados.add(n)


def numero(v) -> float:
    return float(v)


def fmt(v: float) -> str:
    return str(int(v)) if float(v).is_integer() else repr(round(v, 4))


def puntos(texto: str) -> str:
    vals = re.split(r"[\s,]+", texto.strip())
    pares = [f"{vals[i]} {vals[i + 1]}" for i in range(0, len(vals), 2)]
    return "M" + " L".join(pares)


def a_trazo(tipo: str, a: dict) -> str:
    if tipo == "path":
        return a["d"]
    if tipo in ("circle", "ellipse"):
        cx, cy = numero(a["cx"]), numero(a["cy"])
        rx = numero(a.get("r", a.get("rx")))
        ry = numero(a.get("r", a.get("ry")))
        return f"M{fmt(cx - rx)} {fmt(cy)}a{fmt(rx)} {fmt(ry)} 0 1 0 {fmt(2 * rx)} 0a{fmt(rx)} {fmt(ry)} 0 1 0 {fmt(-2 * rx)} 0"
    if tipo == "line":
        return f"M{a['x1']} {a['y1']}L{a['x2']} {a['y2']}"
    if tipo == "polyline":
        return puntos(a["points"])
    if tipo == "polygon":
        return puntos(a["points"]) + "Z"
    if tipo == "rect":
        x, y = numero(a.get("x", 0)), numero(a.get("y", 0))
        w, h = numero(a["width"]), numero(a["height"])
        rx = numero(a.get("rx", a.get("ry", 0)))
        ry = numero(a.get("ry", a.get("rx", 0)))
        if not rx:
            return f"M{fmt(x)} {fmt(y)}h{fmt(w)}v{fmt(h)}h{fmt(-w)}Z"
        return (
            f"M{fmt(x + rx)} {fmt(y)}h{fmt(w - 2 * rx)}a{fmt(rx)} {fmt(ry)} 0 0 1 {fmt(rx)} {fmt(ry)}"
            f"v{fmt(h - 2 * ry)}a{fmt(rx)} {fmt(ry)} 0 0 1 {fmt(-rx)} {fmt(ry)}h{fmt(-(w - 2 * rx))}"
            f"a{fmt(rx)} {fmt(ry)} 0 0 1 {fmt(-rx)} {fmt(-ry)}v{fmt(-(h - 2 * ry))}a{fmt(rx)} {fmt(ry)} 0 0 1 {fmt(rx)} {fmt(-ry)}Z"
        )
    raise ValueError(f"Elemento SVG sin soporte: {tipo}")


def nodo_de(archivo: str) -> list:
    texto = (LUCIDE / "icons" / f"{archivo}.mjs").read_text()
    cuerpo = re.search(r"const __iconNode = (\[[\s\S]*?\]);\nconst ", texto).group(1)
    # El literal JS solo tiene claves sin comillas: basta con citarlas para que sea JSON.
    cuerpo = re.sub(r"([{,]\s*)([A-Za-z0-9_]+)\s*:", r'\1"\2":', cuerpo)
    return json.loads(cuerpo)


nombres = sorted(usados)
lineas, mapa = [], []
for n in nombres:
    trazos = ", ".join(json.dumps(a_trazo(t, a)) for t, a in nodo_de(alias[n]))
    lineas.append(f'    val {n} = IconoLucide("{n}", listOf({trazos}))')
    mapa.append(f'        "{n}" to {n},')

DESTINO.parent.mkdir(parents=True, exist_ok=True)
DESTINO.write_text(
    "// ARCHIVO GENERADO por apps/android/herramientas/generar-iconos-lucide.py — no editar a mano.\n"
    f"// Trazos de lucide-react (licencia ISC): los mismos {len(nombres)} íconos que usa la web.\n"
    "package app.lukapp.ui.iconos\n\n"
    "object Lucide {\n" + "\n".join(lineas) + "\n\n"
    "    /** Para íconos guardados por nombre en la base (categorías propias, cuentas, cajitas). */\n"
    "    val porNombre: Map<String, IconoLucide> by lazy {\n        mapOf(\n" + "\n".join("    " + m for m in mapa) + "\n        )\n    }\n}\n"
)
print(f"{len(nombres)} íconos → {DESTINO.relative_to(RAIZ)}")
