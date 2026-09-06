# LukApp — contexto para otra IA

Versión documentada: **v3.0.0**. LukApp es una PWA React + TypeScript + Vite + Tailwind para finanzas personales en Colombia. Permite registrar ingresos, gastos, transferencias, cuentas, cajitas, tarjetas, deudas, metas, presupuestos y recurrentes; funciona offline con IndexedDB y puede sincronizar con Supabase.

## Arquitectura

```text
Repositorio local/remoto → Instantánea → motorFinanciero → ContextoFinanciero → vistas/asesor
```

La lógica financiera debe ser pura, determinista y vivir en `src/features/lukapp/lib/`. No crear cálculos paralelos en componentes ni escribir desde el motor.

## Estructura

- `src/apps-dashboard/`: launcher, rutas, superadmin y estadísticas.
- `src/features/lukapp/`: aplicación financiera.
- `src/features/lukapp/components/`: Inicio, Dinero, Deudas, Metas, Presupuestos, Tendencias, Captura, Asesor y configuración.
- `src/features/lukapp/data/`: modelos, repositorios, sesión y almacenamiento.
- `src/features/lukapp/lib/`: contabilidad, cuotas, tarjetas, recurrentes, motor, simulador, obligaciones, entradas y proyección.
- `api/` y `server_lib/`: servidor, transcripción y plantillas bancarias.
- `supabase/migrations/`: historial SQL; nunca ejecutar automáticamente desde la aplicación.
- `src/version.ts`: versión única del producto.

## Datos principales

`Instantanea` contiene `transacciones`, `cajitas`, `cajitaMovimientos`, `metas`, `categorias`, `contactos`, `presupuestos` y `recurrentes`.

### Transacciones

`Transaction` tiene `kind` (`gasto`, `ingreso`, `transferencia`), `amountCop`, categoría, descripción, fecha `occurredOn`, `cuentaId`, texto original y cuotas opcionales (`cuotasTotal`, `cuotaCop`). Las transferencias internas no son ingresos ni gastos.

### Cajitas y pasivos

`Cajita.tipo` puede ser:

- `cuenta`: banco, efectivo o billetera;
- `cajita`: reserva/ahorro;
- `tarjeta`: deuda rotativa por compras;
- `deuda`: obligación pendiente.

El saldo se reconstruye desde movimientos. `CajitaMovimiento` usa `deposito`, `retiro`, `rendimiento`, `ajuste`, `compra` y `abono`. Un abono reduce pasivo y cuenta origen; no es gasto.

Campos opcionales de tarjeta: `limiteCreditoCop`, `diaCorte`, `diaPago`, `pagoMinimoCop`. `null` significa no configurado y nunca debe convertirse en cero o fecha inventada.

### Metas, presupuestos y recurrentes

- Una meta es un objetivo, no un gasto automático.
- Un presupuesto es un límite, no una obligación.
- Una cajita es reserva y no debe restarse dos veces.
- Un recurrente tiene tipo, monto, categoría, cuenta, día mensual y estado archivado.
- `yaRegistrado()` evita duplicar recurrentes por período, tipo, categoría y monto.
- El día 31 se ajusta al último día válido del mes.

## Motor financiero

`src/features/lukapp/lib/motorFinanciero.ts` construye `ContextoFinanciero` con saldos, patrimonio, reservas, obligaciones, liquidez, disponible diario, metas, presupuestos, tarjetas y proyección.

```text
dineroLibreBruto = patrimonio - reservas - obligacionesDelPeriodo + ajusteTemporal
dineroLibre = max(0, dineroLibreBruto)
disponibleDiarioBruto = dineroLibreBruto / díasRestantes
disponibleDiario = max(0, disponibleDiarioBruto)
```

El bruto conserva el déficit real. El neto representa lo máximo gastable sin mostrar disponibilidad falsa.

## Obligaciones futuras

`obligacionesFuturas.ts` es el único constructor. Produce obligaciones de recurrentes, pagos de tarjeta y deudas. Cada una conserva `id`, `origen`, `concepto`, `fecha`, `periodo`, `montoCop`, estado y certeza.

Estados: `programada`, `vencida`, `confirmada`, `desconocida`. Certezas: `real`, `programada`, `estimada`, `desconocida`.

