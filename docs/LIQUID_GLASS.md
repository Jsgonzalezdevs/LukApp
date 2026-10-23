# Liquid Glass en LukApp

Guía de implementación y revisión para las superficies flotantes de la app.

## Fuente del diseño

Apple describe Liquid Glass como una capa ligera para controles y navegación que flota sobre el contenido. No es solo transparencia: el material desenfoca y adapta el contenido que pasa detrás, refleja y concentra luz en los bordes, cambia su contraste según el entorno y responde a la interacción. Apple recomienda reservarlo para controles importantes; no convertir tarjetas de contenido en vidrio.

Referencias oficiales:

- [Human Interface Guidelines: Materials](https://developer.apple.com/design/human-interface-guidelines/materials)
- [Meet Liquid Glass — WWDC25](https://developer.apple.com/videos/play/wwdc2025/219/)
- [Build a SwiftUI app with the new design — WWDC25](https://developer.apple.com/videos/play/wwdc2025/323/)
- [Applying Liquid Glass to custom views](https://developer.apple.com/documentation/SwiftUI/Applying-Liquid-Glass-to-custom-views)
- [What’s new in SwiftUI — WWDC26](https://developer.apple.com/videos/play/wwdc2026/269/)

## Regla principal

Cuando la interfaz se construya de forma nativa para Apple, usar el material del sistema en vez de dibujarlo a mano:

- SwiftUI: `glassEffect(_:in:)`; añadir `.interactive()` a controles interactivos y agrupar elementos vecinos con `GlassEffectContainer`.
- UIKit: `UIVisualEffectView` con `UIGlassEffect`; usar el color de tinte solo para indicar una acción o estado con significado.
- Preferir las barras, botones y buscadores del sistema cuando correspondan. Mantener el vidrio en una capa funcional separada del contenido.

Esas APIs realizan el muestreo, la adaptación y la refracción que el navegador no expone como un material nativo. CSS puede aproximar la apariencia, pero no puede garantizar una réplica píxel por píxel ni igualar el lente óptico del sistema. Si se requiere identidad exacta en iOS, la cápsula deberá renderizarse como un control SwiftUI/UIKit nativo e integrarse con las acciones de LukApp.

## Aproximación web de LukApp

La app actual es React/Vite y también se ejecuta como web/PWA. En ese entorno, estas pautas dan una aproximación fiel sin fingir que es el material nativo:

1. Aplicar Liquid Glass solo a superficies flotantes de navegación y controles, nunca a las tarjetas de información de Inicio.
2. Poner el contenido real por detrás de la superficie. Usar `backdrop-filter: blur(...) saturate(...)` (y su variante `-webkit-`) para difuminar ese contenido; una capa morada semitransparente sin `backdrop-filter` es solo un cuadro translúcido.
3. Mantener un tinte de marca moderado. Dejar que el fondo influya en el tono y conservar iconos legibles sobre ambos temas. El vidrio regular debe poder leerse sobre fondos variados; no usar la variante clara si no se puede asegurar contraste.
4. Dibujar el borde con más de una señal óptica: filo superior brillante, borde interior suave, sombra exterior y reflejo amplio. Evitar un borde uniforme grueso y un halo neón constante.
5. Hacer que una luz especular responda despacio al puntero o al toque. Animar reflejos, no el desenfoque: recalcular blur continuamente cuesta y suele verse como un filtro decorativo.
6. En interacción, dar respuesta breve al control (escala, rebote pequeño y aumento localizado de luz). Mantener la animación de reposo casi imperceptible.
7. Adaptar los valores para tema claro y oscuro, `prefers-reduced-motion`, alto contraste y dispositivos donde `backdrop-filter` no esté disponible. El fallback debe seguir siendo opaco y legible.
8. Mantener una sola placa para un grupo de acciones relacionadas. No superponer varias placas de vidrio sobre el mismo fondo; el vidrio real toma luz del entorno y de los elementos cercanos.

## Componente actual

La cápsula flotante para escribir, escanear y buscar usa `.fin-premium-crystal` en `src/features/lukapp/components/BotonAnotar.tsx`, con material y reflejos en `src/features/lukapp/lukapp.css`. Solo se activa tras validar Premium en el servidor. El botón de dictado mantiene su tratamiento propio.

Al revisar cambios, comprobar visualmente la cápsula sobre contenido claro y oscuro en movimiento, desplazar texto por detrás, mover y tocar el cristal, revisar el tema claro/oscuro y activar la preferencia de movimiento reducido. Confirmar que los iconos siguen siendo nítidos y que el fondo se ve realmente desenfocado.
