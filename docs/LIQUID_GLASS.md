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

Esas APIs realizan el muestreo, la adaptación y la refracción que el navegador no expone como un material nativo. CSS puede aproximar la apariencia, pero no puede garantizar una réplica píxel por píxel ni igualar el lente óptico del sistema. El repositorio de LukApp es React/Vite y no contiene un target iOS nativo; por eso el efecto web no puede ser idéntico al del sistema de Apple. Para lograrlo en iPhone, la cápsula debe renderizarse como un control SwiftUI/UIKit nativo e integrarse con las acciones de LukApp.

### Implementación nativa prevista para la cápsula Premium

El contenedor debe ser una sola forma de cristal interactiva. Los tres botones conservan sus etiquetas accesibles y sus acciones; no se dibuja un fondo opaco ni se anima una imitación encima del material del sistema:

```swift
GlassEffectContainer(spacing: 8) {
    HStack(spacing: 4) {
        Button(action: anotarAMano) { Label("Anotar a mano", systemImage: "keyboard") }
        Button(action: escanearFoto) { Label("Escanear foto", systemImage: "camera") }
        Button(action: buscarMovimiento) { Label("Buscar", systemImage: "magnifyingglass") }
    }
    .padding(8)
    .glassEffect(.regular.tint(.purple.opacity(0.16)).interactive(), in: Capsule())
}
```

Pasos para llevarlo a LukApp:

1. Crear el target SwiftUI para iOS y exponer una vista nativa de acciones con callbacks hacia el flujo de React. Mantener React como fuente de los datos y reglas financieras.
2. Activar la cápsula nativa solo después de recibir el estado Premium ya validado por el servidor; el cliente no debe decidir el nivel de suscripción.
3. Usar `.regular` para mantener legibilidad sobre saldos y movimientos, `.interactive()` para la respuesta táctil y un tinte morado discreto. Dejar que el sistema adapte reflejos, contraste y fondo.
4. Integrar los botones con las mismas acciones de anotar, escanear y buscar; verificar accesibilidad, VoiceOver, tema, contraste y movimiento reducido en un dispositivo Apple real.
5. Conservar la versión web como fallback. No declarar la réplica nativa terminada hasta comparar la vista en iOS con Liquid Glass del sistema.

Apple documenta este flujo con `glassEffect(_:in:)`, la variante `.regular`, tintes y `.interactive()`. La documentación también recomienda reservar el cristal para navegación y controles, y evitar apilar capas de vidrio.

## Aproximación web de LukApp

La app actual es React/Vite y también se ejecuta como web/PWA. En ese entorno, estas pautas dan una aproximación fiel sin fingir que es el material nativo:

1. Aplicar Liquid Glass solo a superficies flotantes de navegación y controles, nunca a las tarjetas de información de Inicio.
2. Poner el contenido real por detrás de la superficie. Usar `backdrop-filter: blur(...) saturate(...)` (y su variante `-webkit-`) para difuminar ese contenido; una capa morada semitransparente sin `backdrop-filter` es solo un cuadro translúcido. Evitar `backdrop-filter: url(#svg)`: en la comparación local el filtro SVG quitó la lectura del fondo en Chromium, y no ofrece una solución consistente entre motores.
3. Mantener un tinte de marca moderado. Dejar que el fondo influya en el tono y conservar iconos legibles sobre ambos temas. El vidrio regular debe poder leerse sobre fondos variados; no usar la variante clara si no se puede asegurar contraste.
4. Dibujar el borde con más de una señal óptica: filo superior brillante, borde interior suave, sombra exterior y reflejo amplio. Evitar un borde uniforme grueso y un halo neón constante.
5. Hacer que una luz especular responda despacio al puntero o al toque. Animar reflejos, no el desenfoque: recalcular blur continuamente cuesta y suele verse como un filtro decorativo.
6. En interacción, dar respuesta breve al control (escala, rebote pequeño y aumento localizado de luz). Mantener la animación de reposo casi imperceptible.
7. Adaptar los valores para tema claro y oscuro, `prefers-reduced-motion`, alto contraste y dispositivos donde `backdrop-filter` no esté disponible. El fallback debe seguir siendo opaco y legible.
8. Mantener una sola placa para un grupo de acciones relacionadas. No superponer varias placas de vidrio sobre el mismo fondo; el vidrio real toma luz del entorno y de los elementos cercanos.

## Componente actual

La cápsula flotante para escribir, escanear y buscar usa `.fin-premium-crystal` en `src/features/lukapp/components/BotonAnotar.tsx`, con desenfoque, tinte y reflejos en `src/features/lukapp/lukapp.css`. Solo se activa tras validar Premium en el servidor. El botón de dictado mantiene su tratamiento propio. Esta versión web aporta desenfoque y respuesta de luz; no curva los píxeles de la página y no debe presentarse como idéntica al material nativo de Apple.

Al revisar cambios, comprobar visualmente la cápsula sobre contenido claro y oscuro en movimiento, desplazar texto por detrás, mover y tocar el cristal, revisar el tema claro/oscuro y activar la preferencia de movimiento reducido. Confirmar que los iconos siguen siendo nítidos y que el fondo se ve realmente desenfocado.