Una deuda puede tener importe conocido y fecha `null`. Nunca se coloca artificialmente en la serie diaria.

## Tarjetas y cuotas

```text
compra → saldo utilizado → cuotas → pago pendiente → obligación → liquidez/proyección
```

Las cuotas explican el pago; no son una salida adicional cuando ya están incluidas en el pago de tarjeta. Las compras anteriores al corte pertenecen al extracto del mes; las posteriores, al siguiente; el día del corte pertenece al mes del corte. Día 31 se ajusta al último día real.

## Entradas y proyección

`entradasFuturas.ts` es la única capa de ingresos proyectables. Genera ingresos recurrentes para todos los meses del horizonte, evita ingresos registrados y conserva fechas desconocidas.

`proyeccionFinanciera.ts` solo consume obligaciones y entradas previamente interpretadas. No descubre recurrentes, tarjetas, cuotas, deudas ni ingresos. Produce por punto temporal saldo líquido, entradas, salidas, obligaciones, disponible diario, riesgo y evidencia.

La serie diaria es operativa: un dato mensual no implica precisión intradía. Si falta el día, queda fuera de la serie fechada.

Riesgos: `saludable`, `ajustada`, `deficit-proyectado`, `incompleto`.

## Dashboard

`AppsRoot.tsx` controla sesión, tema, rutas, roles, permisos, carga diferida e impersonación. Rutas: `/app` financiero, `/ecosistema` launcher, `/superadmin` administración y `/estadisticas` analítica.

`LukAppApp.tsx` coordina `useAlmacen`, `useRuta` y las vistas:

- `InicioView`: resumen, liquidez y accesos rápidos;
- `DineroView`: cuentas, cajitas, tarjetas y patrimonio;
- `DeudasView`: saldos, compras, cuotas y abonos;
- `MetasView`: objetivos y progreso;
- presupuestos, tendencias, captura, asesor, respaldo y configuración;
- `DecisionFinanciera`: simulaciones temporales no persistentes.

Dashboard, asesor y componentes deben consumir el contexto central. No recalcular disponible diario, obligaciones o proyección.

## Colores y diseño

La base está en `src/index.css` y `src/features/lukapp/lukapp.css`. Tipografía: Poppins. Diseño: oscuro, premium, mobile-first, tarjetas suaves, bordes discretos, sombras ligeras y espacios amplios.

| Token | Color | Uso |
|---|---|---|
| `--color-luk-purple` | `#772AEA` | Marca principal |
| `--color-luk-lavender` | `#735AC2` | Marca secundaria |
| `--color-luk-lime` / `--color-fin-in` | `#B6F246` | Entradas y progreso positivo |
| `--color-luk-pink` / `--color-fin-out` | `#D4025A` | Salidas, deuda y riesgo |
| `--color-fin-warn` | `#FBBF24` | Advertencias |
| `--fin-bg` | token CSS | Fondo |
| `--fin-card` | token CSS | Superficies |
| `--fin-ink` | token CSS | Texto principal |
| `--fin-ink-soft/faint/ghost` | token CSS | Texto secundario |
| `--fin-line` | token CSS | Bordes |
| `--fin-soft` | token CSS | Fondos suaves |

El color nunca es el único indicador: usar también texto, iconos o signos `+/-`. Las páginas SEO públicas pueden usar tema claro separado.

## Persistencia, privacidad y seguridad

`Repositorio` abstrae IndexedDB y Supabase. El motor no conoce ninguno de los dos. Los datos personales y compartidos deben permanecer separados por propietario/espacio. Supabase usa `user_id`, RLS y cliente público; nunca exponer `service_role`.

La captura por voz, texto, comprobantes o múltiples registros requiere confirmación antes de escribir. No registrar automáticamente recurrentes, cuotas, pagos o escenarios.

## Reglas para otra IA

Leer `AGENTS.md` y `CLAUDE.md`, revisar `git status`, preservar cambios ajenos, usar `rg`, no crear lógica financiera en React, no aplicar migraciones sin autorización, mantener español en código LukApp y ejecutar:

```bash
npm test
npm run build
npm run lint
```

No iniciar calendario predictivo, escenarios persistentes, IA nueva, anomalías avanzadas ni finanzas compartidas avanzadas sin una fase aprobada.
