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

La web actual no tiene target iOS ni `WKWebView`: es React/Vite y se puede instalar como PWA. Para paridad real, LukApp necesita una envoltura iOS nativa que aloje el sitio en `WKWebView` y dibuje la barra como una vista SwiftUI hermana, por encima del webview. No poner la vista nativa dentro de un `iframe` ni cubrirla con otra capa CSS.

La barra completa es una sola forma de cristal. Los iconos y las acciones siguen siendo botones normales, accesibles y nítidos:

```swift
@available(iOS 26.0, *)
struct BarraAccionesPremium: View {
    let anotarAMano: () -> Void
    let escanearFoto: () -> Void
    let buscar: () -> Void

    var body: some View {
        GlassEffectContainer(spacing: 12) {
            HStack(spacing: 4) {
                Button(action: anotarAMano) { Image(systemName: "keyboard") }
                    .accessibilityLabel("Anotar a mano")
                Button(action: escanearFoto) { Image(systemName: "camera") }
                    .accessibilityLabel("Escanear foto")
                Button(action: buscar) { Image(systemName: "magnifyingglass") }
                    .accessibilityLabel("Buscar movimientos")
            }
            .buttonStyle(.plain)
            .padding(8)
            .glassEffect(
                .regular.tint(.purple.opacity(0.10)).interactive(),
                in: Capsule()
            )
        }
    }
}
```

#### Pasos de integración con el producto

1. Crear el proyecto/target iOS con SwiftUI y `WKWebView`. Mantener los datos, navegación y reglas financieras en React; la vista nativa solo presenta controles y reenvía acciones.
2. Poner la barra en un `safeAreaInset(edge: .bottom)` del contenedor SwiftUI, por encima del webview y del contenido desplazable. Reservar el espacio inferior para que los últimos movimientos no queden ocultos.
3. Definir un puente pequeño de mensajes con acciones permitidas (`manual`, `scan`, `search`). Enviar la acción desde Swift hacia la web con un evento tipado; no interpolar texto libre en JavaScript. Enviar desde React el estado visual de Premium después de cargar la suscripción verificada.
4. El estado Premium recibido controla solo el aspecto. El servidor y React siguen autorizando beneficios; la vista SwiftUI no concede funciones ni altera el plan.
5. Usar `.regular` y `.interactive()`; añadir tinte morado tenue solo para Premium. No dibujar gradientes, blur, bordes ni animación CSS sobre la vista nativa. El sistema adapta luz, reflejo, contraste y respuesta táctil.
6. Para sistemas anteriores a iOS 26, usar `Material.thin` o mantener la barra web actual como fallback. Nunca presentar el fallback como idéntico a Liquid Glass.
7. Validar en iPhone real sobre movimientos claros y oscuros que se desplazan detrás: el texto debe difuminarse, los iconos seguir nítidos, la barra reaccionar al toque y no cubrir contenido. Revisar VoiceOver, Dynamic Type, movimiento/transparencia reducidos y modos claro/oscuro.

#### Contrato sugerido para el puente

La dirección nativa → web usa una unión cerrada de acciones, conectada en React a los mismos manejadores de `BotonAnotar`:

```ts
type AccionBarraNativa = 'manual' | 'scan' | 'search';
window.addEventListener('lukapp:quick-action', (event) => {
  const accion = (event as CustomEvent<AccionBarraNativa>).detail;
  // Enrutar a onManual, scanImage o onBuscar; sin lógica financiera aquí.
});
```

La dirección web → nativo puede emitir `{ type: 'appearance', premium: true }` al handler `WKScriptMessageHandler` configurado para LukApp. Validar y limitar el esquema en ambos lados. No enviar saldos, movimientos, credenciales ni tokens por este canal.

