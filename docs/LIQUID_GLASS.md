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

Apple documenta `glassEffect(_:in:)`, `.regular`, el tinte, `.interactive()` y `GlassEffectContainer` en [Applying Liquid Glass to custom views](https://developer.apple.com/documentation/SwiftUI/Applying-Liquid-Glass-to-custom-views). [Meet Liquid Glass — WWDC25](https://developer.apple.com/videos/play/wwdc2025/219/) explica cómo el material adapta tinte, contraste, sombras y refracción al contenido que pasa debajo, y recomienda reservarlo a navegación y controles. La guía [Materials](https://developer.apple.com/design/human-interface-guidelines/materials) recomienda materiales del sistema y efectos como blur, vibrancy y blending para estructurar el contenido bajo Liquid Glass.

### Qué significa «igual a Apple» en este proyecto

Liquid Glass no es un preset de blur: Apple lo construye como un material del sistema con varias capas adaptativas, refracción en tiempo real, luz y respuesta física al tacto. SwiftUI y UIKit pueden usar ese motor del sistema; una web solo ofrece filtros y composición CSS. Por eso la barra web puede hacerse mucho más parecida y tener desenfoque real, pero no debe declararse idéntica. La paridad literal requiere un target Apple nativo.

En el checkout v10.1.17 no hay proyecto Xcode ni target iOS. La máquina donde se prepara este checkout tampoco tiene instalado/configurado el SDK `iphoneos`; antes de compilar o validar la versión nativa se debe usar una máquina con Xcode completo y un iPhone con iOS 26 o posterior.

Para completar esa integración en una fase futura:

1. Crear un target iOS nativo en el mismo producto, con `WKWebView` para la app React y SwiftUI para la cápsula flotante. La vista SwiftUI debe ocupar el espacio de la barra sobre la vista web, no ser un overlay CSS dentro del documento.
2. Aplicar `.glassEffect(.regular.tint(tintePremium).interactive(), in: Capsule())` a un contenedor con las acciones y usar `GlassEffectContainer` si los elementos necesitan fusionarse o cambiar de forma. No dibujar manualmente borde, blur, brillo o gradiente encima del material nativo.
3. Dejar el contenido de movimientos desplazarse realmente detrás del control. Mantener la cápsula en una sola capa flotante para evitar vidrio sobre vidrio.
4. Enviar acciones nativas a los manejadores existentes de React mediante el puente tipado documentado arriba. React comunica solo el estado visual Premium, derivado de la suscripción verificada; la autorización de prestaciones sigue del lado de la aplicación/servidor.
5. Comparar una grabación del iPhone real con esta referencia: texto y montos se desplazan bajo la cápsula; la lente los adapta y refracta, el violeta modifica sus tonos sin taparlos, los símbolos conservan contraste y el material reacciona a toque. Revisar claro/oscuro, Reduce Transparency, Reduce Motion, VoiceOver y los límites del área segura.
6. Si Apple cambia el material del sistema, seguir la API del SDK instalado en vez de perseguir valores visuales privados. La aplicación debe usar el material del SO, no copiar parámetros internos.

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

La cápsula flotante para escribir, escanear y buscar usa una superficie en `.fin-premium-lens`, dentro de `BotonAnotar.tsx`, solo cuando la suscripción Premium ya se verificó. `LukAppShell.tsx` la monta dentro de `.fin-root`. En v10.1.16 los selectores estaban bajo `.fin-page`, una clase que no existe en el DOM autenticado; el navegador solo mostraba el relleno inline y no aplicaba el blur. v10.1.17 corrigió el selector y v10.1.18 declara el material base inline para que el filtro también llegue desde el componente. La hoja mínima del cristal está en `styles/premium-glass.css` y se importa desde `main.tsx`, no desde una vista diferida: así el blur, el reflejo, el filo, la interacción y las preferencias de accesibilidad no dependen de que Vite entregue una hoja tardía. v10.1.19 mueve el reflejo y el filo a capas del propio componente para conservar su estructura aunque falte el CSS secundario. v10.1.21 sube la difusión a 26 px y refuerza el reflejo especular móvil; la capa morada sigue siendo tenue para que se vea el color y el movimiento que pasan detrás. Reduce Transparency mantiene un velo más intenso y un blur de 24 px. El tinte morado se adapta al tema claro u oscuro; el reflejo sigue el puntero y se mueve despacio en reposo, mientras los controles permanecen nítidos. La web no calcula la luminancia ni refracta la luz como iOS; esta superficie es un fallback visual y no debe presentarse como Liquid Glass nativo.

La intensidad del blur se nota según el contenido que haya detrás. Validar la barra sobre movimientos claros y oscuros y también mientras se desplazan; una superficie uniforme no deja ver la difusión aunque el filtro esté activo. La referencia de aceptación web es que se distingan a la vez el desenfoque real, la influencia cromática del contenido, el tinte morado, los reflejos de borde y los iconos nítidos. La vista de prueba debe usar `.fin-root`, igual que la app real, para no dar un resultado falso positivo. Revisar que `prefers-reduced-transparency: reduce` no apague el filtro y vuelva a convertir el control en un cuadro liso.

La barra usa las propiedades nativas de desenfoque del navegador y no necesita una biblioteca externa. Si un navegador no admite `backdrop-filter`, se conserva la superficie morada de fallback. La barra es más ancha que alta; mantener el radio de cápsula y evitar desplazar el contenido como si fuera un lente óptico.

El botón de dictado mantiene su tratamiento propio. La superficie CSS es solo una aproximación visual; no refracta la luz ni reproduce la respuesta del sistema Apple. Para obtener esa paridad en iPhone, seguir la implementación SwiftUI prevista arriba.

Al revisar cambios, comprobar visualmente la cápsula sobre contenido claro y oscuro en movimiento, desplazar texto por detrás, mover y tocar el cristal, revisar el tema claro/oscuro y activar la preferencia de movimiento reducido. Confirmar que los iconos siguen siendo nítidos y que el fondo se ve realmente desenfocado. Esta matriz verifica la aproximación web; la aceptación de paridad con Apple requiere el target nativo y la comparación en iPhone descritos arriba.
