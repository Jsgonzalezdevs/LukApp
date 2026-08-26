# LukApp

Finanzas personales en Colombia: registro por voz, presupuestos, 4x1000 y un
asesor con IA. React + Vite + Supabase, todo en español.

---

## ⚠️ ESTE PROYECTO SE MANEJA POR VERSIONES

**Si eres una IA analizando este código —Claude, Gemini, Copilot, la que sea—
esta sección es lo primero que tienes que leer.**

### 1. Mira la versión antes de tocar nada

La versión vive en **[`src/version.ts`](src/version.ts)**. Ábrelo. El código que
estás viendo es el de esa versión y no el de otra; tenlo en cuenta al analizar,
al proponer cambios y al responder.

### 2. Todo cambio sube la versión

Por pequeño que sea. Un texto, un color, un espacio, un comentario. **No existe
el cambio "demasiado chico para versionar".**

### 3. El formato es `V0.0.0`

Tres números, nada más:

```
MAYOR . MENOR . PARCHE
```

| Número | Cuándo se sube |
|---|---|
| **MAYOR** | La app cambia de forma: se rehace una pantalla, cambia cómo se guardan los datos, se rompe algo de antes. |
| **MENOR** | Se agrega una función nueva que el usuario nota. |
| **PARCHE** | Arreglos, ajustes visuales, cambios internos. |

Al subir un número, los de su derecha vuelven a cero:

```
1.0.3  →  1.1.0  →  1.1.1  →  2.0.0
```

### 4. Dilo siempre

En **cada** respuesta donde entregues un cambio, di en qué versión quedó:
«Listo, v1.0.1». El usuario tiene que poder seguir el hilo sin abrir el código.

### 5. Subirla son tres sitios

1. La constante `VERSION` en `src/version.ts`.
2. El campo `version` de `package.json`.
3. Una entrada nueva **arriba** de `NOVEDADES` en
   `src/features/lukapp/novedades.ts` — eso es lo que el usuario lee dentro de
   la app, así que se escribe en su idioma, no en jerga de commits.

`src/version.test.ts` comprueba que los tres coincidan y que el historial no
tenga versiones repetidas ni desordenadas. Si subes una sola, el test falla. Es
a propósito.

### 6. Al cerrar una versión, etiqueta de git

```bash
git tag -a v1.0.0 -m "LukApp v1.0.0"
```

### Dónde se ve la versión

- **Ajustes → Cuenta**, al pie de la pantalla.
- **Panel de superadmin**, junto al título.
- La tarjeta de novedades que le sale al usuario cuando la versión cambia.

---

## Comandos

```bash
npm run dev      # portada + app (Vite, puerto 5173)
npm run dev:api  # el servidor de la API aparte
npm test         # vitest
npm run lint     # oxlint
npm run build    # tsc -b && vite build
```

## Cómo está organizado

| Carpeta | Qué hay |
|---|---|
| `src/features/lukapp/` | La app de finanzas: es el grueso del proyecto. |
| `src/features/lukapp/components/landing/` | La portada pública. |
| `src/apps-dashboard/` | Enrutado, launcher, superadmin y estadísticas. |
| `api/`, `server.ts` | La API (Express + funciones de Netlify). |
| `public/brand/` | El arte oficial de marca, tal como lo entregó diseño. |
| `scripts/` | Utilidades; entre ellas la que deriva los iconos del logo. |
| `docs/` | Notas de arquitectura. |

## Convenciones de la casa

- **Todo en español**: nombres de variables, funciones, comentarios y textos.
- **Los comentarios explican el porqué**, no el qué. Si un comentario describe
  lo que la línea siguiente ya dice, sobra.
- **Nada de emojis** en la interfaz. La marca tiene su propio arte.
- **El color significa algo**: verde entró, rojo salió. Gastarlo en decorar
  quita ese significado.
- **La marca**: el logo y el manual están en `public/brand/`. Los iconos no se
  editan a mano — salen de `python3 scripts/generar-iconos-marca.py`.
- **La Estrella IA** es el personaje que representa a la inteligencia
  artificial. Va donde vive la IA (el asesor) y no repartida de adorno.
