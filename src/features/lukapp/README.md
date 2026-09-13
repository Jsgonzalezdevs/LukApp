# LukApp — manual técnico

La entrada de la aplicación es [`LukAppApp.tsx`](LukAppApp.tsx). La navegación
principal se define en [`sections.ts`](sections.ts) y tiene cinco destinos:
Inicio, Dinero, Mes, Asesor y Más.

## Capacidades actuales

- Texto libre, alta manual y dictado en español colombiano.
- Parser de montos, fechas, categorías, cuentas, comercios y contrapartes.
- OCR de recibos con Tesseract.js.
- Extractos PDF de Nu, Nequi, Bancolombia y Davivienda.
- Confirmación, edición y detección de duplicados.
- Cuentas, efectivo, cajitas, metas, deudas y tarjetas.
- Cuotas, intereses, cuota de manejo, abonos y transferencias.
- Presupuestos, proyecciones, tendencias, señales de gasto y simulaciones.
- Calendario financiero y pagos recurrentes confirmados manualmente.
- Contactos, apodos, unificación, vaquitas y división de cuenta.
- Finanzas compartidas mediante invitaciones y espacios.
- Asesor con IA, atajos de Apple Pay y aprendizaje local de categorías.
- Exportación CSV/Excel, informe imprimible y respaldo JSON restaurable.
- IndexedDB, Supabase, cola de sincronización y PWA offline.

## Persistencia

Los repositorios de memoria, IndexedDB y Supabase comparten una interfaz. El
saldo se reconstruye reproduciendo movimientos; un ajuste corrige el saldo sin
reescribir la historia. Deudas y tarjetas usan el signo inverso: una compra
aumenta lo adeudado y un abono lo reduce.

## Organización del código

```text
components/   Vistas, modales, hojas y navegación
data/         Sesión, repositorios, IndexedDB, Supabase y sincronización
hooks/        Voz, OCR, almacenamiento, PWA y gestos
lib/          Parser, cálculos, señales, proyecciones y exportación
analista/     Lectura, revisión y reporte de extractos
```

Las funciones puras de `lib/` deben mantenerse separadas de la UI y cubrirse
con pruebas.

## Referencias

- [Manual general](../../../README.md)
- [Autenticación](../../../docs/ARQUITECTURA_AUTH.md)
- [Migraciones](../../../supabase/README.md)
- [Versión](../../version.ts)
