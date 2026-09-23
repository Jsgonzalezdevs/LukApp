# LukApp

Aplicación de finanzas personales para Colombia. Permite registrar movimientos
por texto, voz, imagen y extractos bancarios; organizar cuentas, presupuestos,
metas, deudas y tarjetas; y analizar el historial financiero.

Versión actual: `V3.3.4`. La fuente de versión es [`src/version.ts`](src/version.ts)
y debe coincidir con `package.json` y `src/features/lukapp/novedades.ts`.

## Funciones

- Registro manual, texto libre y dictado en español colombiano.
- Parser de montos, fechas, categorías, cuentas, comercios y contrapartes.
- OCR de recibos con Tesseract.js.
- Extractos PDF de Nu, Nequi, Bancolombia y Davivienda.
- Detección de duplicados y confirmación antes de guardar.
- Cuentas, efectivo, cajitas, metas, deudas y tarjetas de crédito.
- Cuotas, intereses, cuota de manejo, abonos y transferencias.
- Presupuestos por categoría con proyección al ritmo actual.
- Tendencias de seis meses, señales de gastos y simulaciones financieras.
- Calendario financiero y pagos recurrentes con confirmación manual.
- Contactos, apodos, unificación de nombres y gastos compartidos.
- Finanzas en Pareja mediante espacios compartidos e invitaciones.
- Asesor financiero con IA y contexto de la situación del usuario.
- Informe imprimible, CSV/Excel y respaldo JSON restaurable.
- PWA instalable, IndexedDB, modo offline y cola de sincronización.
- Tema claro/oscuro, atajos, accesibilidad móvil y feedback háptico.
- Blog SEO, sitemap, robots.txt, Open Graph y datos estructurados.
- Panel de superadmin, roles personalizados y estadísticas de visitas.

## Arquitectura

La entrada es [`src/main.tsx`](src/main.tsx). [`src/RaizAplicacion.tsx`](src/RaizAplicacion.tsx)
decide entre portada, blog y aplicación privada.

```text
src/
├── apps-dashboard/       Lanzador, roles, superadmin y estadísticas
├── components/           Componentes transversales y manejo de errores
├── context/              Contextos globales
├── lib/                  API, analítica, autenticación y utilidades
└── features/lukapp/
    ├── components/       Vistas, modales y componentes visuales
    ├── data/             Sesión, IndexedDB, Supabase y sincronización
    ├── hooks/            Voz, OCR, PWA, almacenamiento y gestos
    ├── lib/              Parser, cálculos y motor financiero
    └── analista/         Importación y revisión de extractos

api/                      Funciones HTTP para transcripción y visitas
server.ts                 API Express para analista y administración
server_lib/               Auth, permisos y plantillas bancarias
supabase/migrations/      Esquema, RLS y cambios de base de datos
public/                   PWA, marca, sitemap, robots y service worker
```

La navegación principal tiene cinco destinos: Inicio, Dinero, Mes, Asesor y
Más. Calendario se abre desde Mes; configuración, importación, 4x1000,
respaldos y cuenta viven en Más.

Los repositorios de memoria, IndexedDB y Supabase comparten una interfaz. El
saldo se reconstruye desde los movimientos y los ajustes no reescriben la
historia. Row Level Security aísla los datos por usuario.

## Desarrollo

```bash
npm install
npm run dev       # Frontend Vite en http://localhost:5173
npm run dev:api   # API Express en modo watch
npm test          # Vitest
npm run lint      # Oxlint
npm run build     # TypeScript + Vite producción
npm run preview   # Preview del build
```

Para cobertura específica del audio: `npm run test:audio-cobertura`.

## Variables de entorno

Frontend (valores publicables): `VITE_SUPABASE_URL`,
`VITE_SUPABASE_PUBLISHABLE_KEY` (o la antigua `VITE_SUPABASE_ANON_KEY`) y
`VITE_API_URL`.

Servidor: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `PORT`, `VISITAS_SAL`
y, si activas pagos, `WOMPI_AMBIENTE`, `WOMPI_PUBLIC_KEY`,
`WOMPI_INTEGRITY_SECRET`, `WOMPI_EVENTS_SECRET` y `WOMPI_REDIRECT_URL`. Las
claves de servicio y secretos nunca deben llevar `VITE_`.
Consulta [`.env.example`](.env.example).

## Despliegue y base de datos

Vercel sirve el frontend y las funciones de `api/`; Render puede ejecutar
`server.ts`. Las migraciones de [`supabase/migrations`](supabase/migrations)
se aplican en orden. Consulta también [`docs/ARQUITECTURA_AUTH.md`](docs/ARQUITECTURA_AUTH.md),
[`supabase/README.md`](supabase/README.md), [`supabase/COMO_APLICAR.md`](supabase/COMO_APLICAR.md)
y [`docs/FREEMIUM_Y_PAGOS.md`](docs/FREEMIUM_Y_PAGOS.md).

## Convenciones

- Todo cambio incrementa la versión en los tres lugares obligatorios.
- Todo commit incluye `vX.Y.Z`, por ejemplo `feat: v3.3.4 — resumen`.
- Los cálculos financieros deben ser reconstruibles y tener pruebas.
- Verde significa entrada y rojo salida; no se usan como decoración.
- La interfaz está en español y la privacidad del usuario es una restricción
  de diseño.