Apple documenta `glassEffect(_:in:)`, `.regular`, el tinte, `.interactive()` y `GlassEffectContainer` en [Applying Liquid Glass to custom views](https://developer.apple.com/documentation/SwiftUI/Applying-Liquid-Glass-to-custom-views). [Meet Liquid Glass — WWDC25](https://developer.apple.com/videos/play/wwdc2025/219/) explica cómo el material adapta blur, tinte, contraste y sombras al contenido que pasa debajo, y recomienda reservarlo a navegación y controles.

## Aproximación web de LukApp

La app actual es React/Vite y también se ejecuta como web/PWA. En ese entorno, estas pautas dan una aproximación fiel sin fingir que es el material nativo:

1. Aplicar Liquid Glass solo a superficies flotantes de navegación y controles, nunca a las tarjetas de información de Inicio.
2. Poner el contenido real por detrás de la superficie. Usar `backdrop-filter: blur(...) saturate(...)` (y su variante `-webkit-`) para difuminar ese contenido; una capa morada semitransparente sin `backdrop-filter` es solo un cuadro translúcido. Evitar crear un SVG de desplazamiento propio aplicado como `backdrop-filter: url(#svg)`: la comparación local dejó la placa sin el fondo visible.
3. Mantener un tinte de marca moderado. Dejar que el fondo influya en el tono y conservar iconos legibles sobre ambos temas. El vidrio regular debe poder leerse sobre fondos variados; no usar la variante clara si no se puede asegurar contraste.
4. Dibujar el borde con más de una señal óptica: filo superior brillante, borde interior suave, sombra exterior y reflejo amplio. Evitar un borde uniforme grueso y un halo neón constante.
5. Hacer que una luz especular responda despacio al puntero o al toque. Animar reflejos, no el desenfoque: recalcular blur continuamente cuesta y suele verse como un filtro decorativo.
6. En interacción, dar respuesta breve al control (escala, rebote pequeño y aumento localizado de luz). Mantener la animación de reposo casi imperceptible.
7. Adaptar los valores para tema claro y oscuro, `prefers-reduced-motion`, alto contraste y dispositivos donde `backdrop-filter` no esté disponible. El fallback debe seguir siendo opaco y legible.
8. Mantener una sola placa para un grupo de acciones relacionadas. No superponer varias placas de vidrio sobre el mismo fondo; el vidrio real toma luz del entorno y de los elementos cercanos.

## Componente actual

La cápsula flotante para escribir, escanear y buscar usa una superficie CSS en `.fin-premium-lens`, dentro de `BotonAnotar.tsx`. Su `backdrop-filter` directo aplica 32 px de blur y saturación al contenido real que pasa debajo; una prueba local mostró que la combinación anterior de blur con filtro SVG mantenía visible el color, pero no difuminaba bien las letras. El tinte, el filo y el reflejo se adaptan al tema claro u oscuro; el reflejo se mueve lentamente y sigue el puntero, mientras el contenido y los botones permanecen nítidos. La web no calcula la luminancia ni refracta la luz como iOS; esta superficie es un fallback visual y no debe presentarse como Liquid Glass nativo.

La intensidad del blur se nota según el contenido que haya detrás. Validar la barra sobre movimientos claros y oscuros y también mientras se desplazan; una superficie uniforme no deja ver la difusión aunque el filtro esté activo. La referencia de aceptación web es que se distingan a la vez el desenfoque real, la influencia cromática del contenido, el tinte morado, los reflejos de borde y los iconos nítidos.

La barra usa las propiedades nativas de desenfoque del navegador y no necesita una biblioteca externa. Si un navegador no admite `backdrop-filter`, se conserva la superficie morada de fallback. La barra es más ancha que alta; mantener el radio de cápsula y evitar desplazar el contenido como si fuera un lente óptico.

El botón de dictado mantiene su tratamiento propio. La superficie CSS es solo una aproximación visual; no refracta la luz ni reproduce la respuesta del sistema Apple. Para obtener esa paridad en iPhone, seguir la implementación SwiftUI prevista arriba.

Al revisar cambios, comprobar visualmente la cápsula sobre contenido claro y oscuro en movimiento, desplazar texto por detrás, mover y tocar el cristal, revisar el tema claro/oscuro y activar la preferencia de movimiento reducido. Confirmar que los iconos siguen siendo nítidos y que el fondo se ve realmente desenfocado. Esta matriz verifica la aproximación web; la aceptación de paridad con Apple requiere el target nativo y la comparación en iPhone descritos arriba.
